/**
 * Eventos globales que emite el interceptor de Axios y escucha <AppEvents />.
 * Así el manejo de 401, 403, 429, 5xx y sin conexión vive en un solo lugar.
 */
export type AppEvent =
  | { type: 'session-expired' }
  | { type: 'forbidden' }
  | { type: 'rate-limited'; retryAfter: number }
  | { type: 'server-error'; incidentId?: string }
  | { type: 'service-unavailable'; reason: string; retryAfter: number }
  | { type: 'offline' }

type Listener = (event: AppEvent) => void
const listeners = new Set<Listener>()

export const appEvents = {
  emit(event: AppEvent) {
    listeners.forEach((listener) => listener(event))
  },
  on(listener: Listener) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}
