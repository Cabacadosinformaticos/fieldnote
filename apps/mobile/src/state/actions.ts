import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';

import { apiBaseUrl, type components } from '@/api/client';
import { queueDatabase } from '@/queue/database';
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

const apiOrigin = apiBaseUrl.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');

export type ParticipantStatus = components['schemas']['ParticipantStatus'];
export type Locale = components['schemas']['Locale'];

// The account and pool routes are newer than the generated schema, so their enums are mirrored
// here until `npm run api:types` is regenerated.
export type AgeBand = '18-24' | '25-34' | '35-44' | '45-54' | '55-64' | '65+';
export type Gender = 'female' | 'male' | 'other';
export type Occupation =
  | 'student'
  | 'employee'
  | 'self_employed'
  | 'unemployed'
  | 'retired'
  | 'other';
export type TransportMode =
  | 'walking'
  | 'public_transport'
  | 'car'
  | 'bicycle'
  | 'scooter'
  | 'other';

export type StudySummary = {
  id: string;
  title: string;
  status: 'draft' | 'running' | 'closed';
  starts_on: string | null;
  ends_on: string | null;
  timezone: string;
};

export type AccountParticipation = {
  participant_id: string;
  study: StudySummary;
  status: ParticipantStatus;
  alias: string | null;
  erasure_due_at: string | null;
  device_token?: string | null;
};

export type AccountOut = {
  confirmed: boolean;
  created_at: string;
  methods: {
    email_masked: string | null;
    google: boolean;
    recovery_code: boolean;
  };
  participations: AccountParticipation[];
  pool_linked: boolean;
};

export type PoolMember = {
  concelho: string;
  freguesia: string | null;
  age_band: AgeBand | null;
  gender: Gender | null;
  occupation: Occupation | null;
  usual_transport: TransportMode | null;
  languages: string[] | null;
  invitations_paused: boolean;
  joined_at: string;
  account_linked: boolean;
};

export type PoolJoinOut = PoolMember & { credential: string };

export type PoolInvitation = {
  id: string;
  status: 'sent' | 'accepted' | 'declined' | 'expired';
  reason: string;
  concelho: string;
  sent_at: string;
  expires_at: string;
  responded_at: string | null;
  study: {
    id: string;
    title: string;
    description: string | null;
    status: 'draft' | 'running' | 'closed';
    starts_on: string | null;
    ends_on: string | null;
    timezone: string;
    team: string[];
    requests_per_day: number;
    expected_minutes_per_day: number;
    entry_types: string[];
    captures_location: boolean;
  };
};

export type PoolAccepted = {
  outcome: 'joined';
  device_token: string;
  participant: {
    id: string;
    study: StudySummary;
    alias: string | null;
    status: ParticipantStatus;
    has_consent: boolean;
  };
};

export type SignInOut = {
  account_token: string;
  created?: boolean;
  participations: AccountParticipation[];
  pool: { credential: string; member: PoolMember } | null;
};

export type RecoveryAccountOut = {
  recovery_code: string;
  account_token: string;
  confirmed?: boolean;
};

export type LinkCredentials = {
  device_tokens: string[];
  pool_credential: string | null;
};

type Auth = {
  scheme: 'Account' | 'Pool' | 'Device';
  token: string;
};

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  auth?: Auth;
  body?: unknown;
};

export type ApiResult<T> = { data: T; error: null } | { data: null; error: unknown };

async function errorBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { Accept: 'application/json' };

  if (options.auth) {
    headers.Authorization = `${options.auth.scheme} ${options.auth.token}`;
  }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(`${apiOrigin}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    if (!response.ok) {
      return { data: null, error: await errorBody(response) };
    }

    if (response.status === 204) {
      return { data: undefined as T, error: null };
    }

    return { data: (await response.json()) as T, error: null };
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
 * The queued entries and the prompt cache are study data, so an erasure request discards them
 * at once (security.md, "Erasure started by the participant").
 */
export async function clearStudyQueue(studyId: string): Promise<void> {
  const db = await queueDatabase();
  await db.runAsync('DELETE FROM outbox WHERE study_id = ?', [studyId]);
  await db.runAsync('DELETE FROM prompt_activities WHERE study_id = ?', [studyId]);
}

async function deleteCachedParticipation(studyId: string): Promise<void> {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await db.runAsync('DELETE FROM participations WHERE study_id = ?', [studyId]);
}

/**
 * After an erasure is complete, nothing of the study is useful on the phone: the device token
 * and the cached card are removed. The token is kept while the erasure is only scheduled, so
 * the participant can still cancel it (security.md, "Erasure started by the participant").
 */
export async function deleteParticipationLocal(studyId: string): Promise<void> {
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
  return request('/api/v1/account/recovery', { method: 'POST' });
}

export function confirmAccount(
  accountToken: string,
  credentials: LinkCredentials,
): Promise<ApiResult<AccountOut>> {
  return request('/api/v1/account/confirm', {
    method: 'POST',
    auth: { scheme: 'Account', token: accountToken },
    body: credentials,
  });
}

export function getAccount(accountToken: string): Promise<ApiResult<AccountOut>> {
  return request('/api/v1/account/me', {
    auth: { scheme: 'Account', token: accountToken },
  });
}

export function linkAccount(
  accountToken: string,
  credentials: LinkCredentials,
): Promise<ApiResult<AccountOut>> {
  return request('/api/v1/account/participations/link', {
    method: 'POST',
    auth: { scheme: 'Account', token: accountToken },
    body: credentials,
  });
}

export function requestEmailCode(
  email: string,
  accountToken?: string | null,
): Promise<ApiResult<{ detail: string }>> {
  return request('/api/v1/account/email/codes', {
    method: 'POST',
    auth: accountToken
      ? { scheme: 'Account', token: accountToken }
      : undefined,
    body: { email },
  });
}

export function verifyEmailCode(
  email: string,
  code: string,
  credentials: LinkCredentials,
  accountToken?: string | null,
): Promise<ApiResult<AccountOut | SignInOut>> {
  return request('/api/v1/account/email/verify', {
    method: 'POST',
    auth: accountToken
      ? { scheme: 'Account', token: accountToken }
      : undefined,
    body: { email, code, ...credentials },
  });
}

export function signInWithRecovery(
  code: string,
  credentials: LinkCredentials,
): Promise<ApiResult<SignInOut>> {
  return request('/api/v1/account/sign-in/recovery', {
    method: 'POST',
    body: { code, ...credentials },
  });
}

export function deleteAccount(
  accountToken: string,
  eraseStudyData: boolean,
): Promise<ApiResult<void>> {
  return request(
    `/api/v1/account?erase_study_data=${eraseStudyData ? 'true' : 'false'}`,
    {
      method: 'DELETE',
      auth: { scheme: 'Account', token: accountToken },
    },
  );
}

export function removeAccountMethod(
  accountToken: string,
  method: 'recovery_code' | 'email',
): Promise<ApiResult<AccountOut>> {
  return request(`/api/v1/account/methods/${method}`, {
    method: 'DELETE',
    auth: { scheme: 'Account', token: accountToken },
  });
}

/* Volunteer pool -------------------------------------------------------------------------- */

export type PoolJoinRequest = {
  concelho: string;
  freguesia?: string | null;
  age_band?: AgeBand | null;
  gender?: Gender | null;
  occupation?: Occupation | null;
  usual_transport?: TransportMode | null;
  languages?: Locale[];
  push_token?: string | null;
};

export type PoolProfileUpdate = Partial<PoolJoinRequest> & {
  invitations_paused?: boolean;
};

export function joinPool(body: PoolJoinRequest): Promise<ApiResult<PoolJoinOut>> {
  return request('/api/v1/pool/members', { method: 'POST', body });
}

export function getPoolMember(credential: string): Promise<ApiResult<PoolMember>> {
  return request('/api/v1/pool/me', {
    auth: { scheme: 'Pool', token: credential },
  });
}

export function updatePoolMember(
  credential: string,
  body: PoolProfileUpdate,
): Promise<ApiResult<PoolMember>> {
  return request('/api/v1/pool/me', {
    method: 'PATCH',
    auth: { scheme: 'Pool', token: credential },
    body,
  });
}

export function leavePool(credential: string): Promise<ApiResult<void>> {
  return request('/api/v1/pool/me', {
    method: 'DELETE',
    auth: { scheme: 'Pool', token: credential },
  });
}

export function listPoolInvitations(
  credential: string,
): Promise<ApiResult<PoolInvitation[]>> {
  return request('/api/v1/pool/invitations', {
    auth: { scheme: 'Pool', token: credential },
  });
}

export function getPoolInvitation(
  credential: string,
  invitationId: string,
): Promise<ApiResult<PoolInvitation>> {
  return request(`/api/v1/pool/invitations/${invitationId}`, {
    auth: { scheme: 'Pool', token: credential },
  });
}

export function acceptPoolInvitation(
  credential: string,
  invitationId: string,
  body: {
    consent_version: string;
    locale?: Locale;
    android_id?: string | null;
    answers?: { question_id: string; answer: unknown }[];
  },
): Promise<ApiResult<PoolAccepted>> {
  return request(`/api/v1/pool/invitations/${invitationId}/accept`, {
    method: 'POST',
    auth: { scheme: 'Pool', token: credential },
    body,
  });
}

export function declinePoolInvitation(
  credential: string,
  invitationId: string,
): Promise<ApiResult<PoolInvitation>> {
  return request(`/api/v1/pool/invitations/${invitationId}/decline`, {
    method: 'POST',
    auth: { scheme: 'Pool', token: credential },
  });
}
