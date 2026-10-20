import { pt } from './pt'

export type TranslationKey = keyof typeof pt

export function t(key: TranslationKey, values?: Record<string, string | number>): string {
  const template = pt[key]
  if (!values) {
    return template
  }

  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = values[name]
    return value === undefined ? match : String(value)
  })
}
