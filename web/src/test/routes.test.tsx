import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { App } from '../App'
import { loginAs, renderApp } from './utils'

// La API no se llama en estas pruebas: devolvemos listas vacías.
vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>()
  return {
    ...actual,
    getList: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, per_page: 15, total: 0, last_page: 1 } }),
    getOne: vi.fn().mockResolvedValue({}),
  }
})

describe('rutas protegidas', () => {
  it('sin sesión, una ruta privada redirige al login', async () => {
    renderApp(<App />, '/reservas')
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
  })

  it('un recepcionista que escribe /personal a mano ve la pantalla 403', async () => {
    loginAs(['receptionist'])
    renderApp(<App />, '/personal')
    expect(await screen.findByRole('heading', { name: 'No tienes acceso a esta sección' })).toBeInTheDocument()
  })

  it('un almacenero no entra a reservas', async () => {
    loginAs(['storekeeper'])
    renderApp(<App />, '/reservas')
    expect(await screen.findByText('No tienes acceso a esta sección')).toBeInTheDocument()
  })

  it('el administrador sí entra a personal', async () => {
    loginAs(['admin'])
    renderApp(<App />, '/personal')
    expect(await screen.findByRole('heading', { name: 'Personal' })).toBeInTheDocument()
  })

  it('el menú solo muestra los módulos del rol', async () => {
    loginAs(['storekeeper'])
    renderApp(<App />, '/inventario')
    expect(await screen.findByRole('link', { name: 'Inventario' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Reservas' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Personal' })).not.toBeInTheDocument()
  })

  it('una ruta inexistente muestra la página 404', async () => {
    renderApp(<App />, '/no-existe')
    expect(await screen.findByRole('heading', { name: 'Esta habitación no existe' })).toBeInTheDocument()
  })

  it('un módulo pendiente muestra "En construcción"', async () => {
    loginAs(['admin'])
    renderApp(<App />, '/facturacion')
    expect(await screen.findByRole('heading', { name: /está en construcción/ })).toBeInTheDocument()
  })

  it('con el token vencido la sesión no se restaura', async () => {
    sessionStorage.setItem('lgh.session', JSON.stringify({ token: 'x', expires_at: new Date(Date.now() - 1000).toISOString(), user: { roles: ['admin'] } }))
    renderApp(<App />, '/panel')
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
  })
})

describe('vista del programador', () => {
  it('el programador entra a su vista y no a recepción', async () => {
    loginAs(['developer'])
    renderApp(<App />, '/programador')
    expect(await screen.findByRole('heading', { name: 'Vista del programador' })).toBeInTheDocument()
  })

  it('un recepcionista no puede abrir la vista del programador', async () => {
    loginAs(['receptionist'])
    renderApp(<App />, '/programador')
    expect(await screen.findByRole('heading', { name: 'No tienes acceso a esta sección' })).toBeInTheDocument()
  })
})
