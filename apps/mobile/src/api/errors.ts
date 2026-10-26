import { tj } from '@/i18n/tj';

type ApiErrorBody = {
  error?: {
    code?: string;
  };
};

/** Turns the API error body into a Portuguese message, without leaking server wording. */
export function apiErrorMessage(error: unknown): string {
  const code = (error as ApiErrorBody | undefined)?.error?.code;

  switch (code) {
    case 'invalid_code':
      return tj('error.invalidCode');
    case 'invalid_study_answer':
      return tj('error.invalidStudyAnswer');
    case 'invalid_availability':
      return tj('error.invalidAvailability');
    case 'account_required':
      return tj('error.accountRequired');
    case 'participation_removed':
      return tj('error.participationRemoved');
    case 'erasure_scheduled':
      return tj('error.erasureScheduled');
    case 'entry_declined':
      return tj('error.entryDeclined');
    default:
      return tj('error.generic');
  }
}

export function networkErrorMessage(): string {
  return tj('error.network');
}
