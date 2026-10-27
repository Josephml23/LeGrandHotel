import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { App } from '../App'
import { ApiError } from '../lib/api'
import * as api from '../lib/api'
import { loginAs, renderApp } from './utils'

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>()
  return { ...actual, send: vi.fn(), getList: vi.fn(), getOne: vi.fn() }
})

const sendMock = vi.mocked(api.send)

beforeEach(() => sendMock.mockReset())

describe('formularios de acceso', () => {
  it('login y registro son pantallas separadas; el login no ofrece registro público', async () => {
    renderApp(<App />, '/login')
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /crear cuenta/i })).not.toBeInTheDocument()
  })

  it('sin sesión, /registro lleva al login: nadie de afuera puede registrarse', async () => {
    renderApp(<App />, '/registro')
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
  })

  it('el administrador registra cuentas del personal en su propia pantalla', async () => {
    loginAs(['admin'])
    sendMock.mockResolvedValueOnce({ id: 9, name: 'Rosa Díaz', email: 'rosa@hotel.pe', email_verified: false, roles: ['storekeeper'] })
    renderApp(<App />, '/registro')

    await userEvent.type(await screen.findByLabelText('Nombre completo'), 'Rosa Díaz')
    await userEvent.type(screen.getByLabelText('Correo'), 'rosa@hotel.pe')
    await userEvent.type(screen.getByLabelText('Contraseña inicial'), 'Clave1234')
    await userEvent.type(screen.getByLabelText('Repite la contraseña'), 'Clave1234')
    await userEvent.selectOptions(screen.getByLabelText('Rol'), 'storekeeper')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar cuenta' }))

    await waitFor(() => expect(sendMock).toHaveBeenCalledWith('post', '/auth/register', {
      name: 'Rosa Díaz', email: 'rosa@hotel.pe', password: 'Clave1234', password_confirmation: 'Clave1234', role: 'storekeeper',
    }))
  })

  it('un recepcionista no puede abrir el registro (403)', async () => {
    loginAs(['receptionist'])
    renderApp(<App />, '/registro')
    expect(await screen.findByRole('heading', { name: 'No tienes acceso a esta sección' })).toBeInTheDocument()
  })

  it('muestra el error de credenciales que devuelve la API', async () => {
    sendMock.mockRejectedValueOnce(new ApiError(401, 'INVALID_CREDENTIALS', 'Correo o contraseña incorrectos.'))
    renderApp(<App />, '/login')

    await userEvent.type(await screen.findByLabelText('Correo'), 'a@b.pe')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'mala')
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos.')
    expect(sendMock).toHaveBeenCalledWith('post', '/auth/login', { email: 'a@b.pe', password: 'mala' })
  })

  it('marca los campos inválidos del registro (422) junto a cada campo', async () => {
    sendMock.mockRejectedValueOnce(new ApiError(422, 'VALIDATION_FAILED', 'Los datos enviados no son válidos.', {
      email: ['El correo ya está registrado.'],
    }))
    loginAs(['admin'])
    renderApp(<App />, '/registro')

    await userEvent.click(await screen.findByRole('button', { name: 'Registrar cuenta' }))

    const email = screen.getByLabelText('Correo')
    await waitFor(() => expect(email).toHaveAttribute('aria-invalid', 'true'))
    expect(screen.getByText('El correo ya está registrado.')).toBeInTheDocument()
  })

  it('un login correcto guarda la sesión y entra al panel del rol', async () => {
    sendMock.mockResolvedValueOnce({
      token: 't', expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      user: { id: 1, name: 'Rosa', email: 'r@h.pe', email_verified: true, roles: ['receptionist'] },
    })
    vi.mocked(api.getList).mockResolvedValue({ data: [], meta: { page: 1, per_page: 15, total: 0, last_page: 1 } })
    vi.mocked(api.getOne).mockResolvedValue({})
    renderApp(<App />, '/login')

    await userEvent.type(await screen.findByLabelText('Correo'), 'r@h.pe')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'Clave1234')
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(await screen.findByRole('heading', { name: /Panel de Rosa/ })).toBeInTheDocument()
    expect(JSON.parse(sessionStorage.getItem('lgh.session')!).token).toBe('t')
  })
})
