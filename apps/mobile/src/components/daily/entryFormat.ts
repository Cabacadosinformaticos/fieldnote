import { td } from '@/i18n/td';

const MONTHS_SHORT = [
  'jan.',
  'fev.',
  'mar.',
  'abr.',
  'mai.',
  'jun.',
  'jul.',
  'ago.',
  'set.',
  'out.',
  'nov.',
  'dez.',
];

const MONTHS_LONG = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

const WEEKDAYS = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
];

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function localDate(iso: string): Date {
  return new Date(iso);
}

function sameDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function clockOf(iso: string): string {
  const date = localDate(iso);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function shortDateOf(iso: string): string {
  const date = localDate(iso);
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
}

export function longDateToday(): string {
  const now = new Date();
  return `${WEEKDAYS[now.getDay()]}, ${now.getDate()} de ${MONTHS_LONG[now.getMonth()]}`;
}

export function formatRecorded(iso: string): string {
  const date = localDate(iso);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (sameDay(date, now)) {
    return td('entries.recordedAt', { time: clockOf(iso) });
  }
  if (sameDay(date, yesterday)) {
    return td('entries.recordedOnYesterday', { time: clockOf(iso) });
  }
  return td('entries.recordedOn', {
    date: shortDateOf(iso),
    time: clockOf(iso),
  });
}

export function formatFullRecorded(iso: string): string {
  const date = localDate(iso);
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}, ${clockOf(iso)}`;
}

export function formatReceived(iso: string): string {
  const date = localDate(iso);
  const now = new Date();
  if (sameDay(date, now)) {
    return td('entry.receivedToday', { time: clockOf(iso) });
  }
  return td('entry.receivedOn', {
    date: shortDateOf(iso),
    time: clockOf(iso),
  });
}

export function groupIdOf(iso: string): string {
  const date = localDate(iso);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function groupLabelOf(iso: string): string {
  const date = localDate(iso);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (sameDay(date, now)) {
    return td('entries.group.today');
  }
  if (sameDay(date, yesterday)) {
    return td('entries.group.yesterday');
  }
  return shortDateOf(iso);
}
