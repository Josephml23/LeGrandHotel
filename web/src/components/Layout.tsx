import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ROLE_LABELS, type RoleName } from '../types'
import { Mark } from './ui'

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
    ],
  },
  {
    group: 'Recepción',
    items: [
      { to: '/panel', label: 'Panel', roles: ['admin', 'receptionist', 'storekeeper'] },
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
]

export function Layout() {
  const { user, hasRole, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const [lastPath, setLastPath] = useState(location.pathname)

  // Cierra el menú del teléfono al navegar.
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname)
    if (open) setOpen(false)
  }

  if (!user) return null
  const roles = user.roles.map((r) => ROLE_LABELS[r]).join(' · ')

  return (
    <div className="shell">
      <NavLink to="/" className="brand" aria-label="LeGrandHotel, inicio">
        <Mark />
        <span>LeGrandHotel</span>
      </NavLink>

      <header className="topbar">
        <button className="btn btn-ghost menu-button" aria-expanded={open} aria-controls="sidebar" onClick={() => setOpen((v) => !v)}>
          Menú
        </button>
        <div className="who">
          <strong>{user.name}</strong>
          <span className="small muted">{roles}</span>
        </div>
        <button className="btn btn-sm" onClick={() => logout()}>Cerrar sesión</button>
      </header>

      <nav id="sidebar" className={`sidebar ${open ? 'open' : ''}`} aria-label="Principal">
        {NAV.map(({ group, items }) => {
          const visible = items.filter((item) => hasRole(...item.roles))
          if (visible.length === 0) return null
          return (
            <div key={group} style={{ display: 'contents' }}>
              <span className="group">{group}</span>
              {visible.map((item) => (
                <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  {item.label}
                </NavLink>
              ))}
            </div>
          )
        })}
      </nav>

      <main className="sheet">
        <Outlet />
      </main>
    </div>
  )
}
