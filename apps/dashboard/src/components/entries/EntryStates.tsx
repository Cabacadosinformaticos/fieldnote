import { EntriesApiError } from '../../api/entries'
import { t } from '../../i18n/entries'
import { AlertTriangleIcon, RefreshIcon } from './EntryIcons'

export function entriesErrorMessage(error: unknown): string {
  if (error instanceof EntriesApiError) {
    switch (error.code) {
      case 'not_found':
        return t('error.notFound')
      case 'forbidden':
        return t('error.forbidden')
      case 'invalid_cursor':
        return t('list.invalidCursor')
      case 'unauthorized':
      case 'token_expired':
      case 'token_invalid':
        return t('error.session')
      default:
        return t('error.generic', { code: error.code })
    }
  }
  return t('error.generic', { code: 'network' })
}

export function EntryErrorState({
  error,
  onRetry,
}: {
  error: unknown
  onRetry?: () => void
}) {
  return (
    <div className="en-state en-state-error" role="alert">
      <AlertTriangleIcon width={26} height={26} />
      <span>{entriesErrorMessage(error)}</span>
      {onRetry ? (
        <button type="button" className="btn btn-sm" onClick={onRetry}>
          <RefreshIcon width={16} height={16} />
          {t('list.retry')}
        </button>
      ) : null}
    </div>
  )
}

export function EntryLoadingState({ label = t('list.loading') }: { label?: string }) {
  return (
    <div className="en-state" aria-busy="true">
      <RefreshIcon width={26} height={26} />
      <span>{label}</span>
    </div>
  )
}
