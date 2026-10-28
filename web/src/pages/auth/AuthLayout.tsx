import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Mark } from '../../components/ui'
import { LanguageSwitch } from '../../components/Preferences'

/** Mitad izquierda: la llave de habitación como motivo; mitad derecha: el formulario. */
export function AuthLayout({ heading, lede, children, wide }: { heading: string; lede: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className="auth">
      <aside className="auth-aside">
        <Link to="/" className="brand" aria-label="LeGrandHotel">
          <Mark size={30} />
          <span>LeGrandHotel</span>
        </Link>
        <div>
          <h2>{heading}</h2>
          <p>{lede}</p>
        </div>
        <svg className="auth-key" viewBox="0 0 200 200" aria-hidden="true">
          <circle cx="62" cy="62" r="46" fill="none" stroke="#fff" strokeWidth="18" />
          <path d="M94 94 L178 178 M150 150 L132 168 M166 166 L150 182" stroke="#fff" strokeWidth="18" strokeLinecap="round" />
        </svg>
      </aside>
      <main className="auth-main">
        <div className="auth-lang"><LanguageSwitch /></div>
        <div className={`auth-card enter ${wide ? 'wide' : ''}`}>{children}</div>
      </main>
    </div>
  )
}
