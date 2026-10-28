import { LANGUAGES, Segmented, themeOptions } from '../components/Preferences'
import { TitleRow } from '../components/ui'
import { prefsStore, t, usePrefs } from '../lib/i18n'

/** Configuración de la interfaz para todos los roles: tema e idioma, guardados en este navegador. */
export function SettingsPage() {
  const { lang, theme } = usePrefs()

  return (
    <>
      <TitleRow title={t('Configuración')} lede={t('Ajusta cómo se ve el sistema en este navegador. Los cambios se aplican al instante.')} />
      <div className="settings">
        <section className="setting">
          <div>
            <h2 className="section-title">{t('Tema')}</h2>
            <p className="muted small">{t('“Según el sistema” sigue el modo claro u oscuro de tu equipo.')}</p>
          </div>
          <Segmented label={t('Tema')} value={theme} options={themeOptions()} onChange={(next) => prefsStore.set({ theme: next })} />
        </section>
        <section className="setting">
          <div>
            <h2 className="section-title">{t('Idioma')}</h2>
            <p className="muted small">{t('Cambia los textos de la aplicación y los mensajes del servidor.')}</p>
          </div>
          <Segmented label={t('Idioma')} value={lang} options={LANGUAGES} onChange={(next) => prefsStore.set({ lang: next })} />
        </section>
      </div>
    </>
  )
}
