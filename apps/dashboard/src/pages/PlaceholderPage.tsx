import { t, type TranslationKey } from '../i18n'

export default function PlaceholderPage({ titleKey }: { titleKey: TranslationKey }) {
  return (
    <>
      <header className="page-header">
        <h1 className="page-title">{t(titleKey)}</h1>
      </header>
      <section className="card placeholder-card">
        <h2 className="h2">{t('common.underConstruction')}</h2>
      </section>
    </>
  )
}
