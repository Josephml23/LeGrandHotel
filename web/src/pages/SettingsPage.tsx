import { LANGUAGES, Segmented, themeOptions } from '../components/Preferences'
import { TitleRow } from '../components/ui'
import { prefsStore, t, usePrefs } from '../lib/i18n'
import { tourStore } from '../lib/tour'

/** Configuración de la interfaz para todos los roles: tema e idioma (en este navegador) y el tutorial. */
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
        <section className="setting">
          <div>
            <h2 className="section-title">{t('Tutorial')}</h2>
            <p className="muted small">{t('Un recorrido corto que resalta cada sección que puedes usar.')}</p>
          </div>
          <button className="btn" onClick={() => tourStore.start()}>{t('Ver el tutorial')}</button>
        </section>
      </div>
    </>
  )
}
