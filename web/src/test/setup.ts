import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { prefsStore } from '../lib/i18n'

afterEach(() => {
  cleanup()
  sessionStorage.clear()
  localStorage.clear()
  prefsStore.set({ lang: 'es', theme: 'system' })
})

// jsdom no implementa <dialog>.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.open = true
}
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  this.open = false
}
