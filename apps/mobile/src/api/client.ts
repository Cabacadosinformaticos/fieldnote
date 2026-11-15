import Constants from 'expo-constants';
import createClient from 'openapi-fetch';

import { getDeviceToken } from '@/state/participations';

import { createFailoverFetch, gatewayOrigin } from './failover';
import type { paths } from './schema';

const DEFAULT_API_BASE_URL = 'http://10.0.2.2:8080/api/v1';

function normaliseBaseUrl(value: string): string {
  return value.trim().replace(/\/$/, '');
}

function configuredApiBaseUrls(): string[] {
  const extra = Constants.expoConfig?.extra;
  const configured: unknown = extra?.apiBaseUrls;

  if (Array.isArray(configured)) {
    const urls = configured
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .map(normaliseBaseUrl)
      .filter((value) => value.length > 0);

    if (urls.length > 0) return urls;
  }

  // The single-address setting is still accepted so older builds keep working.
  const legacy: unknown = extra?.apiBaseUrl;
  if (typeof legacy === 'string' && legacy.length > 0) {
    return [normaliseBaseUrl(legacy)];
  }

  return [DEFAULT_API_BASE_URL];
}

/** The ordered gateways from app.json, each ending in the API base path. */
export const apiBaseUrls = configuredApiBaseUrls();

/** The first configured gateway, kept for callers that expect a single address. */
export const apiBaseUrl = apiBaseUrls[0];

// openapi-fetch concatenates the base URL with the schema paths, and the schema already carries
// `/api/v1`, so the client takes the origin only. The failover fetch redirects each request to
// the gateway that is currently preferred.
const apiOrigin = gatewayOrigin(apiBaseUrl);
const failoverFetch = createFailoverFetch(apiBaseUrls);

export const api = createClient<paths>({ baseUrl: apiOrigin, fetch: failoverFetch });

/** A client that authenticates as the participant of one study. */
export function deviceClient(deviceToken: string) {
  return createClient<paths>({
    baseUrl: apiOrigin,
    fetch: failoverFetch,
    headers: { Authorization: `Device ${deviceToken}` },
  });
}

/** A client that authenticates with the participant account token. */
export function accountClient(accountToken: string) {
  return createClient<paths>({
    baseUrl: apiOrigin,
    fetch: failoverFetch,
    headers: { Authorization: `Account ${accountToken}` },
  });
}

/** A client that authenticates as a volunteer pool member. */
export function poolClient(credential: string) {
  return createClient<paths>({
    baseUrl: apiOrigin,
    fetch: failoverFetch,
    headers: { Authorization: `Pool ${credential}` },
  });
}

export async function deviceClientForStudy(studyId: string) {
  const deviceToken = await getDeviceToken(studyId);

  return deviceToken ? deviceClient(deviceToken) : null;
}

export type { components, paths } from './schema';
