import { atom } from 'jotai'
import type { AuthType } from '@deskhand/shared/auth'
import type { Session, Message } from '@deskhand/shared/sessions'

/**
 * Auth state atom
 */
export interface AuthState {
  isConfigured: boolean
  authType: AuthType | null
  isLoading: boolean
}

export const authStateAtom = atom<AuthState>({
  isConfigured: false,
  authType: null,
  isLoading: true,
})

/**
 * Theme atom
 */
export type Theme = 'light' | 'dark'

export const themeAtom = atom<Theme>('light')

/**
 * Current session atom
 */
export interface CurrentSession {
  session: Session | null
  messages: Message[]
  isLoading: boolean
}

export const currentSessionAtom = atom<CurrentSession>({
  session: null,
  messages: [],
  isLoading: false,
})
