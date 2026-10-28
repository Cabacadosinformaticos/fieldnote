import type { components } from '@/api/schema';

export type AvailabilityIntervalView = {
  id: number;
  from: number;
  to: number;
  days: boolean[];
};

type AvailabilityIntervalOut = components['schemas']['AvailabilityIntervalOut'];
type AvailabilityIntervalIn = components['schemas']['AvailabilityIntervalIn'];

const SLOT_MINUTES = 30;

/** `18:30:00` to the 30-minute slot used by the wheels (18:30 is slot 37). */
export function timeToSlot(time: string): number {
  const [hours = '0', minutes = '0'] = time.split(':');
  const hour = Number(hours);
  const minute = Number(minutes);
  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return 0;
  }
  return hour * 2 + (minute >= SLOT_MINUTES ? 1 : 0);
}

/** The slot back to the `HH:MM:SS` the API expects. */
export function slotToTime(slot: number): string {
  const clamped = Math.max(0, Math.min(47, slot));
  return `${String(Math.floor(clamped / 2)).padStart(2, '0')}:${
    clamped % 2 === 0 ? '00' : '30'
  }:00`;
}

export function fromApiInterval(
  interval: AvailabilityIntervalOut,
  id: number,
): AvailabilityIntervalView {
  const days = [false, false, false, false, false, false, false];
  for (const weekday of interval.weekdays) {
    if (weekday >= 1 && weekday <= 7) {
      days[weekday - 1] = true;
    }
  }

  return {
    id,
    from: timeToSlot(interval.start_time),
    to: timeToSlot(interval.end_time),
    days,
  };
}

export function toApiInterval(
  interval: AvailabilityIntervalView,
): AvailabilityIntervalIn {
  return {
    start_time: slotToTime(interval.from),
    end_time: slotToTime(interval.to),
    weekdays: interval.days.flatMap((enabled, index) =>
      enabled ? [index + 1] : [],
    ),
  };
}

export function nextIntervalId(
  intervals: readonly AvailabilityIntervalView[],
): number {
  return intervals.reduce((highest, interval) => Math.max(highest, interval.id), 0) + 1;
}
