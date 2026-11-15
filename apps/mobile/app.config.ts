import type { ConfigContext, ExpoConfig } from 'expo/config';

function parseBaseUrls(value: string | undefined): string[] | undefined {
  if (!value) return undefined;

  const urls = value
    .split(',')
    .map((url) => url.trim().replace(/\/$/, ''))
    .filter((url) => url.length > 0);

  return urls.length > 0 ? urls : undefined;
}

/**
 * app.json holds the development gateways. A build for the servers replaces them without
 * editing app.json by setting FIELDNOTE_API_BASE_URLS to a comma separated list:
 *
 *   FIELDNOTE_API_BASE_URLS=https://gw1.example/api/v1,https://gw2.example/api/v1 npx expo config
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const extra = config.extra ?? {};
  const fromEnvironment = parseBaseUrls(process.env.FIELDNOTE_API_BASE_URLS);
  const apiBaseUrls: string[] | undefined =
    fromEnvironment ??
    (Array.isArray(extra.apiBaseUrls) ? extra.apiBaseUrls : undefined) ??
    (typeof extra.apiBaseUrl === 'string' ? [extra.apiBaseUrl] : undefined);

  return {
    ...config,
    name: config.name ?? 'Fieldnote',
    slug: config.slug ?? 'fieldnote',
    extra: {
      ...extra,
      ...(apiBaseUrls ? { apiBaseUrls } : {}),
    },
  };
};
