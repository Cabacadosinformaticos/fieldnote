import { createContext } from 'react'
import type { AuthUser } from '../api/auth'

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

export type AuthContextValue = {
  status: AuthStatus
  user: AuthUser | null
  pendingEmail: string | null
  signIn: (email: string, password: string) => Promise<'authenticated' | 'totp_required'>
  signInTotp: (totpCode: string) => Promise<void>
  signOut: () => Promise<void>
  clearPasswordChange: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
