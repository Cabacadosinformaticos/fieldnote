import createClient from 'openapi-fetch'
import type { components, paths } from './schema'
import { getAccessToken, setAccessToken } from './tokens'

export type AuthUser = components['schemas']['UserOut']
export type TokenResponse = components['schemas']['TokenResponse']

type ErrorEnvelope = { error?: { code?: string; message?: string } }

async function readErrorCode(response: Response): Promise<string | null> {
  try {
    const body = (await response.clone().json()) as ErrorEnvelope
    return body.error?.code ?? null
  } catch {
    return null
  }
}

async function authFetch(input: Request): Promise<Response> {
  const request = input.clone()
  const token = getAccessToken()
  if (token) {
    request.headers.set('Authorization', `Bearer ${token}`)
  }

  let response = await fetch(request)
  if (response.status === 401 && (await readErrorCode(response)) === 'token_expired') {
    const session = await refreshSession()
    if (session) {
      const retry = input.clone()
      retry.headers.set('Authorization', `Bearer ${session.access_token}`)
      response = await fetch(retry)
    }
  }
  return response
}

const client = createClient<paths>({
  baseUrl: '/api/v1',
  credentials: 'include',
  fetch: authFetch,
})

let refreshPromise: Promise<TokenResponse | null> | null = null

// Concurrent callers (route guards, a retried request, StrictMode mounting twice) share the
// same rotation: the refresh token is single-use, so two parallel calls would look like reuse.
export function refreshSession(): Promise<TokenResponse | null> {
  if (!refreshPromise) {
    refreshPromise = client
      .POST('/auth/refresh')
      .then(({ data }) => {
        if (!data) {
          setAccessToken(null)
          return null
        }
        setAccessToken(data.access_token)
        return data
      })
      .catch(() => {
        setAccessToken(null)
        return null
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

export { client }
