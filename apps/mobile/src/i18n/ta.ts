import { account, type AccountKey } from '@/i18n/account';

export type { AccountKey };

export function ta(
  key: AccountKey,
  values?: Record<string, string | number>,
): string {
  let text: string = account[key];

  if (values) {
    for (const [name, value] of Object.entries(values)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }

  return text;
}
