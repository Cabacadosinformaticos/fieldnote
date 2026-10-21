import { join, type JoinKey } from './join';

export function tj(key: JoinKey, values?: Record<string, string | number>): string {
  const template = join[key];

  if (!values) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = values[name];
    return value === undefined ? match : String(value);
  });
}
