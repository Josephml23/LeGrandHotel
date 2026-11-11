import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App'
import * as api from '../lib/api'
import { tutorialDe } from '../lib/tutoriales'
import { tourStore } from '../lib/tour'
import { loginAs, renderApp } from './utils'

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>()
  return { ...actual, send: vi.fn(), getList: vi.fn(), getOne: vi.fn() }
})

const sendMock = vi.mocked(api.send)
const seen = { id: 1, name: 'Ana Prueba', email: 'ana@test.pe', email_verified: true, roles: ['storekeeper'], tutorial_seen: true }

beforeEach(() => {
  tourStore.stop()
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
    expect(titles).toEqual(['Hola, Ana', 'Panel', 'Almacén', 'Configuración', 'Tu cuenta', 'El botón «?»', '¡Listo!'])
    await waitFor(() => expect(sendMock).toHaveBeenCalledWith('post', '/auth/tutorial', { outcome: 'completed' }))
  })

  it('Configuración permite repetirlo y Esc lo cierra', async () => {
    loginAs(['client'], true, { tutorial_seen: true, client: null })
    renderApp(<App />, '/configuracion')

    await userEvent.click(await screen.findByRole('button', { name: 'Ver el tutorial' }))
    expect(await screen.findByText('Paso 1 de 8')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByRole('heading', { name: 'Reservar' })).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByText(/Paso \d de 8/)).not.toBeInTheDocument()
  })
})

describe('tutorial de cada pestaña', () => {
  it('el botón «¿Qué hago aquí?» recorre los botones de esa pantalla', async () => {
    loginAs(['admin'], true, { tutorial_seen: true })
    // Con una habitación en la tabla aparecen también los botones de cada fila.
    vi.mocked(api.getList).mockResolvedValue({
      data: [{ id: 1, number: '101', floor: 1, status: 'cleaning', room_type_id: 1, room_type: { id: 1, name: 'Simple', capacity: 1, price_per_night: '120.00' } }],
      meta: { page: 1, per_page: 15, total: 1, last_page: 1 },
    } as never)
    renderApp(<App />, '/habitaciones')

    await userEvent.click(await screen.findByRole('button', { name: '¿Qué hago aquí?' }))

    const titulos: string[] = []
    for (;;) {
      // Dentro de la burbuja: fuera también hay un «Siguiente», el del paginado.
      const burbuja = within(await screen.findByRole('dialog', { name: /.+/ }))
      titulos.push(burbuja.getByRole('heading').textContent!)
      const terminar = burbuja.queryByRole('button', { name: 'Terminar' })
      await userEvent.click(terminar ?? burbuja.getByRole('button', { name: 'Siguiente' }))
      if (terminar) break
    }

    expect(titulos).toEqual(['Habitaciones', 'Nueva habitación', 'Filtros por estado', 'Botones de cada habitación'])
    // El tutorial de una pantalla se puede repetir: no marca la cuenta como «ya lo vio».
    expect(sendMock).not.toHaveBeenCalledWith('post', '/auth/tutorial', expect.anything())
  })

  it('las pantallas sin tutorial no muestran el botón', async () => {
    loginAs(['admin'], true, { tutorial_seen: true })
    renderApp(<App />, '/403')

    expect(await screen.findByRole('heading', { name: 'No tienes acceso a esta sección' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '¿Qué hago aquí?' })).not.toBeInTheDocument()
  })
})

describe('tutoriales del cliente', () => {
  it('reservar y ver sus reservas tienen su propio recorrido', () => {
    const reservar = tutorialDe('/reservar')
    expect(reservar?.map((p) => p.title)).toEqual(['Reservar una habitación', '1. Tus fechas', '2. Lo que hay libre', '3. Reservar', 'Y después'])

    const misReservas = tutorialDe('/mis-reservas')
    expect(misReservas?.map((p) => p.title)).toEqual(['Mis reservas', 'Lo que ves de cada una', 'Cancelar', 'Páginas'])

    // Las pantallas que se quitaron ya no tienen tutorial.
    expect(tutorialDe('/registro')).toBeNull()
    expect(tutorialDe('/personal')).toBeNull()
    expect(tutorialDe('/facturacion')).toBeNull()
  })
})
