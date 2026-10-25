import { client, refreshSession, type AuthUser } from './client'
import { setAccessToken } from './tokens'

export type { AuthUser }

export type SignInOutcome =
  | { status: 'authenticated'; user: AuthUser }
  | { status: 'totp_required' }

export class AuthError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, status: number, message: string) {
    super(message)
    this.name = 'AuthError'
    this.code = code
    this.status = status
  }
}

type ErrorEnvelope = { error?: { code?: string; message?: string } }

function toAuthError(error: unknown, response: Response): AuthError {
  const body = error as ErrorEnvelope | undefined
  return new AuthError(
    body?.error?.code ?? `http_${response.status}`,
    response.status,
    body?.error?.message ?? response.statusText,
  )
}

async function login(email: string, password: string, totpCode?: string): Promise<AuthUser> {
  const { data, error, response } = await client.POST('/auth/login', {
    body: { email, password, totp_code: totpCode },
  })
  if (data) {
    setAccessToken(data.access_token)
    return data.user
  }
  throw toAuthError(error, response)
}

export async function signIn(email: string, password: string): Promise<SignInOutcome> {
  try {
    const user = await login(email, password)
    return { status: 'authenticated', user }
  } catch (error) {
    if (error instanceof AuthError && error.code === 'totp_required') {
      return { status: 'totp_required' }
    }
    throw error
  }
}

export async function signInTotp(
  email: string,
  password: string,
  totpCode: string,
): Promise<AuthUser> {
  return login(email, password, totpCode)
}

export async function refresh(): Promise<AuthUser | null> {
  const session = await refreshSession()
  return session?.user ?? null
}

export async function signOut(): Promise<void> {
  try {
    await client.POST('/auth/logout')
  } finally {
    setAccessToken(null)
  }
}

export async function me(): Promise<AuthUser> {
  const { data, error, response } = await client.GET('/auth/me')
  if (data) {
    return data
  }
  throw toAuthError(error, response)
}
