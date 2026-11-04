import { td } from '@/i18n/td';
import type { Participation } from '@/state/participations';

function utcDate(iso: string | null): number | null {
  if (!iso) {
    return null;
  }
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) {
    return null;
  }
  return Date.UTC(year, month - 1, day);
}

function todayUtc(): number {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
}

/** The plain current-study line above the title of the main screens (FR-82). */
export function studyLineOf(
  participation: Participation | undefined,
  active: boolean,
): string {
  if (!participation) {
    return td('today.studyLine', { study: '' });
  }
  if (!active) {
    return td('today.studyPending', { study: participation.title });
  }

  const start = utcDate(participation.startsOn);
  const end = utcDate(participation.endsOn);
  if (start === null || end === null || end < start) {
    return td('today.studyLine', { study: participation.title });
  }

  const total = Math.round((end - start) / 86_400_000) + 1;
  const day = Math.min(
    Math.max(Math.floor((todayUtc() - start) / 86_400_000) + 1, 1),
    total,
  );
  return td('today.studyDay', {
    study: participation.title,
    day,
    total,
  });
}
