// The access token lives in memory only: a page reload restores the session through the
// HttpOnly refresh cookie instead of reading a token from storage.
let accessToken: string | null = null

export function getAccessToken(): string | null {
  return accessToken
}

export function setAccessToken(token: string | null): void {
  accessToken = token
}
