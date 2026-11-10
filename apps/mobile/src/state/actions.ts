import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';

import { accountClient, api, poolClient, type components } from '@/api/client';
import { queueDatabase } from '@/queue/database';
import { deleteStudyMedia, notifyOutbox } from '@/queue/outbox';
import { clearCachedStudy } from '@/queue/promptCache';
import { clearStudyPromptEvents } from '@/queue/promptEvents';
import {
  deviceTokenKey,
  getDeviceToken,
  listParticipations,
  saveDeviceToken,
  saveParticipation,
  type Participation,
} from '@/state/participations';

const ACCOUNT_TOKEN_KEY = 'fieldnote.account.token';
const POOL_CREDENTIAL_KEY = 'fieldnote.pool.credential';
const ERASURE_DUES_KEY = 'fieldnote.erasure.dues';
const DATABASE_NAME = 'fieldnote-participations.db';

/** The consent text version the app shows; the API records it with each acceptance (FR-29). */
export const CONSENT_VERSION = '1.0';

export type ParticipantStatus = components['schemas']['ParticipantStatus'];
export type Locale = components['schemas']['Locale'];
export type AgeBand = components['schemas']['AgeBand'];
export type Gender = components['schemas']['Gender'];
export type Occupation = components['schemas']['Occupation'];
export type TransportMode = components['schemas']['TransportMode'];

export type StudySummary = components['schemas']['StudySummaryOut'];
export type AccountParticipation =
  components['schemas']['AccountParticipationOut'];
export type AccountOut = components['schemas']['app__schemas__account__AccountOut'];
export type PoolMember = components['schemas']['PoolMemberOut'];
export type PoolJoinOut = components['schemas']['PoolJoinOut'];
export type PoolInvitation = components['schemas']['PoolInvitationOut'];
export type PoolAccepted = components['schemas']['PoolInvitationAcceptOut'];
export type SignInOut = components['schemas']['SignInOut'];
export type RecoveryAccountOut = components['schemas']['RecoveryAccountOut'];
export type PoolJoinRequest = components['schemas']['PoolJoinRequest'];
export type PoolProfileUpdate = components['schemas']['PoolProfileUpdate'];

export type LinkCredentials = {
  device_tokens: string[];
  pool_credential: string | null;
};

export type ApiResult<T> = { data: T; error: null } | { data: null; error: unknown };

type TypedCall<T> = Promise<{
  data?: T;
  error?: unknown;
  response: Response;
}>;

/** Normalises an openapi-fetch result to the shape the screens already use. */
async function settle<T>(call: TypedCall<T>): Promise<ApiResult<T>> {
  try {
    const { data, error, response } = await call;
    if (response.ok) {
      return { data: data as T, error: null };
    }
    return { data: null, error: error ?? { network: true } };
  } catch {
    return { data: null, error: { network: true } };
  }
}

let pendingRecoveryCode: string | null = null;

/** The recovery code returned by the API is shown once; it is kept in memory, never on disk. */
export function setPendingRecoveryCode(code: string): void {
  pendingRecoveryCode = code;
}

export function getPendingRecoveryCode(): string | null {
  return pendingRecoveryCode;
}

export function clearPendingRecoveryCode(): void {
  pendingRecoveryCode = null;
}

export async function getAccountToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCOUNT_TOKEN_KEY);
}

export async function saveAccountToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(ACCOUNT_TOKEN_KEY, token);
}

export async function clearAccountToken(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCOUNT_TOKEN_KEY).catch(() => undefined);
}

export async function getPoolCredential(): Promise<string | null> {
  return SecureStore.getItemAsync(POOL_CREDENTIAL_KEY);
}

export async function savePoolCredential(credential: string): Promise<void> {
  await SecureStore.setItemAsync(POOL_CREDENTIAL_KEY, credential);
}

export async function clearPoolCredential(): Promise<void> {
  await SecureStore.deleteItemAsync(POOL_CREDENTIAL_KEY).catch(() => undefined);
}

/** Every device token on this phone, for account linking and restoring. */
export async function listDeviceTokens(): Promise<string[]> {
  const rows = await listParticipations();
  const tokens = await Promise.all(rows.map((row) => getDeviceToken(row.studyId)));

  return tokens.filter((token): token is string => Boolean(token));
}

/** The credentials the account routes accept to link what this phone holds. */
export async function linkableCredentials(): Promise<LinkCredentials> {
  return {
    device_tokens: await listDeviceTokens(),
    pool_credential: await getPoolCredential(),
  };
}

function participationInput(
  study: StudySummary,
  item: AccountParticipation,
): Parameters<typeof saveParticipation>[0] {
  return {
    studyId: study.id,
    title: study.title,
    description: study.description,
    consentText: study.consent_text,
    team: study.team,
    maxPromptsPerDay: study.max_prompts_per_day,
    todayFreeEntryDisplay: study.today_free_entry_display,
    status: item.status,
    alias: item.alias,
    startsOn: study.starts_on,
    endsOn: study.ends_on,
    timezone: study.timezone,
  };
}

/**
 * Restoring an account replaces the device token of every linked participation, so both the
 * tokens and the cached cards are taken from the API response.
 */
export async function applySignIn(result: SignInOut): Promise<void> {
  await saveAccountToken(result.account_token);

  for (const item of result.participations) {
    if (!item.device_token) {
      continue;
    }

    await saveDeviceToken(item.study.id, item.device_token);
    await saveParticipation(participationInput(item.study, item));
    await setErasureDue(item.study.id, item.erasure_due_at);
  }

  if (result.pool) {
    await savePoolCredential(result.pool.credential);
  }
}

/** Refresh the cached cards of the participations the account knows about. */
export async function applyAccountParticipations(account: AccountOut): Promise<void> {
  for (const item of account.participations) {
    await saveParticipation(participationInput(item.study, item));
    await setErasureDue(item.study.id, item.erasure_due_at);
  }
}

type ErasureDues = Record<string, string>;

async function readErasureDues(): Promise<ErasureDues> {
  const raw = await SecureStore.getItemAsync(ERASURE_DUES_KEY);

  if (!raw) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed !== null && typeof parsed === 'object'
      ? (parsed as ErasureDues)
      : {};
  } catch {
    return {};
  }
}

async function writeErasureDues(dues: ErasureDues): Promise<void> {
  if (Object.keys(dues).length === 0) {
    await SecureStore.deleteItemAsync(ERASURE_DUES_KEY).catch(() => undefined);
    return;
  }

  await SecureStore.setItemAsync(ERASURE_DUES_KEY, JSON.stringify(dues));
}

export async function erasureDues(): Promise<ErasureDues> {
  return readErasureDues();
}

export async function getErasureDue(studyId: string): Promise<string | null> {
  const dues = await readErasureDues();
  return dues[studyId] ?? null;
}

export async function setErasureDue(
  studyId: string,
  dueAt: string | null,
): Promise<void> {
  const dues = await readErasureDues();

  if (dueAt) {
    dues[studyId] = dueAt;
  } else {
    delete dues[studyId];
  }

  await writeErasureDues(dues);
}

/**
 * The queued entries, their media files and both activity caches are study data, so an erasure
 * request discards them at once (security.md, "Erasure started by the participant"). SQLite can
 * reject a write while another screen is reading, so the wipe is retried before it is reported.
 */
export async function clearStudyQueue(studyId: string): Promise<void> {
  const attempts = 3;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await deleteStudyMedia(studyId);
      const db = await queueDatabase();
      await db.runAsync('DELETE FROM outbox WHERE study_id = ?', [studyId]);
      await clearCachedStudy(studyId);
      await clearStudyPromptEvents(studyId);
      notifyOutbox();
      return;
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('queue_wipe_failed');
}

async function deleteCachedParticipation(studyId: string): Promise<void> {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await db.runAsync('DELETE FROM participations WHERE study_id = ?', [studyId]);
}

/**
 * After an erasure is complete, nothing of the study is useful on the phone: the queued entries,
 * their media, the activity caches, the device token and the cached card are removed. The token
 * is kept while the erasure is only scheduled, so the participant can still cancel it
 * (security.md, "Erasure started by the participant").
 */
export async function deleteParticipationLocal(studyId: string): Promise<void> {
  await clearStudyQueue(studyId);
  await SecureStore.deleteItemAsync(deviceTokenKey(studyId)).catch(() => undefined);
  await deleteCachedParticipation(studyId);
  await setErasureDue(studyId, null);
}

/** Removes the local copy of studies whose erasure date has already passed. */
export async function purgeExpiredErasures(now = Date.now()): Promise<void> {
  const dues = await readErasureDues();
  const expired = Object.entries(dues)
    .filter(([, dueAt]) => {
      const time = new Date(dueAt).getTime();
      return !Number.isNaN(time) && time <= now;
    })
    .map(([studyId]) => studyId);

  await Promise.all(expired.map((studyId) => deleteParticipationLocal(studyId)));
}

export async function deleteAllParticipationsLocal(): Promise<void> {
  const rows = await listParticipations();
  await Promise.all(rows.map((row) => deleteParticipationLocal(row.studyId)));
  await SecureStore.deleteItemAsync(ERASURE_DUES_KEY).catch(() => undefined);
}

export function isEndedParticipation(
  participation: Participation,
  now = new Date(),
): boolean {
  if (!participation.endsOn) {
    return false;
  }

  const end = new Date(`${participation.endsOn}T23:59:59`);
  return !Number.isNaN(end.getTime()) && end.getTime() < now.getTime();
}

/* Account --------------------------------------------------------------------------------- */

export function createRecoveryAccount(): Promise<ApiResult<RecoveryAccountOut>> {
  return settle(api.POST('/api/v1/account/recovery'));
}

export function confirmAccount(
  accountToken: string,
  credentials: LinkCredentials,
): Promise<ApiResult<AccountOut>> {
  return settle(
    accountClient(accountToken).POST('/api/v1/account/confirm', {
      body: credentials,
    }),
  );
}

export function getAccount(accountToken: string): Promise<ApiResult<AccountOut>> {
  return settle(accountClient(accountToken).GET('/api/v1/account/me'));
}

export function linkAccount(
  accountToken: string,
  credentials: LinkCredentials,
): Promise<ApiResult<AccountOut>> {
  return settle(
    accountClient(accountToken).POST('/api/v1/account/participations/link', {
      body: credentials,
    }),
  );
}

export function requestEmailCode(
  email: string,
  accountToken?: string | null,
): Promise<ApiResult<{ detail: string }>> {
  const client = accountToken ? accountClient(accountToken) : api;

  return settle(
    client.POST('/api/v1/account/email/codes', { body: { email } }),
  );
}

export function verifyEmailCode(
  email: string,
  code: string,
  credentials: LinkCredentials,
  accountToken?: string | null,
): Promise<ApiResult<AccountOut | SignInOut>> {
  const client = accountToken ? accountClient(accountToken) : api;

  return settle(
    client.POST('/api/v1/account/email/verify', {
      body: { email, code, ...credentials },
    }),
  );
}

export function signInWithRecovery(
  code: string,
  credentials: LinkCredentials,
): Promise<ApiResult<SignInOut>> {
  return settle(
    api.POST('/api/v1/account/sign-in/recovery', {
      body: { code, ...credentials },
    }),
  );
}

export function deleteAccount(
  accountToken: string,
  eraseStudyData: boolean,
): Promise<ApiResult<void>> {
  return settle(
    accountClient(accountToken).DELETE('/api/v1/account', {
      params: { query: { erase_study_data: eraseStudyData } },
    }),
  );
}

export function removeAccountMethod(
  accountToken: string,
  method: 'recovery_code' | 'email',
): Promise<ApiResult<AccountOut>> {
  return settle(
    accountClient(accountToken).DELETE('/api/v1/account/methods/{method}', {
      params: { path: { method } },
    }),
  );
}

/* Volunteer pool -------------------------------------------------------------------------- */

export function joinPool(body: PoolJoinRequest): Promise<ApiResult<PoolJoinOut>> {
  return settle(api.POST('/api/v1/pool/members', { body }));
}

export function getPoolMember(credential: string): Promise<ApiResult<PoolMember>> {
  return settle(poolClient(credential).GET('/api/v1/pool/me'));
}

export function updatePoolMember(
  credential: string,
  body: PoolProfileUpdate,
): Promise<ApiResult<PoolMember>> {
  return settle(poolClient(credential).PATCH('/api/v1/pool/me', { body }));
}

export function leavePool(credential: string): Promise<ApiResult<void>> {
  return settle(poolClient(credential).DELETE('/api/v1/pool/me'));
}

export function listPoolInvitations(
  credential: string,
): Promise<ApiResult<PoolInvitation[]>> {
  return settle(poolClient(credential).GET('/api/v1/pool/invitations'));
}

export function getPoolInvitation(
  credential: string,
  invitationId: string,
): Promise<ApiResult<PoolInvitation>> {
  return settle(
    poolClient(credential).GET('/api/v1/pool/invitations/{invitation_id}', {
      params: { path: { invitation_id: invitationId } },
    }),
  );
}

export function acceptPoolInvitation(
  credential: string,
  invitationId: string,
  body: components['schemas']['PoolInvitationAcceptRequest'],
): Promise<ApiResult<PoolAccepted>> {
  return settle(
    poolClient(credential).POST(
      '/api/v1/pool/invitations/{invitation_id}/accept',
      { params: { path: { invitation_id: invitationId } }, body },
    ),
  );
}

export function declinePoolInvitation(
  credential: string,
  invitationId: string,
): Promise<ApiResult<PoolInvitation>> {
  return settle(
    poolClient(credential).POST(
      '/api/v1/pool/invitations/{invitation_id}/decline',
      { params: { path: { invitation_id: invitationId } } },
    ),
  );
}
