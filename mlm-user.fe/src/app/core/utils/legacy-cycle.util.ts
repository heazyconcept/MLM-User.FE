import type { LegacyCycle, LegacyMonthsResponse } from '../models/legacy-club.models';

export type LegacyCycleLike = Pick<LegacyCycle, 'cycleMonths' | 'cycleWeeks'> | null | undefined;

export type LegacyMonthsCycleLike = Pick<
  LegacyMonthsResponse,
  'cycleMonths' | 'cycleWeeks'
> | null | undefined;

/** Prefer explicit cycleWeeks; else derive from months × 4; default 24. */
export function cyclePeriodCount(cycle: LegacyCycleLike | LegacyMonthsCycleLike): number {
  if (!cycle) return 24;
  if (typeof cycle.cycleWeeks === 'number' && cycle.cycleWeeks > 0) {
    return cycle.cycleWeeks;
  }
  if (typeof cycle.cycleMonths === 'number' && cycle.cycleMonths > 0) {
    return cycle.cycleMonths * 4;
  }
  return 24;
}

export function isWeeklyCycle(cycle: LegacyCycleLike | LegacyMonthsCycleLike): boolean {
  return typeof cycle?.cycleWeeks === 'number' && cycle.cycleWeeks > 0;
}

/** "Week N" when weekly fields present; otherwise "Month N". */
export function periodLabel(
  index: number,
  cycle: LegacyCycleLike | LegacyMonthsCycleLike,
): string {
  if (isWeeklyCycle(cycle)) {
    return `Week ${index}`;
  }
  return `Month ${index}`;
}

export function periodColumnHeader(cycle: LegacyCycleLike | LegacyMonthsCycleLike): string {
  return isWeeklyCycle(cycle) ? 'Week' : 'Month';
}

export function cycleProgressLabel(
  issuedCount: number,
  cycle: LegacyCycleLike | LegacyMonthsCycleLike,
): string {
  const total = cyclePeriodCount(cycle);
  if (isWeeklyCycle(cycle)) {
    return `${issuedCount} of ${total} weeks`;
  }
  const months = cycle?.cycleMonths ?? Math.max(1, Math.round(total / 4));
  return `${issuedCount} of ${months} months`;
}
