import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROOM_STATUS } from '../lib/format'
import { t } from '../lib/i18n'
import type { Room, RoomStatus } from '../types'
import { Segmented } from './Preferences'

const STATUS_FILTERS: { value: '' | RoomStatus; label: string }[] = [
  { value: '', label: 'Todas' },
  { value: 'available', label: 'Libres' },
  { value: 'occupied', label: 'Ocupadas' },
  { value: 'cleaning', label: 'En limpieza' },
  { value: 'maintenance', label: 'Mantenimiento' },
]

/**
 * El rack de recepción: cada piso es una fila y cada habitación una celda con su estado.
 * Ocupada en el color del hotel, limpieza en ámbar, mantenimiento rayado, libre en blanco.
 * Se filtra por piso y por estado sin volver a pedir datos (llegan todas las habitaciones).
 */
export function RoomRack({ rooms, loading }: { rooms: Room[] | undefined; loading: boolean }) {
  const navigate = useNavigate()
  const [floor, setFloor] = useState('')
  const [status, setStatus] = useState<'' | RoomStatus>('')

  if (loading) {
    return <div className="rack" aria-busy="true">{[1, 2, 3, 4].map((f) => <span key={f} className="skeleton" style={{ height: 58 }} />)}</div>
  }
  if (!rooms?.length) return <p className="muted">{t('Aún no hay habitaciones registradas.')}</p>

  const floorNumbers = [...new Set(rooms.map((r) => r.floor))].sort((a, b) => b - a)
  const onFloor = floor === '' ? rooms : rooms.filter((r) => r.floor === Number(floor))
  const shown = status === '' ? onFloor : onFloor.filter((r) => r.status === status)
  const count = (value: '' | RoomStatus) => (value === '' ? onFloor.length : onFloor.filter((r) => r.status === value).length)

  const floors = new Map<number, Room[]>()
  for (const room of shown) floors.set(room.floor, [...(floors.get(room.floor) ?? []), room])
  const ordered = [...floors.entries()].sort(([a], [b]) => b - a)

  return (
    <>
      <div className="rack-filters">
        <select className="select" aria-label={t('Filtrar por piso')} value={floor} onChange={(e) => setFloor(e.target.value)}>
          <option value="">{t('Todos los pisos')}</option>
          {floorNumbers.map((f) => <option key={f} value={f}>{t('Piso {floor}', { floor: f })}</option>)}
        </select>
        <Segmented compact label={t('Filtrar por estado')} value={status} onChange={setStatus}
          options={STATUS_FILTERS.map((s) => ({ value: s.value, label: `${t(s.label)} (${count(s.value)})` }))} />
      </div>
      {ordered.length === 0 ? (
        <p className="muted" style={{ padding: '12px 0' }}>{t('No hay habitaciones con este filtro.')}</p>
      ) : (
        <div className="rack">
          {ordered.map(([floorNumber, list]) => (
            <div className="rack-floor" key={floorNumber}>
              <span>{t('Piso {floor}', { floor: floorNumber })}</span>
              <div className="rack-rooms">
                {list.map((room) => (
                  <button
                    key={room.id}
                    className={`rack-room ${room.status}`}
                    onClick={() => navigate('/habitaciones', { state: { edit: room } })}
                    aria-label={`${t('Habitación {number}', { number: room.number })}, ${room.room_type?.name ?? ''}, ${ROOM_STATUS[room.status].label}`}
                  >
                    <strong className="num">{room.number}</strong>
                    <small>{room.room_type?.name} · {ROOM_STATUS[room.status].label}</small>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="legend" aria-hidden="true">
        <span><i style={{ background: 'var(--surface)' }} />{t('Libre')}</span>
        <span><i style={{ background: 'var(--accent)', borderColor: 'var(--accent)' }} />{t('Ocupada')}</span>
        <span><i style={{ background: 'var(--warning-soft)' }} />{t('Limpieza')}</span>
        <span><i style={{ background: 'repeating-linear-gradient(135deg,var(--stripe-a) 0 3px,var(--stripe-b) 3px 4px)' }} />{t('Mantenimiento')}</span>
      </div>
    </>
  )
}
