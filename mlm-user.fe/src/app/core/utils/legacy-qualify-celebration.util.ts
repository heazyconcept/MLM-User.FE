import { LegacyMe } from '../models/legacy-club.models';
import { formatLegacyMoney } from './legacy-money.util';

export const LEGACY_QUALIFY_CELEBRATION_TITLE = 'Increased weekly commission unlocked!';

export interface LegacyQualifyCelebrationCopy {
  title: string;
  message: string;
  redirectTo: string;
  actionLabel: string;
  lottiePath: string;
}

export interface LegacyQualifyCelebrationStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function shouldCelebrateLegacyQualify(me: LegacyMe | null): boolean {
  if (!me || me.status !== 'ACTIVE') return false;
  return !!me.monthlyQualify?.isQualified;
}

export function legacyQualifyCelebrationStorageKey(
  userId: string,
  me: LegacyMe,
): string | null {
  if (!userId.trim()) return null;
  const qualify = me.monthlyQualify;
  if (!qualify?.isQualified) return null;

  const marker =
    qualify.qualifiedAt ??
    `count-${qualify.directSuccesslineCount}-required-${qualify.required}`;
  return `legacyQualifyCelebrated:${userId}:${marker}`;
}

export function hasCelebratedLegacyQualify(
  storage: LegacyQualifyCelebrationStorage,
  key: string | null,
): boolean {
  if (!key) return true;
  return storage.getItem(key) === '1';
}

export function markCelebratedLegacyQualify(
  storage: LegacyQualifyCelebrationStorage,
  key: string | null,
): void {
  if (!key) return;
  storage.setItem(key, '1');
}

export function buildLegacyQualifyCelebrationCopy(me: LegacyMe): LegacyQualifyCelebrationCopy {
  const required = me.monthlyQualify?.required ?? me.minDirectsToIncreaseMonthly ?? 3;
  const count = me.monthlyQualify?.directSuccesslineCount ?? me.directSuccesslineCount;
  let message = `You now have ${count} Direct Successline${count === 1 ? '' : 's'}. Your weekly membership commission uses the increased rate.`;

  const nextDue = me.cycle?.nextDueAmount;
  if (nextDue != null && nextDue > 0) {
    message += ` Your next weekly drop is ${formatLegacyMoney(nextDue, me.currency)}.`;
  }

  if (count < required) {
    message = `You now qualify for the increased weekly membership commission with ${count} Direct Successline${count === 1 ? '' : 's'}.`;
  }

  return {
    title: LEGACY_QUALIFY_CELEBRATION_TITLE,
    message,
    redirectTo: '/legacy/weeks',
    actionLabel: 'View weekly cycle',
    lottiePath: '/Share.json',
  };
}
