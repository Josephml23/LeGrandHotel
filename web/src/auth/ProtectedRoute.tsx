import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import type { RoleName } from '../types'
import { ForbiddenPage } from '../pages/errors/ErrorPages'

/**
 * Protege las rutas en el frontend: sin sesión → login; sin el rol → pantalla 403,
 * aunque la URL se escriba a mano. El backend valida lo mismo en cada endpoint.
 */
export function ProtectedRoute({ roles }: { roles?: RoleName[] }) {
  const { user, hasRole } = useAuth()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }

  if (roles && !hasRole(...roles)) {
    return <ForbiddenPage />
  }

  return <Outlet />
}

/** Login y registro: si ya hay sesión, no tiene sentido mostrarlos. */
export function GuestRoute() {
  const { user } = useAuth()
  return user ? <Navigate to="/" replace /> : <Outlet />
}
