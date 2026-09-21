import { LegacyCurrency } from '../models/legacy-club.models';

export function formatLegacyMoney(amount: number, currency: LegacyCurrency = 'NGN'): string {
  const symbol = currency === 'USD' ? '$' : '₦';
  return `${symbol}${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}
