import Constants from 'expo-constants';
import createClient from 'openapi-fetch';

import { getDeviceToken } from '@/state/participations';

import type { paths } from './schema';

const DEFAULT_API_BASE_URL = 'http://10.0.2.2:8080/api/v1';

function configuredApiBaseUrl(): string {
  const configured = Constants.expoConfig?.extra?.apiBaseUrl;

  return typeof configured === 'string' && configured.length > 0
    ? configured
    : DEFAULT_API_BASE_URL;
}

/** The public value from app.json, ending in the API base path. */
export const apiBaseUrl = configuredApiBaseUrl();

// openapi-fetch concatenates the base URL with the schema paths, and the schema already carries
// `/api/v1`, so the client takes the origin only.
const apiOrigin = apiBaseUrl.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');

export const api = createClient<paths>({ baseUrl: apiOrigin });

/** A client that authenticates as the participant of one study. */
export function deviceClient(deviceToken: string) {
  return createClient<paths>({
    baseUrl: apiOrigin,
    headers: { Authorization: `Device ${deviceToken}` },
  });
}

/** A client that authenticates with the participant account token. */
export function accountClient(accountToken: string) {
  return createClient<paths>({
    baseUrl: apiOrigin,
    headers: { Authorization: `Account ${accountToken}` },
  });
}

/** A client that authenticates as a volunteer pool member. */
export function poolClient(credential: string) {
  return createClient<paths>({
    baseUrl: apiOrigin,
    headers: { Authorization: `Pool ${credential}` },
  });
}

export async function deviceClientForStudy(studyId: string) {
  const deviceToken = await getDeviceToken(studyId);

  return deviceToken ? deviceClient(deviceToken) : null;
}

export type { components, paths } from './schema';
