# Fieldnote mobile app

Expo app for study participants. The screens are static for now; no API calls yet.

## Run on the Android emulator

```bash
cd apps/mobile
npm install
npx expo start
```

Press `a` in the terminal to open the app in a running Android emulator. Press `r` to reload.

## API gateways

`extra.apiBaseUrls` in `app.json` is the ordered list of gateways, each address ending in `/api/v1`. The app starts on the first one and, on a network error or an HTTP 502, 503 or 504, retries the request once on the next gateway. If that answers, it becomes the preferred gateway for later requests.

A build for the servers selects its gateways without editing `app.json`. Set `FIELDNOTE_API_BASE_URLS` to a comma separated list:

```bash
FIELDNOTE_API_BASE_URLS="https://fieldnote-gw1.<tailnet>.ts.net/api/v1,https://fieldnote-gw2.<tailnet>.ts.net/api/v1" npx expo start
```

Use the same variable for an EAS build, for example:

```bash
FIELDNOTE_API_BASE_URLS="https://fieldnote-gw1.<tailnet>.ts.net/api/v1,https://fieldnote-gw2.<tailnet>.ts.net/api/v1" npx eas build --profile preview
```
