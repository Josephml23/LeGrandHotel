import { useSyncExternalStore } from 'react'

/**
 * Estado del tutorial: ninguno, el general (las secciones del menú, al primer ingreso) o el de la
 * pantalla en la que está el usuario (sus botones, desde «¿Qué hago aquí?»). Lo dibuja <Tour>.
 */
export type ModoTour = null | 'general' | 'pagina'

let modo: ModoTour = null
const listeners = new Set<() => void>()
const avisar = () => listeners.forEach((listener) => listener())

export const tourStore = {
  get: () => modo,
  start(siguiente: Exclude<ModoTour, null> = 'general') {
    modo = siguiente
    avisar()
  },
  stop() {
    modo = null
    avisar()
  },
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}

export const useTourModo = () => useSyncExternalStore(tourStore.subscribe, tourStore.get, tourStore.get)
export const useTourActive = () => useTourModo() !== null
