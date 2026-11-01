export interface CashoutChargeBreakdown {
  amount: number;
  feeAmount: number;
  netAmount: number;
}

/** Half-up to 2 decimal places using integer cents to avoid float drift. */
export function roundMoneyHalfUp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const sign = value < 0 ? -1 : 1;
  const cents = Math.round(Math.abs(value) * 100 + Number.EPSILON);
  return (sign * cents) / 100;
}

/** fee = half-up(amount * feeRate, 2dp); net = amount - fee */
export function computeCashoutCharge(amount: number, feeRate: number): CashoutChargeBreakdown {
  const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  const rate = Number.isFinite(feeRate) && feeRate >= 0 ? feeRate : 0;
  const feeAmount = roundMoneyHalfUp(safeAmount * rate);
  const netAmount = roundMoneyHalfUp(safeAmount - feeAmount);
  return { amount: safeAmount, feeAmount, netAmount };
}

export function formatCashoutPercent(feeRate: number): string {
  const pct = Number.isFinite(feeRate) ? feeRate * 100 : 0;
  const rounded = Math.round(pct * 100) / 100;
  return `${rounded}%`;
}
