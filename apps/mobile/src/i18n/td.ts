import { daily, type DailyTranslationKey } from '@/i18n/daily';

export type { DailyTranslationKey };

export function td(
  key: DailyTranslationKey,
  values?: Record<string, string | number>,
): string {
  let text: string = daily[key];

  if (values) {
    for (const [name, value] of Object.entries(values)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }

  return text;
}
