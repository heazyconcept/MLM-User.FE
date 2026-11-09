export function canPayUpgradeFromRegistrationWallet(
  balance: number | null,
  upgradeAmount: number,
): boolean {
  return balance != null && upgradeAmount > 0 && balance >= upgradeAmount;
}

export function upgradeActionLabel(packageLabel: string, formattedAmount: string): string {
  return `Upgrade to ${packageLabel} — ${formattedAmount}`;
}

export function upgradeDepositAmountMatches(
  expected: number | null,
  amount: number | null,
): boolean {
  if (expected == null) return true;
  return amount === expected;
}

export function mergeUpgradeBenefits(
  staticBenefits: string[],
  option?: { benefits?: string[]; newEarningsRate?: number },
): string[] {
  if (option?.benefits && option.benefits.length > 0) {
    return option.benefits;
  }
  if (option?.newEarningsRate == null || Number.isNaN(option.newEarningsRate)) {
    return staticBenefits;
  }

  const rateLine = `${option.newEarningsRate}% Direct Referral`;
  const next = [...staticBenefits];
  const index = next.findIndex((line) => line.toLowerCase().includes('direct referral'));
  if (index >= 0) {
    next[index] = rateLine;
  } else {
    next.unshift(rateLine);
  }
  return next;
}

function readErrorBody(error: unknown): Record<string, unknown> | null {
  if (!error || typeof error !== 'object') return null;
  const body = (error as { error?: unknown }).error;
  if (!body || typeof body !== 'object') return null;
  return body as Record<string, unknown>;
}

function readMessage(body: Record<string, unknown> | null): string | null {
  const message = body?.['message'];
  if (typeof message === 'string' && message.trim()) return message.trim();
  if (Array.isArray(message)) {
    const joined = message
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .join(' ')
      .trim();
    return joined || null;
  }
  return null;
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

export function formatUpgradeMoney(amount: number, currency: string): string {
  const symbol = currency === 'USD' ? '$' : '₦';
  return `${symbol}${amount.toLocaleString('en-US')}`;
}

export function formatUpgradePaymentError(error: unknown): string {
  const fallback = 'Could not initiate the upgrade payment. Please try again or contact support.';
  const body = readErrorBody(error);
  const message = readMessage(body) ?? fallback;
  const required = numberOrNull(body?.['requiredAmount']);
  const balance = numberOrNull(body?.['currentBalance']);
  if (required == null || balance == null) return message;

  const currency = typeof body?.['currency'] === 'string' ? body['currency'] : 'NGN';
  const due = formatUpgradeMoney(required, currency);
  const available = formatUpgradeMoney(balance, currency);
  if (message.includes(due) && message.includes(available)) return message;
  return `${message} Required ${due}. Available ${available}.`;
}
