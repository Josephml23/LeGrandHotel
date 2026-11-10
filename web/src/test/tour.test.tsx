import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App'
import * as api from '../lib/api'
import { loginAs, renderApp } from './utils'

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>()
  return { ...actual, send: vi.fn(), getList: vi.fn(), getOne: vi.fn() }
})

const sendMock = vi.mocked(api.send)
const seen = { id: 1, name: 'Ana Prueba', email: 'ana@test.pe', email_verified: true, roles: ['storekeeper'], tutorial_seen: true }

beforeEach(() => {
  sendMock.mockReset()
  sendMock.mockResolvedValue(seen)
  vi.mocked(api.getOne).mockResolvedValue({})
  vi.mocked(api.getList).mockResolvedValue({ data: [], meta: { page: 1, per_page: 15, total: 0, last_page: 1 } })
})

describe('tutorial de bienvenida', () => {
  it('a una cuenta nueva le pregunta, y si lo omite no se lo vuelve a ofrecer', async () => {
    loginAs(['storekeeper'], true, { tutorial_seen: false })
    renderApp(<App />, '/panel')

    expect(await screen.findByRole('heading', { name: '¿Quieres hacer el tutorial?' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Omitir' }))

    await waitFor(() => expect(sendMock).toHaveBeenCalledWith('post', '/auth/tutorial', { outcome: 'skipped' }))
    expect(screen.queryByRole('heading', { name: '¿Quieres hacer el tutorial?' })).not.toBeInTheDocument()
  })

  it('recorre solo las secciones de su rol y al terminar lo guarda', async () => {
    loginAs(['storekeeper'], true, { tutorial_seen: false })
    renderApp(<App />, '/panel')

    await userEvent.click(await screen.findByRole('button', { name: 'Hacer el tutorial' }))
    const titles: string[] = []
    for (;;) {
      const dialog = await screen.findByRole('dialog', { name: /.+/ })
      titles.push(dialog.querySelector('h2')!.textContent!)
      const finish = screen.queryByRole('button', { name: 'Terminar' })
      if (finish) {
        await userEvent.click(finish)
        break
      }
      await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    }

    // El almacenero ve Panel y Almacén; no Recepción ni Administración.
    expect(titles).toEqual(['Hola, Ana', 'Panel', 'Almacén', 'Configuración', 'Tu cuenta', '¡Listo!'])
    await waitFor(() => expect(sendMock).toHaveBeenCalledWith('post', '/auth/tutorial', { outcome: 'completed' }))
  })

  it('Configuración permite repetirlo y Esc lo cierra', async () => {
    loginAs(['client'], true, { tutorial_seen: true, client: null })
    renderApp(<App />, '/configuracion')

    await userEvent.click(await screen.findByRole('button', { name: 'Ver el tutorial' }))
    expect(await screen.findByText('Paso 1 de 7')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByRole('heading', { name: 'Reservar' })).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByText(/Paso \d de 7/)).not.toBeInTheDocument()
  })
})
