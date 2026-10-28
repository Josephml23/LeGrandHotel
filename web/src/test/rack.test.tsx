import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { App } from '../App'
import * as api from '../lib/api'
import type { Room } from '../types'
import { loginAs, renderApp } from './utils'

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>()
  return { ...actual, send: vi.fn(), getList: vi.fn(), getOne: vi.fn() }
})

const room = (id: number, number: string, floor: number, status: Room['status']) =>
  ({ id, number, floor, status, room_type_id: 1, room_type: { id: 1, name: 'Simple' } }) as Room

// Dos páginas: el tablero debe juntar las dos.
const PAGES: Record<number, Room[]> = {
  1: [room(1, '101', 1, 'available'), room(2, '102', 1, 'occupied')],
  2: [room(3, '201', 2, 'occupied'), room(4, '202', 2, 'cleaning')],
}

describe('tablero de habitaciones del panel', () => {
  it('trae todas las páginas y filtra por piso y por estado', async () => {
    loginAs(['admin'])
    vi.mocked(api.getOne).mockResolvedValue({})
    vi.mocked(api.getList).mockImplementation(async (path, params = {}) => {
      const data = path === '/rooms' ? PAGES[Number(params.page ?? 1)] : []
      return { data, meta: { page: 1, per_page: 50, total: 4, last_page: path === '/rooms' ? 2 : 1 } } as never
    })
    renderApp(<App />, '/panel')

    const rack = (await screen.findByRole('heading', { name: 'Tablero de habitaciones' })).closest('section') as HTMLElement
    expect(await within(rack).findByRole('button', { name: /Habitación 202/ })).toBeInTheDocument()
    expect(within(rack).getAllByRole('button', { name: /^Habitación/ })).toHaveLength(4)

    await userEvent.click(within(rack).getByRole('radio', { name: 'Ocupadas (2)' }))
    expect(within(rack).getAllByRole('button', { name: /^Habitación/ }).map((b) => b.textContent)).toEqual([expect.stringContaining('201'), expect.stringContaining('102')])

    await userEvent.selectOptions(within(rack).getByLabelText('Filtrar por piso'), '2')
    expect(within(rack).getAllByRole('button', { name: /^Habitación/ })).toHaveLength(1)
    expect(within(rack).getByRole('radio', { name: 'Todas (2)' })).toBeInTheDocument()

    await userEvent.click(within(rack).getByRole('radio', { name: 'Mantenimiento (0)' }))
    expect(within(rack).getByText('No hay habitaciones con este filtro.')).toBeInTheDocument()
  })
})
