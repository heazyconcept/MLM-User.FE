/**
 * Registration and admin fees per package (NGN).
 * From registration-and-activation-api.md section 6.
 */
export const REGISTRATION_FEE_NGN: Record<string, number> = {
  NICKEL: 15_000,
  SILVER: 30_000,
  GOLD: 120_000,
  PLATINUM: 600_000,
  RUBY: 1_800_000,
  DIAMOND: 6_000_000
};

export const ADMIN_FEE_NGN: Record<string, number> = {
  NICKEL: 5_000,
  SILVER: 5_000,
  GOLD: 10_000,
  PLATINUM: 20_000,
  RUBY: 50_000,
  DIAMOND: 100_000
};

/** Fixed rate: 1000 NGN = 1 USD (from doc) */
export const NGN_TO_USD_RATE = 1000;

/**
 * Get the total amount required to activate (registration fee + admin fee).
 * @param pkg Package name (NICKEL, SILVER, etc.)
 * @param currency Display currency
 */
export function getRequiredAmount(pkg: string, currency: 'NGN' | 'USD'): number {
  const regFee = REGISTRATION_FEE_NGN[pkg] ?? REGISTRATION_FEE_NGN['NICKEL'];
  const adminFee = ADMIN_FEE_NGN[pkg] ?? ADMIN_FEE_NGN['NICKEL'];
  const totalNgn = regFee + adminFee;

  if (currency === 'NGN') {
    return totalNgn;
  }
  return totalNgn / NGN_TO_USD_RATE;
}
