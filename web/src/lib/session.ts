import type { Session } from '../types'

const KEY = 'lgh.session'

/** La sesión vive en sessionStorage: se borra al cerrar la pestaña. */
export const sessionStore = {
  read(): Session | null {
    try {
      const raw = sessionStorage.getItem(KEY)
      if (!raw) return null
      const session = JSON.parse(raw) as Session
      // Sesión a medio guardar (p. ej. el regreso de Google se interrumpió): se descarta en vez de romper la app.
      if (!session?.token || !Array.isArray(session.user?.roles)) {
        sessionStorage.removeItem(KEY)
        return null
      }
      if (session.expires_at && new Date(session.expires_at).getTime() <= Date.now()) {
        sessionStorage.removeItem(KEY)
        return null
      }
      return session
    } catch {
      return null
    }
  },
  write(session: Session) {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(session))
    } catch {
      /* almacenamiento bloqueado: la sesión dura lo que dure la página */
    }
  },
  clear() {
    try {
      sessionStorage.removeItem(KEY)
    } catch {
      /* nada que borrar */
    }
  },
}
