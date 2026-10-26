import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { api, send } from '../../lib/api'
import { homeFor, useAuth } from '../../auth/AuthContext'
import { FormError } from '../../components/ui'
import type { AuthUser } from '../../types'
import { AuthLayout } from './AuthLayout'

export function VerifyEmailPage() {
  const { user, updateUser } = useAuth()
  const [params] = useSearchParams()
  const status = params.get('status')

  const resend = useMutation({ mutationFn: () => send('post', '/email/verification-notification') })

  // Al volver del enlace del correo, refresca el usuario para quitar el aviso.
  useEffect(() => {
    if (status === 'verified' && user) {
      api.get('/auth/me').then(({ data }) => updateUser(data.data as AuthUser)).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  if (status === 'verified') {
    return (
      <AuthLayout heading="Correo verificado" lede="Ya puedes reservar habitaciones desde tu cuenta.">
        <h1>¡Listo! Tu correo está verificado</h1>
        <Link className="btn btn-primary" to={user ? homeFor(user) : '/login'}>{user ? 'Ir a mis reservas' : 'Iniciar sesión'}</Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout heading="Un paso más" lede="Verificamos tu correo para proteger tus reservas.">
      <div>
        <h1>Revisa tu correo</h1>
        <p className="muted">
          {status === 'invalid'
            ? 'El enlace no es válido o ya venció. Pide uno nuevo.'
            : `Te enviamos un enlace de verificación${user ? ` a ${user.email}` : ''}. Ábrelo para activar las reservas.`}
        </p>
      </div>
      <FormError error={resend.error} />
      {resend.isSuccess && <div className="form-ok" role="status">Enlace reenviado. Revisa también la carpeta de spam.</div>}
      {user ? (
        <>
          <button className="btn btn-primary" onClick={() => resend.mutate()} disabled={resend.isPending}>
            {resend.isPending ? 'Enviando…' : 'Reenviar enlace'}
          </button>
          <Link className="btn" to={homeFor(user)}>Continuar sin verificar</Link>
        </>
      ) : (
        <Link className="btn btn-primary" to="/login">Iniciar sesión</Link>
      )}
    </AuthLayout>
  )
}
