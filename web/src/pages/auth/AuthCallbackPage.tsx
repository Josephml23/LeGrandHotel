import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { sessionStore } from '../../lib/session'
import { homeFor, useAuth } from '../../auth/AuthContext'
import type { AuthUser } from '../../types'

/**
 * Vuelta del login con Google: el token llega en el fragmento (#token=…),
 * que el navegador no envía a ningún servidor.
 */
export function AuthCallbackPage() {
  const { setSession } = useAuth()
  const navigate = useNavigate()
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    done.current = true
    const params = new URLSearchParams(window.location.hash.slice(1))
    const token = params.get('token')
    const expires = params.get('expires_at')
    window.history.replaceState(null, '', window.location.pathname)

    if (!token) {
      navigate('/login?error=google', { replace: true })
      return
    }

    sessionStore.write({ token, expires_at: expires, user: {} as AuthUser })
    api
      .get('/auth/me')
      .then(({ data }) => {
        const user = data.data as AuthUser
        setSession({ token, expires_at: expires, user })
        navigate(homeFor(user), { replace: true })
      })
      .catch(() => {
        sessionStore.clear()
        navigate('/login?error=google', { replace: true })
      })
  }, [navigate, setSession])

  return (
    <main className="status-screen full">
      <div className="status-copy">
        <h1>Conectando con Google…</h1>
        <p className="muted">Un momento, estamos abriendo tu sesión.</p>
      </div>
    </main>
  )
}
