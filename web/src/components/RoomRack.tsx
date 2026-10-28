import { useNavigate } from 'react-router-dom'
import { ROOM_STATUS } from '../lib/format'
import { t } from '../lib/i18n'
import type { Room } from '../types'

/**
 * El rack de recepción: cada piso es una fila y cada habitación una celda con su estado.
 * Ocupada en el color del hotel, limpieza en ámbar, mantenimiento rayado, libre en blanco.
 */
export function RoomRack({ rooms, loading }: { rooms: Room[] | undefined; loading: boolean }) {
  const navigate = useNavigate()

  if (loading) {
    return <div className="rack" aria-busy="true">{[1, 2, 3, 4].map((f) => <span key={f} className="skeleton" style={{ height: 58 }} />)}</div>
  }
  if (!rooms?.length) return <p className="muted">{t('Aún no hay habitaciones registradas.')}</p>

  const floors = new Map<number, Room[]>()
  for (const room of rooms) floors.set(room.floor, [...(floors.get(room.floor) ?? []), room])
  const ordered = [...floors.entries()].sort(([a], [b]) => b - a)

  return (
    <>
      <div className="rack">
        {ordered.map(([floor, list]) => (
          <div className="rack-floor" key={floor}>
            <span>{t('Piso {floor}', { floor })}</span>
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
      <div className="legend" aria-hidden="true">
        <span><i style={{ background: 'var(--surface)' }} />{t('Libre')}</span>
        <span><i style={{ background: 'var(--accent)', borderColor: 'var(--accent)' }} />{t('Ocupada')}</span>
        <span><i style={{ background: 'var(--warning-soft)' }} />{t('Limpieza')}</span>
        <span><i style={{ background: 'repeating-linear-gradient(135deg,var(--stripe-a) 0 3px,var(--stripe-b) 3px 4px)' }} />{t('Mantenimiento')}</span>
      </div>
    </>
  )
}
