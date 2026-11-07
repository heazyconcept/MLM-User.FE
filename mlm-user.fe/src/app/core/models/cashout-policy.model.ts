export interface CashoutPolicy {
  feeRate: number;
  voucherLimitNgn: number;
  voucherBalanceNgn: number;
  canCashout: boolean;
  voucherBlocked: boolean;
  blockReason: string | null;
  cashoutUnlocksAt: string | null;
  payoutNotice: string;
}

export const DEFAULT_PAYOUT_NOTICE =
  'Withdrawals are paid within 24 to 72 hours on working days. We do not pay on weekends.';
