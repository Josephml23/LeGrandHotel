import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { App } from '../App'
import { en } from '../lib/i18n.en'
import { PrefsRoot, prefsStore, t } from '../lib/i18n'
import { formatMoney } from '../lib/format'
import { loginAs, renderApp } from './utils'

/** Todo el código fuente, para revisar que cada t('...') tenga su traducción. */
const sources = import.meta.glob(['../**/*.{ts,tsx}', '!../test/**', '!../lib/i18n.en.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>

describe('idioma', () => {
  it('cada texto t(...) del código tiene su traducción al inglés', () => {
    const missing = new Set<string>()
    for (const code of Object.values(sources)) {
      for (const match of code.matchAll(/\bt\('((?:[^'\\]|\\.)*)'/g)) {
        if (!(match[1] in en)) missing.add(match[1])
      }
    }
    expect([...missing]).toEqual([])
  })

  it('traduce, reemplaza variables y usa el formato del idioma', () => {
    expect(t('Espera {seconds} s', { seconds: 30 })).toBe('Espera 30 s')
    prefsStore.set({ lang: 'en' })
    expect(t('Espera {seconds} s', { seconds: 30 })).toBe('Wait 30 s')
    expect(t('Texto sin traducir')).toBe('Texto sin traducir')
    expect(formatMoney(1200)).toMatch(/^PEN\s1,200\.00$/)
  })

  it('el login cambia a inglés y lo recuerda en el navegador', async () => {
    renderApp(<PrefsRoot><App /></PrefsRoot>, '/login')
    await userEvent.click(await screen.findByRole('radio', { name: 'EN' }))

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Continue with Google' })).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('lgh.prefs')!).lang).toBe('en')
    expect(document.documentElement.lang).toBe('en')
  })

  it('Configuración cambia el tema y el idioma para cualquier rol', async () => {
    loginAs(['storekeeper'])
    renderApp(<PrefsRoot><App /></PrefsRoot>, '/configuracion')

    await userEvent.click(await screen.findByRole('radio', { name: 'Oscuro' }))
    expect(document.documentElement.dataset.theme).toBe('dark')

    await userEvent.click(screen.getByRole('radio', { name: 'English' }))
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument()
  })
})
