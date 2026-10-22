import { more, type MoreKey } from '@/i18n/more';

export type { MoreKey };

export function tm(
  key: MoreKey,
  values?: Record<string, string | number>,
): string {
  let text: string = more[key];

  if (values) {
    for (const [name, value] of Object.entries(values)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }

  return text;
}
