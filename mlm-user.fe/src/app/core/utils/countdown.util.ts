export function isCashoutHoldActive(
  unlocksAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!unlocksAt) return false;
  const at = new Date(unlocksAt);
  if (Number.isNaN(at.getTime())) return false;
  return at.getTime() > now.getTime();
}

export function cashoutHoldCountdownLabel(
  unlocksAt: string | null | undefined,
  now: Date = new Date(),
): string | null {
  if (!isCashoutHoldActive(unlocksAt, now)) return null;
  const ms = new Date(unlocksAt!).getTime() - now.getTime();
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}

export type CashoutHoldCountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

export function cashoutHoldCountdownParts(
  unlocksAt: string | null | undefined,
  now: Date = new Date(),
): CashoutHoldCountdownParts | null {
  if (!isCashoutHoldActive(unlocksAt, now)) return null;
  const ms = new Date(unlocksAt!).getTime() - now.getTime();
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}
