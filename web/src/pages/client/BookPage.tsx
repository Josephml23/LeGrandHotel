import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getList, send } from '../../lib/api'
import { useAction } from '../../lib/hooks'
import { addDaysISO, formatDate, formatMoney, todayISO } from '../../lib/format'
import { useAuth } from '../../auth/AuthContext'
import { Field, FormError, Modal, SelectField, TitleRow } from '../../components/ui'
import type { Reservation, RoomTypeOffer } from '../../types'

/**
 * El cliente elige fechas y cantidad de personas, y ve cada tipo de habitación con lo que incluye,
 * cuántas quedan libres y el total. Reserva por tipo: el hotel asigna el número de habitación.
 */
export function BookPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [search, setSearch] = useState(() => ({ from: addDaysISO(todayISO(), 1), to: addDaysISO(todayISO(), 3), guests: '2' }))
  const [chosen, setChosen] = useState<RoomTypeOffer | null>(null)
  const validDates = search.from >= todayISO() && search.to > search.from

  const offers = useQuery({
    queryKey: ['portal-room-types', search],
    queryFn: () => getList<RoomTypeOffer>('/portal/room-types', { ...search, per_page: 50 }),
    enabled: validDates,
    placeholderData: keepPreviousData,
  })

  const book = useAction(
    (type: RoomTypeOffer) => send<Reservation>('post', '/portal/reservations', {
      room_type_id: type.id, check_in: search.from, check_out: search.to, guests: Number(search.guests),
    }),
    { invalidate: ['portal-room-types', 'portal/reservations'], success: 'Reserva confirmada. Te esperamos.' },
  )

  if (user && !user.client) return <Navigate to="/completar-registro" replace />

  const setField = (key: keyof typeof search) => (e: { target: { value: string } }) => setSearch({ ...search, [key]: e.target.value })
  const types = offers.data?.data ?? []

  return (
    <>
      <TitleRow title="Reservar una habitación" lede="Elige tus fechas y te mostramos los tipos de habitación libres, con lo que incluye cada uno y el total de tu estadía." />

      <div className="search-bar">
        <Field label="Llegada" type="date" min={todayISO()} value={search.from} onChange={setField('from')} />
        <Field label="Salida" type="date" min={addDaysISO(search.from, 1)} value={search.to} onChange={setField('to')}
          error={validDates ? undefined : 'La salida debe ser después de la llegada.'} />
        <SelectField label="Personas" value={search.guests} onChange={setField('guests')}
          options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: `${n} ${n === 1 ? 'persona' : 'personas'}` }))} />
      </div>

      <FormError error={offers.error} />
      {offers.isLoading && <p className="muted">Buscando habitaciones…</p>}
      {validDates && !offers.isLoading && types.length === 0 && !offers.error && (
        <p className="muted">No hay tipos de habitación para {search.guests} personas. Prueba con menos personas.</p>
      )}

      <div className="offers">
        {types.map((type) => (
          <article key={type.id} className="card offer">
            <div>
              <h3>{type.name}</h3>
              <p className="muted small" style={{ margin: '4px 0 0' }}>
                {formatMoney(type.price_per_night)} por noche · hasta {type.capacity} {type.capacity === 1 ? 'persona' : 'personas'}
              </p>
            </div>
            {type.description && <p style={{ margin: 0 }}>{type.description}</p>}
            {type.amenities.length > 0 && (
              <ul className="amenities" aria-label={`Incluye la habitación ${type.name}`}>
                {type.amenities.map((a) => <li key={a}>{a}</li>)}
              </ul>
            )}
            <div className="price">
              <span className="muted small">
                {type.available_rooms === 0 ? 'Sin habitaciones libres' : `${type.available_rooms} ${type.available_rooms === 1 ? 'libre' : 'libres'}`}
                {' · '}{type.nights} {type.nights === 1 ? 'noche' : 'noches'}
              </span>
              <strong className="num">{formatMoney(type.total)}</strong>
            </div>
            <button className="btn btn-primary" disabled={type.available_rooms === 0} onClick={() => { book.reset(); setChosen(type) }}>
              {type.available_rooms === 0 ? 'Agotado' : 'Reservar'}
            </button>
          </article>
        ))}
      </div>

      <Modal open={chosen !== null} title="Confirmar reserva" onClose={() => setChosen(null)}
        footer={<>
          <button className="btn" onClick={() => setChosen(null)}>Volver</button>
          <button className="btn btn-primary" disabled={book.isPending}
            onClick={() => chosen && book.mutate(chosen, { onSuccess: () => { setChosen(null); navigate('/mis-reservas') } })}>
            {book.isPending ? 'Reservando…' : 'Confirmar reserva'}
          </button>
        </>}>
        {chosen && (
          <div className="stack" style={{ gap: 8 }}>
            <FormError error={book.error} />
            <p style={{ margin: 0 }}><strong>{chosen.name}</strong> para {search.guests} {search.guests === '1' ? 'persona' : 'personas'}</p>
            <p className="muted" style={{ margin: 0 }}>{formatDate(search.from)} → {formatDate(search.to)} · {chosen.nights} {chosen.nights === 1 ? 'noche' : 'noches'}</p>
            <p style={{ margin: 0 }}>Total: <strong className="num">{formatMoney(chosen.total)}</strong>. Se paga en recepción al llegar.</p>
          </div>
        )}
      </Modal>
    </>
  )
}
