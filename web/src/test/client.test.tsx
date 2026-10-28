import { screen, waitFor, within } from '@testing-library/react'
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
const getListMock = vi.mocked(api.getList)
const emptyMeta = { page: 1, per_page: 15, total: 0, last_page: 1 }
const PROFILE = { client: { id: 3, document_number: '45678912', phone: '987654321' } }

beforeEach(() => {
  sendMock.mockReset()
  getListMock.mockReset()
  getListMock.mockResolvedValue({ data: [], meta: emptyMeta })
})

describe('cliente con Google', () => {
  it('el login ofrece Google solo como entrada de huéspedes', async () => {
    renderApp(<App />, '/login')
    expect(await screen.findByText('¿Eres huésped?')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Continuar con Google' })).toBeInTheDocument()
  })

  it('avisa al personal que no puede entrar con Google', async () => {
    renderApp(<App />, '/login?error=google_personal')
    expect(await screen.findByRole('alert')).toHaveTextContent('Ingresa con tu correo y contraseña')
  })

  it('un cliente sin DNI ni teléfono va primero a completar sus datos', async () => {
    loginAs(['client'], true, { client: null })
    renderApp(<App />, '/')
    expect(await screen.findByRole('heading', { name: 'Completa tus datos' })).toBeInTheDocument()
  })

  it('guarda el DNI y el teléfono y lo lleva a reservar', async () => {
    loginAs(['client'], true, { client: null })
    sendMock.mockResolvedValueOnce({ id: 1, name: 'Ana Prueba', email: 'ana@test.pe', email_verified: true, roles: ['client'], ...PROFILE })
    renderApp(<App />, '/completar-registro')

    await userEvent.type(await screen.findByLabelText('DNI'), '45678912')
    await userEvent.type(screen.getByLabelText('Teléfono'), '987654321')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar y continuar' }))

    await waitFor(() => expect(sendMock).toHaveBeenCalledWith('put', '/portal/profile', { document_number: '45678912', phone: '987654321' }))
    expect(await screen.findByRole('heading', { name: 'Reservar una habitación' })).toBeInTheDocument()
  })

  it('muestra cada tipo con lo que incluye, cuántas quedan y el total', async () => {
    loginAs(['client'], true, PROFILE)
    getListMock.mockResolvedValue({
      data: [{ id: 4, name: 'Suite', description: 'Con sala', amenities: ['Wi-Fi', 'Jacuzzi'], capacity: 4, price_per_night: '450.00', available_rooms: 1, nights: 2, total: '900.00' }],
      meta: emptyMeta,
    })
    renderApp(<App />, '/reservar')

    const card = (await screen.findByRole('heading', { name: 'Suite' })).closest('article') as HTMLElement
    const incluye = within(card).getByRole('list', { name: 'Incluye la habitación Suite' })
    expect(within(incluye).getByText('Jacuzzi')).toBeInTheDocument()
    expect(within(card).getByText(/1 libre/)).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'Reservar' })).toBeEnabled()
  })

  it('un cliente no entra a las pantallas del personal', async () => {
    loginAs(['client'], true, PROFILE)
    renderApp(<App />, '/panel')
    expect(await screen.findByRole('heading', { name: 'No tienes acceso a esta sección' })).toBeInTheDocument()
  })
})

describe('registro de personal', () => {
  it('el programador crea cuentas, pero no puede elegir Programador', async () => {
    loginAs(['developer'])
    renderApp(<App />, '/registro')

    const role = await screen.findByLabelText('Rol')
    const options = within(role).getAllByRole('option').map((o) => o.textContent)
    expect(options).toEqual(['Recepcionista', 'Almacenero', 'Administrador'])
  })

  it('el administrador tampoco crea Programadores: solo existe uno', async () => {
    loginAs(['admin'])
    renderApp(<App />, '/registro')

    const role = await screen.findByLabelText('Rol')
    const options = within(role).getAllByRole('option').map((o) => o.textContent)
    expect(options).toEqual(['Recepcionista', 'Almacenero', 'Administrador'])
  })
})
