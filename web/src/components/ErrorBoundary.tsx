import { Component, type ErrorInfo, type ReactNode } from 'react'
import { t } from '../lib/i18n'

interface State {
  error: Error | null
  incident: string
}

/**
 * Evita la pantalla en blanco: si un componente falla, muestra un error claro
 * con un código de incidente para reportarlo.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, incident: '' }

  static getDerivedStateFromError(error: Error): State {
    return { error, incident: `WEB-${Date.now().toString(36).toUpperCase()}` }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', this.state.incident, error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main className="status-screen full">
        <div className="status-code" aria-hidden="true">500</div>
        <div className="status-copy">
          <h1>{t('Algo se rompió en esta pantalla')}</h1>
          <p>{t('El resto del sistema sigue funcionando. Recarga la página; si vuelve a pasar, avisa a soporte con este código.')}</p>
          <p className="meta">{t('Código de incidente:')} <span className="mono">{this.state.incident}</span></p>
          <div className="actions">
            <button className="btn btn-primary" onClick={() => window.location.reload()}>{t('Recargar')}</button>
            <a className="btn" href="/">{t('Ir al inicio')}</a>
          </div>
        </div>
      </main>
    )
  }
}
