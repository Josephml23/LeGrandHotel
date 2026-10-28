import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { api, send } from '../../lib/api'
import { homeFor, useAuth } from '../../auth/AuthContext'
import { FormError } from '../../components/ui'
import type { AuthUser } from '../../types'
import { t } from '../../lib/i18n'
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
      <AuthLayout heading={t('Correo verificado')} lede={t('Tu cuenta del personal está lista.')}>
        <h1>{t('¡Listo! Tu correo está verificado')}</h1>
        <Link className="btn btn-primary" to={user ? homeFor(user) : '/login'}>{user ? t('Ir al inicio') : t('Iniciar sesión')}</Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout heading={t('Un paso más')} lede={t('Verificamos tu correo para proteger tu cuenta.')}>
      <div>
        <h1>{t('Revisa tu correo')}</h1>
        <p className="muted">
          {status === 'invalid'
            ? t('El enlace no es válido o ya venció. Pide uno nuevo.')
            : user
              ? t('Te enviamos un enlace de verificación a {email}. Ábrelo para confirmar tu cuenta.', { email: user.email })
              : t('Te enviamos un enlace de verificación. Ábrelo para confirmar tu cuenta.')}
        </p>
      </div>
      <FormError error={resend.error} />
      {resend.isSuccess && <div className="form-ok" role="status">{t('Enlace reenviado. Revisa también la carpeta de spam.')}</div>}
      {user ? (
        <>
          <button className="btn btn-primary" onClick={() => resend.mutate()} disabled={resend.isPending}>
            {resend.isPending ? t('Enviando…') : t('Reenviar enlace')}
          </button>
          <Link className="btn" to={homeFor(user)}>{t('Continuar sin verificar')}</Link>
        </>
      ) : (
        <Link className="btn btn-primary" to="/login">{t('Iniciar sesión')}</Link>
      )}
    </AuthLayout>
  )
}
