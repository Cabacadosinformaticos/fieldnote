import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import * as authApi from '../api/auth'
import type { AuthUser } from '../api/auth'
import { AuthContext, type AuthStatus } from './context'

type PendingSignIn = { email: string; password: string }

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [pending, setPending] = useState<PendingSignIn | null>(null)

  useEffect(() => {
    let active = true
    void authApi
      .refresh()
      .then((restored) => {
        if (!active) {
          return
        }
        setUser(restored)
        setStatus(restored ? 'authenticated' : 'anonymous')
      })
      .catch(() => {
        if (!active) {
          return
        }
        setUser(null)
        setStatus('anonymous')
      })
    return () => {
      active = false
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const outcome = await authApi.signIn(email, password)
    if (outcome.status === 'totp_required') {
      setPending({ email, password })
      return 'totp_required' as const
    }
    setPending(null)
    setUser(outcome.user)
    setStatus('authenticated')
    return 'authenticated' as const
  }, [])

  const signInTotp = useCallback(
    async (totpCode: string) => {
      if (!pending) {
        throw new authApi.AuthError(
          'totp_session_missing',
          401,
          'The sign-in was restarted. Enter the password again.',
        )
      }
      const nextUser = await authApi.signInTotp(pending.email, pending.password, totpCode)
      setPending(null)
      setUser(nextUser)
      setStatus('authenticated')
    },
    [pending],
  )

  const signOut = useCallback(async () => {
    try {
      await authApi.signOut()
    } finally {
      setPending(null)
      setUser(null)
      setStatus('anonymous')
    }
  }, [])

  const clearPasswordChange = useCallback(() => {
    setUser((current) =>
      current ? { ...current, must_change_password: false } : current,
    )
  }, [])

  const value = useMemo(
    () => ({
      status,
      user,
      pendingEmail: pending?.email ?? null,
      signIn,
      signInTotp,
      signOut,
      clearPasswordChange,
    }),
    [status, user, pending, signIn, signInTotp, signOut, clearPasswordChange],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
