import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { sessionStore } from '../lib/session'
import type { AuthUser, RoleName, Session } from '../types'

interface AuthState {
  session: Session | null
  user: AuthUser | null
  setSession: (session: Session) => void
  updateUser: (user: AuthUser) => void
  logout: () => Promise<void>
  clear: () => void
  hasRole: (...roles: RoleName[]) => boolean
}

const AuthContext = createContext<AuthState | null>(null)

/** Minutos antes del vencimiento en que se renueva el token. */
const REFRESH_MARGIN_MS = 5 * 60_000

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(() => sessionStore.read())
  const queryClient = useQueryClient()

  const setSession = useCallback((next: Session) => {
    sessionStore.write(next)
    setSessionState(next)
  }, [])

  const clear = useCallback(() => {
    sessionStore.clear()
    setSessionState(null)
    queryClient.clear()
  }, [queryClient])

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      /* el token pudo haber vencido: igual cerramos la sesión local */
    }
    clear()
  }, [clear])

  const updateUser = useCallback((user: AuthUser) => {
    setSessionState((current) => {
      if (!current) return current
      const next = { ...current, user }
      sessionStore.write(next)
      return next
    })
  }, [])

  // Renueva el token 5 minutos antes de que venza (POST /auth/refresh revoca el anterior).
  useEffect(() => {
    if (!session?.expires_at) return
    const wait = new Date(session.expires_at).getTime() - Date.now() - REFRESH_MARGIN_MS
    const timer = window.setTimeout(async () => {
      try {
        const { data } = await api.post('/auth/refresh')
        setSession(data.data as Session)
      } catch {
        /* si falla, el próximo 401 lleva a "Sesión expirada" */
      }
    }, Math.max(wait, 0))
    return () => window.clearTimeout(timer)
  }, [session?.expires_at, setSession])

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      setSession,
      updateUser,
      logout,
      clear,
      hasRole: (...roles) => !!session?.user.roles.some((r) => roles.includes(r)),
    }),
    [session, setSession, updateUser, logout, clear],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}

/** Ruta de inicio según el rol principal del usuario. */
export function homeFor(user: AuthUser | null): string {
  if (!user) return '/login'
  if (user.roles.includes('client') && user.roles.length === 1) return '/mis-reservas'
  return '/panel'
}
