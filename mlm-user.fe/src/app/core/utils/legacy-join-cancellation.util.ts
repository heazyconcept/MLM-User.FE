import { LegacyJoinCancellationNotice, LegacyMe } from '../models/legacy-club.models';

export function formatLegacyJoinCancellationMessage(reason?: string | null): string {
  const trimmed = reason?.trim();
  if (trimmed) {
    return `Your Legacy Club registration was cancelled: ${trimmed}`;
  }
  return 'Your Legacy Club registration was cancelled by an administrator.';
}

export function resolveJoinCancellationNotice(
  me: LegacyMe | null | undefined,
): LegacyJoinCancellationNotice | null {
  return me?.joinCancellationNotice ?? null;
}

/** True when admin cancelled an in-progress join and user should restart. */
export function isLegacyJoinCancelled(me: LegacyMe | null | undefined): boolean {
  if (!me) return false;
  if (me.joinCancellationNotice) return true;
  return me.status === 'NONE' && !me.pendingJoin && !me.pendingPayment && !!me.intentPackage;
}
