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
const PROFILE = { client: { id: 3, full_name: 'Ana Prueba Soto', document_number: '45678912', phone: '987654321', complete: true } }
const NAME_ONLY = { client: { id: 3, full_name: 'Ana Prueba', document_number: null, phone: null, complete: false } }
const offer = { id: 4, name: 'Suite', description: 'Con sala', amenities: ['Wi-Fi', 'Jacuzzi'], capacity: 4, price_per_night: '450.00', available_rooms: 1, nights: 2, total: '900.00' }

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

  it('al registrarse con Google se le ofrece completar sus datos, sin obligarlo', async () => {
    loginAs(['client'], true, { client: null })
    renderApp(<App />, '/')
    expect(await screen.findByRole('heading', { name: '¿Quieres completar tus datos ahora?' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Más tarde' }))
    expect(await screen.findByRole('heading', { name: 'Reservar una habitación' })).toBeInTheDocument()
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('si eligió "Más tarde", no se le vuelve a preguntar', async () => {
    localStorage.setItem('lgh.perfil-despues.1', '1')
    loginAs(['client'], true, { client: null })
    renderApp(<App />, '/')
    expect(await screen.findByRole('heading', { name: 'Reservar una habitación' })).toBeInTheDocument()
  })

  it('guarda el nombre completo, el DNI y el celular y lo lleva a reservar', async () => {
    loginAs(['client'], true, { client: null })
    sendMock.mockResolvedValueOnce({ id: 1, name: 'Ana Prueba Soto', email: 'ana@test.pe', email_verified: true, roles: ['client'], ...PROFILE })
    renderApp(<App />, '/completar-registro')

    const name = await screen.findByLabelText('Nombre completo')
    expect(name).toHaveValue('Ana Prueba')
    await userEvent.type(name, ' Soto')
    await userEvent.type(screen.getByLabelText('DNI'), '45678912')
    await userEvent.type(screen.getByLabelText('Celular'), '987654321')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar y continuar' }))

    await waitFor(() => expect(sendMock).toHaveBeenCalledWith('put', '/portal/profile', { full_name: 'Ana Prueba Soto', document_number: '45678912', phone: '987654321' }))
    expect(await screen.findByRole('heading', { name: 'Reservar una habitación' })).toBeInTheDocument()
  })

  it('Mi perfil muestra el correo de Google y deja agregar el DNI y el celular', async () => {
    loginAs(['client'], true, NAME_ONLY)
    sendMock.mockResolvedValueOnce({ id: 1, name: 'Ana Prueba', email: 'ana@test.pe', email_verified: true, roles: ['client'], ...PROFILE })
    renderApp(<App />, '/perfil')

    expect(await screen.findByLabelText('Correo de Google')).toHaveValue('ana@test.pe')
    expect(screen.getByText('Faltan datos para reservar')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('DNI'), '45678912')
    await userEvent.type(screen.getByLabelText('Celular'), '987654321')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(sendMock).toHaveBeenCalledWith('put', '/portal/profile', { full_name: 'Ana Prueba', document_number: '45678912', phone: '987654321' }))
    expect(await screen.findByText('Listo para reservar')).toBeInTheDocument()
  })

  it('al reservar con el perfil completo avisa a nombre de quién queda', async () => {
    loginAs(['client'], true, PROFILE)
    getListMock.mockResolvedValue({ data: [offer], meta: emptyMeta })
    renderApp(<App />, '/reservar')

    await userEvent.click(await screen.findByRole('button', { name: 'Reservar' }))
    expect(await screen.findByText(/a nombre de Ana Prueba Soto, DNI 45678912, celular 987654321/)).toBeInTheDocument()
    expect(screen.queryByLabelText('DNI')).not.toBeInTheDocument()
  })

  it('al reservar sin DNI ni celular los pide, los guarda y luego reserva', async () => {
    loginAs(['client'], true, NAME_ONLY)
    // Tras reservar lleva a Mis reservas, que se carga vacía.
    getListMock.mockImplementation(async (path) => ({ data: path === '/portal/room-types' ? [offer] : [], meta: emptyMeta }) as never)
    sendMock
      .mockResolvedValueOnce({ id: 1, name: 'Ana Prueba', email: 'ana@test.pe', email_verified: true, roles: ['client'], ...PROFILE })
      .mockResolvedValueOnce({ id: 9 })
    renderApp(<App />, '/reservar')

    await userEvent.click(await screen.findByRole('button', { name: 'Reservar' }))
    const confirm = await screen.findByRole('button', { name: 'Guardar datos y reservar' })
    expect(confirm).toBeDisabled()
    await userEvent.type(screen.getByLabelText('DNI'), '45678912')
    await userEvent.type(screen.getByLabelText('Celular'), '987654321')
    await userEvent.click(confirm)

    await waitFor(() => expect(sendMock).toHaveBeenNthCalledWith(1, 'put', '/portal/profile', { full_name: 'Ana Prueba', document_number: '45678912', phone: '987654321' }))
    expect(sendMock).toHaveBeenNthCalledWith(2, 'post', '/portal/reservations', expect.objectContaining({ room_type_id: 4 }))
  })

  it('muestra cada tipo con lo que incluye, cuántas quedan y el total', async () => {
    loginAs(['client'], true, PROFILE)
    getListMock.mockResolvedValue({ data: [offer], meta: emptyMeta })
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
