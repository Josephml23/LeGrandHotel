import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ROLE_LABELS, type RoleName } from '../types'
import { Mark } from './ui'
import { Tour, TourPrompt } from './Tour'
import { t } from '../lib/i18n'
import { useTourActive } from '../lib/tour'

interface NavItem {
  to: string
  label: string
  roles: RoleName[]
}

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: 'Mi cuenta',
    items: [
      { to: '/reservar', label: 'Reservar', roles: ['client'] },
      { to: '/mis-reservas', label: 'Mis reservas', roles: ['client'] },
      { to: '/perfil', label: 'Mi perfil', roles: ['client'] },
    ],
  },
  {
    group: 'Inicio',
    items: [{ to: '/panel', label: 'Panel', roles: ['admin', 'receptionist', 'storekeeper'] }],
  },
  {
    group: 'Recepción',
    items: [
      { to: '/reservas', label: 'Reservas', roles: ['admin', 'receptionist'] },
      { to: '/estadias', label: 'Estadías', roles: ['admin', 'receptionist'] },
      { to: '/habitaciones', label: 'Habitaciones', roles: ['admin', 'receptionist'] },
      { to: '/tipos-habitacion', label: 'Tipos de habitación', roles: ['admin', 'receptionist'] },
      { to: '/clientes', label: 'Clientes', roles: ['admin', 'receptionist'] },
      { to: '/cochera', label: 'Cochera', roles: ['admin', 'receptionist'] },
    ],
  },
  {
    group: 'Almacén',
    items: [{ to: '/inventario', label: 'Inventario', roles: ['admin', 'storekeeper'] }],
  },
  {
    group: 'Administración',
    items: [
      { to: '/personal', label: 'Personal', roles: ['admin'] },
      { to: '/registro', label: 'Registrar personal', roles: ['admin', 'developer'] },
      { to: '/usuarios', label: 'Usuarios y roles', roles: ['admin'] },
      { to: '/reportes', label: 'Reportes', roles: ['admin'] },
      { to: '/auditoria', label: 'Auditoría', roles: ['admin'] },
      { to: '/facturacion', label: 'Facturación', roles: ['admin'] },
    ],
  },
  {
    group: 'Programador',
    items: [{ to: '/programador', label: 'Vista del programador', roles: ['developer', 'admin'] }],
  },
  {
    group: 'Preferencias',
    items: [{ to: '/configuracion', label: 'Configuración', roles: ['admin', 'receptionist', 'storekeeper', 'developer', 'client'] }],
  },
]

export function Layout() {
  const { user, hasRole, logout } = useAuth()
  const [menuOpen, setOpen] = useState(false)
  // Durante el tutorial el menú del teléfono queda abierto para poder resaltarlo.
  const touring = useTourActive()
  const open = menuOpen || touring
  const location = useLocation()
  const [lastPath, setLastPath] = useState(location.pathname)

  // Cierra el menú del teléfono al navegar.
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname)
    if (menuOpen) setOpen(false)
  }

  if (!user) return null
  const roles = user.roles.map((r) => ROLE_LABELS[r]).join(' · ')

  return (
    <div className="shell">
      <NavLink to="/" className="brand" aria-label={t('LeGrandHotel, inicio')}>
        <Mark />
        <span>LeGrandHotel</span>
      </NavLink>

      <header className="topbar">
        <button className="btn btn-ghost menu-button" aria-expanded={open} aria-controls="sidebar" onClick={() => setOpen((v) => !v)}>
          {t('Menú')}
        </button>
        <div className="who" data-tour="cuenta">
          <strong>{user.name}</strong>
          <span className="small muted">{roles}</span>
        </div>
        <button className="btn btn-sm" data-tour="cuenta" onClick={() => logout()}>{t('Cerrar sesión')}</button>
      </header>

      <nav id="sidebar" className={`sidebar ${open ? 'open' : ''}`} aria-label={t('Principal')}>
        {NAV.map(({ group, items }) => {
          const visible = items.filter((item) => hasRole(...item.roles))
          if (visible.length === 0) return null
          return (
            <div key={group} style={{ display: 'contents' }}>
              <span className="group">{t(group)}</span>
              {visible.map((item) => (
                <NavLink key={item.to} to={item.to} data-tour={item.to} data-tour-group={group} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  {t(item.label)}
                </NavLink>
              ))}
            </div>
          )
        })}
      </nav>

      <main className="sheet">
        <Outlet />
      </main>
      <TourPrompt />
      <Tour />
    </div>
  )
}
