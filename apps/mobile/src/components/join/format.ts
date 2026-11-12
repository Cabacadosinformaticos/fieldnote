import type { JoinKey } from '@/i18n/join';
import { tj } from '@/i18n/tj';

const MONTHS = [
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

const DAY_MS = 24 * 60 * 60 * 1000;

const ENTRY_TYPE_LABELS: Record<string, JoinKey> = {
  text: 'entryType.text',
  photo: 'entryType.photo',
  video: 'entryType.video',
  audio: 'entryType.audio',
  scale: 'entryType.scale',
  choice: 'entryType.choice',
};

function parseDate(value: string): Date {
  return value.length <= 10
    ? new Date(`${value}T00:00:00Z`)
    : new Date(value);
}

function dateParts(value: string): [number, number, number] {
  const date = parseDate(value);

  return value.length <= 10
    ? [date.getUTCDate(), date.getUTCMonth(), date.getUTCFullYear()]
    : [date.getDate(), date.getMonth(), date.getFullYear()];
}

/** `6 out. 2026` for a date, `9 out. 2026` for a timestamp. */
export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  const date = parseDate(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const [day, month, year] = dateParts(value);
  return `${day} ${MONTHS[month]} ${year}`;
}

/** `9 out. 2026, 11:08` for an ISO timestamp. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${formatDate(value)}, ${hours}:${minutes}`;
}

export function formatPeriod(
  startsOn: string | null | undefined,
  endsOn: string | null | undefined,
): string {
  if (!startsOn && !endsOn) {
    return tj('date.unknown');
  }

  if (!startsOn || !endsOn) {
    return formatDate(startsOn ?? endsOn);
  }

  const start = parseDate(startsOn);
  const end = parseDate(endsOn);
  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  const startMonth = start.getUTCMonth();
  const endMonth = end.getUTCMonth();
  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1);

  if (startYear === endYear && startMonth === endMonth) {
    return tj('date.periodSameMonth', {
      from: startDay,
      to: endDay,
      month: MONTHS[endMonth],
      year: endYear,
      days,
    });
  }

  if (startYear === endYear) {
    return tj('date.periodSameYear', {
      fromDay: startDay,
      fromMonth: MONTHS[startMonth],
      toDay: endDay,
      toMonth: MONTHS[endMonth],
      year: endYear,
      days,
    });
  }

  return tj('date.periodFull', {
    from: formatDate(startsOn),
    to: formatDate(endsOn),
    days,
  });
}

export function formatEntryTypes(types: string[], capitalize = true): string {
  if (types.length === 0) {
    return tj('entryType.empty');
  }

  const labels = types.map((type) => {
    const key = ENTRY_TYPE_LABELS[type];
    return key ? tj(key) : type;
  });

  const list =
    labels.length === 1
      ? labels[0]
      : `${labels.slice(0, -1).join(', ')} e ${labels[labels.length - 1]}`;

  return capitalize ? list.charAt(0).toUpperCase() + list.slice(1) : list;
}

/** `Até 4 pedidos por dia, cerca de 8 min por dia`, with the singular form when needed. */
export function formatRequestsPerDay(count: number, minutes: number): string {
  return tj(count === 1 ? 'invitation.requestsValueOne' : 'invitation.requestsValue', {
    count,
    minutes,
  });
}

/** A team member from the API or from an older cached list that held only the email. */
export type TeamMemberLike = string | { name?: string | null; email?: string | null };

export type TeamMember = { name: string | null; email: string | null };

export function teamMembers(team: TeamMemberLike[]): TeamMember[] {
  return team.map((member) => {
    if (typeof member === 'string') {
      return member.includes('@')
        ? { name: null, email: member }
        : { name: member, email: null };
    }
    return { name: member.name ?? null, email: member.email ?? null };
  });
}

export function formatTeam(team: TeamMemberLike[]): string {
  const labels = teamMembers(team)
    .map((member) => member.name || member.email || '')
    .filter(Boolean);
  return labels.length > 0 ? labels.join(', ') : tj('invitation.teamEmpty');
}
