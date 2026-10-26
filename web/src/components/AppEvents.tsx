import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { appEvents } from '../lib/events'
import { useAuth } from '../auth/AuthContext'
import { OfflineScreen } from '../pages/errors/ErrorPages'

/**
 * Traduce los eventos del interceptor HTTP en pantallas: sesión expirada, 403, 429, 500, 503
 * y sin conexión. Si el navegador pierde internet, la app queda tapada hasta que vuelve.
 */
export function AppEvents({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const { clear } = useAuth()
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  useEffect(
    () =>
      appEvents.on((event) => {
        switch (event.type) {
          case 'session-expired':
            clear()
            navigate('/sesion-expirada', { replace: true })
            break
          case 'forbidden':
            navigate('/403')
            break
          case 'rate-limited':
            navigate(`/demasiadas-peticiones?espera=${event.retryAfter}`)
            break
          case 'server-error':
            navigate(`/500${event.incidentId ? `?incidente=${encodeURIComponent(event.incidentId)}` : ''}`)
            break
          case 'service-unavailable':
            navigate(`/503?motivo=${encodeURIComponent(event.reason)}&reintento=${event.retryAfter}`)
            break
          case 'offline':
            setOnline(false)
            break
        }
      }),
    [navigate, clear],
  )

  // La app sigue montada debajo: lo escrito en un formulario no se pierde.
  return (
    <>
      <div {...(online ? {} : ({ inert: '' } as Record<string, string>))}>{children}</div>
      {!online && (
        <div className="offline-overlay" role="alertdialog" aria-modal="true">
          <OfflineScreen />
        </div>
      )}
    </>
  )
}
