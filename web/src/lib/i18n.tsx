import { Fragment, useEffect, useSyncExternalStore, type ReactNode } from 'react'
import { en } from './i18n.en'

/**
 * Idioma y tema de la interfaz, guardados en el navegador (Configuración).
 * Los textos se escriben en español y `t()` los busca en el diccionario inglés (`i18n.en.ts`);
 * si falta una traducción se muestra el español. La API recibe el idioma en Accept-Language.
 */
export type Lang = 'es' | 'en'
export type Theme = 'light' | 'dark' | 'system'

interface Prefs {
  lang: Lang
  theme: Theme
}

const KEY = 'lgh.prefs'
const listeners = new Set<() => void>()

function load(): Prefs {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Prefs>
    return {
      lang: saved.lang === 'en' ? 'en' : 'es',
      theme: saved.theme === 'dark' || saved.theme === 'light' ? saved.theme : 'system',
    }
  } catch {
    return { lang: 'es', theme: 'system' }
  }
}

let prefs = load()

export const prefsStore = {
  get: () => prefs,
  set(next: Partial<Prefs>) {
    prefs = { ...prefs, ...next }
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs))
    } catch {
      /* almacenamiento bloqueado: la preferencia dura lo que dure la página */
    }
    listeners.forEach((listener) => listener())
  },
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}

/** Traduce un texto escrito en español; `{nombre}` se reemplaza con `vars.nombre`. */
export function t(text: string, vars?: Record<string, string | number>): string {
  const out = prefs.lang === 'en' ? (en[text] ?? text) : text
  return vars ? out.replace(/\{(\w+)\}/g, (match: string, name: string) => (name in vars ? String(vars[name]) : match)) : out
}

/** Mapa de etiquetas en español que se traducen al leerlas (sirve para constantes de módulo). */
export function translated<T extends Record<string, string>>(labels: T): T {
  return new Proxy(labels, {
    get: (target, key) => {
      const value = Reflect.get(target, key)
      return typeof value === 'string' ? t(value) : value
    },
  })
}

export const currentLang = (): Lang => prefs.lang

/** Locale de Intl para fechas, montos y números. */
export const intlLocale = (): string => (prefs.lang === 'en' ? 'en-US' : 'es-PE')

export function usePrefs(): Prefs {
  return useSyncExternalStore(prefsStore.subscribe, prefsStore.get)
}

const darkQuery = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null)

function applyTheme(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && !!darkQuery()?.matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
}

/**
 * Aplica el tema y el idioma. Al cambiar de idioma vuelve a montar la app para que
 * todos los textos se traduzcan (la caché de datos y la sesión se conservan).
 */
export function PrefsRoot({ children }: { children: ReactNode }) {
  const { lang, theme } = usePrefs()

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  useEffect(() => {
    applyTheme(theme)
    const query = darkQuery()
    if (theme !== 'system' || !query) return
    const follow = () => applyTheme('system')
    query.addEventListener?.('change', follow)
    return () => query.removeEventListener?.('change', follow)
  }, [theme])

  return <Fragment key={lang}>{children}</Fragment>
}
