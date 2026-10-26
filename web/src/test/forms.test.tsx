import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { App } from '../App'
import { ApiError } from '../lib/api'
import * as api from '../lib/api'
import { renderApp } from './utils'

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>()
  return { ...actual, send: vi.fn(), getList: vi.fn(), getOne: vi.fn() }
})

const sendMock = vi.mocked(api.send)

beforeEach(() => sendMock.mockReset())

describe('formularios de acceso', () => {
  it('login y registro son pantallas separadas', async () => {
    renderApp(<App />, '/login')
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: 'Crear cuenta' }))
    expect(await screen.findByRole('heading', { name: 'Crear cuenta de huésped' })).toBeInTheDocument()
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
    renderApp(<App />, '/registro')

    await userEvent.click(await screen.findByRole('button', { name: 'Crear cuenta' }))

    const email = screen.getByLabelText('Correo')
    await waitFor(() => expect(email).toHaveAttribute('aria-invalid', 'true'))
    expect(screen.getByText('El correo ya está registrado.')).toBeInTheDocument()
  })

  it('un login correcto guarda la sesión y entra al panel del rol', async () => {
    sendMock.mockResolvedValueOnce({
      token: 't', expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      user: { id: 1, name: 'Rosa', email: 'r@h.pe', email_verified: true, roles: ['client'], client_id: 3 },
    })
    vi.mocked(api.getList).mockResolvedValue({ data: [], meta: { page: 1, per_page: 15, total: 0, last_page: 1 } })
    renderApp(<App />, '/login')

    await userEvent.type(await screen.findByLabelText('Correo'), 'r@h.pe')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'Clave1234')
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(await screen.findByRole('heading', { name: 'Mis reservas' })).toBeInTheDocument()
    expect(JSON.parse(sessionStorage.getItem('lgh.session')!).token).toBe('t')
  })
})
