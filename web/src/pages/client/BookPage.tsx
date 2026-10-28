import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getList, send } from '../../lib/api'
import { addDaysISO, formatDate, formatMoney, todayISO } from '../../lib/format'
import { t } from '../../lib/i18n'
import { useAuth } from '../../auth/AuthContext'
import { useToast } from '../../components/Toasts'
import { Field, FormError, Modal, SelectField, TitleRow } from '../../components/ui'
import type { AuthUser, Reservation, RoomTypeOffer } from '../../types'
import { ProfileFields, profileFrom, profilePayload, profileReady } from './ProfileFields'

const people = (n: number) => (n === 1 ? t('1 persona') : t('{n} personas', { n }))
const nightsLabel = (n: number) => (n === 1 ? t('1 noche') : t('{n} noches', { n }))

interface Search {
  from: string
  to: string
  guests: string
}

/**
 * El cliente elige fechas y cantidad de personas, y ve cada tipo de habitación con lo que incluye,
 * cuántas quedan libres y el total. Reserva por tipo: el hotel asigna el número de habitación.
 */
export function BookPage() {
  const [search, setSearch] = useState<Search>(() => ({ from: addDaysISO(todayISO(), 1), to: addDaysISO(todayISO(), 3), guests: '2' }))
  const [chosen, setChosen] = useState<RoomTypeOffer | null>(null)
  const validDates = search.from >= todayISO() && search.to > search.from

  const offers = useQuery({
    queryKey: ['portal-room-types', search],
    queryFn: () => getList<RoomTypeOffer>('/portal/room-types', { ...search, per_page: 50 }),
    enabled: validDates,
    placeholderData: keepPreviousData,
  })

  const setField = (key: keyof Search) => (e: { target: { value: string } }) => setSearch({ ...search, [key]: e.target.value })
  const types = offers.data?.data ?? []

  return (
    <>
      <TitleRow title={t('Reservar una habitación')} lede={t('Elige tus fechas y te mostramos los tipos de habitación libres, con lo que incluye cada uno y el total de tu estadía.')} />

      <div className="search-bar">
        <Field label={t('Llegada')} type="date" min={todayISO()} value={search.from} onChange={setField('from')} />
        <Field label={t('Salida')} type="date" min={addDaysISO(search.from, 1)} value={search.to} onChange={setField('to')}
          error={validDates ? undefined : t('La salida debe ser después de la llegada.')} />
        <SelectField label={t('Personas')} value={search.guests} onChange={setField('guests')}
          options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: people(n) }))} />
      </div>

      <FormError error={offers.error} />
      {offers.isLoading && <p className="muted">{t('Buscando habitaciones…')}</p>}
      {validDates && !offers.isLoading && types.length === 0 && !offers.error && (
        <p className="muted">{t('No hay tipos de habitación para {n} personas. Prueba con menos personas.', { n: search.guests })}</p>
      )}

      <div className="offers">
        {types.map((type) => (
          <article key={type.id} className="card offer">
            <div>
              <h3>{type.name}</h3>
              <p className="muted small" style={{ margin: '4px 0 0' }}>
                {t('{price} por noche · hasta {people}', { price: formatMoney(type.price_per_night), people: people(type.capacity) })}
              </p>
            </div>
            {type.description && <p style={{ margin: 0 }}>{type.description}</p>}
            {type.amenities.length > 0 && (
              <ul className="amenities" aria-label={t('Incluye la habitación {name}', { name: type.name })}>
                {type.amenities.map((a) => <li key={a}>{a}</li>)}
              </ul>
            )}
            <div className="price">
              <span className="muted small">
                {type.available_rooms === 0
                  ? t('Sin habitaciones libres')
                  : type.available_rooms === 1 ? t('1 libre') : t('{n} libres', { n: type.available_rooms })}
                {' · '}{nightsLabel(type.nights)}
              </span>
              <strong className="num">{formatMoney(type.total)}</strong>
            </div>
            <button className="btn btn-primary" disabled={type.available_rooms === 0} onClick={() => setChosen(type)}>
              {type.available_rooms === 0 ? t('Agotado') : t('Reservar')}
            </button>
          </article>
        ))}
      </div>

      {chosen && <ConfirmBooking key={chosen.id} offer={chosen} search={search} onClose={() => setChosen(null)} />}
    </>
  )
}

/**
 * Confirmación: si el perfil ya tiene nombre, DNI y celular, avisa a nombre de quién queda la reserva;
 * si falta algo, lo pide aquí mismo, lo guarda en el perfil y luego reserva.
 */
function ConfirmBooking({ offer, search, onClose }: { offer: RoomTypeOffer; search: Search; onClose: () => void }) {
  const { user, updateUser } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const complete = !!user?.client?.complete
  const [form, setForm] = useState(() => profileFrom(user))

  const saveProfile = useMutation({ mutationFn: () => send<AuthUser>('put', '/portal/profile', profilePayload(form)) })
  const book = useMutation({
    mutationFn: () => send<Reservation>('post', '/portal/reservations', {
      room_type_id: offer.id, check_in: search.from, check_out: search.to, guests: Number(search.guests),
    }),
  })

  const confirm = async () => {
    try {
      if (!complete) updateUser(await saveProfile.mutateAsync())
      await book.mutateAsync()
    } catch {
      return // el error se muestra en el formulario
    }
    queryClient.invalidateQueries({ queryKey: ['portal-room-types'] })
    queryClient.invalidateQueries({ queryKey: ['portal/reservations'] })
    toast(t('Reserva confirmada. Te esperamos.'))
    onClose()
    navigate('/mis-reservas')
  }

  const pending = saveProfile.isPending || book.isPending
  const canConfirm = complete || profileReady(form)

  return (
    <Modal open title={t('Confirmar reserva')} onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>{t('Volver')}</button>
        <button className="btn btn-primary" disabled={pending || !canConfirm} onClick={confirm}>
          {pending ? t('Reservando…') : complete ? t('Confirmar reserva') : t('Guardar datos y reservar')}
        </button>
      </>}>
      <div className="stack" style={{ gap: 12 }}>
        <FormError error={saveProfile.error ?? book.error} />
        <p style={{ margin: 0 }}><strong>{offer.name}</strong> · {people(Number(search.guests))}</p>
        <p className="muted" style={{ margin: 0 }}>{formatDate(search.from)} → {formatDate(search.to)} · {nightsLabel(offer.nights)}</p>
        <p style={{ margin: 0 }}>
          {t('Total:')} <strong className="num">{formatMoney(offer.total)}</strong>. {t('Se paga en recepción al llegar.')}
        </p>

        {complete && user?.client ? (
          <div className="notice">
            {t('La habitación se reservará a nombre de {name}, DNI {dni}, celular {phone}.', {
              name: user.client.full_name, dni: user.client.document_number ?? '', phone: user.client.phone ?? '',
            })}{' '}
            <Link to="/perfil" onClick={onClose}>{t('Cambiar mis datos')}</Link>
          </div>
        ) : (
          <>
            <div className="notice warning">{t('Para reservar necesitamos tu nombre completo, DNI y celular. Se guardarán en tu perfil.')}</div>
            <ProfileFields form={form} onChange={setForm} error={saveProfile.error} required />
          </>
        )}
      </div>
    </Modal>
  )
}
