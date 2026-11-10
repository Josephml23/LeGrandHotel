import { useSyncExternalStore } from 'react'

/**
 * Estado del tutorial de bienvenida: si está en curso. Se inicia desde el aviso del primer ingreso
 * o desde Configuración; lo dibuja <Tour> dentro del Layout.
 */
let active = false
const listeners = new Set<() => void>()

export const tourStore = {
  get: () => active,
  start() {
    active = true
    listeners.forEach((listener) => listener())
  },
  stop() {
    active = false
    listeners.forEach((listener) => listener())
  },
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}

export const useTourActive = () => useSyncExternalStore(tourStore.subscribe, tourStore.get, tourStore.get)
