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

/** Instant Product Voucher = 60% of registration fee (credited to VOUCHER wallet on activation) */
export const IPV_PERCENT = 0.60;

/** Instant Registration PV per package */
export const INSTANT_REG_PV: Record<string, number> = {
  NICKEL: 2,
  SILVER: 5,
  GOLD: 20,
  PLATINUM: 100,
  RUBY: 300,
  DIAMOND: 1_000
};

/** Community Registration PV per package */
export const COMMUNITY_REG_PV: Record<string, number> = {
  NICKEL: 0.4,
  SILVER: 1,
  GOLD: 4,
  PLATINUM: 20,
  RUBY: 60,
  DIAMOND: 200
};

/** Direct Referral Commission % per package */
export const DIRECT_REFERRAL_PCT: Record<string, number> = {
  NICKEL: 10,
  SILVER: 10,
  GOLD: 12,
  PLATINUM: 15,
  RUBY: 18,
  DIAMOND: 20
};

/** PDPA rates per package (%) */
export const PDPA_RATES: Record<string, number> = {
  NICKEL: 0.05,
  SILVER: 0.08,
  GOLD: 0.1,
  PLATINUM: 0.15,
  RUBY: 0.18,
  DIAMOND: 0.2
};

/** CDPA rates per package (%) */
export const CDPA_RATES: Record<string, number> = {
  NICKEL: 5,
  SILVER: 10,
  GOLD: 15,
  PLATINUM: 20,
  RUBY: 25,
  DIAMOND: 30
};

/** Cashout split % (to CASH wallet) */
export const CASHOUT_SPLIT: Record<string, number> = {
  NICKEL: 65,
  SILVER: 65,
  GOLD: 65,
  PLATINUM: 62,
  RUBY: 70,
  DIAMOND: 70
};

/** Autoship Voucher split % (to AUTOSHIP wallet) */
export const AUTOSHIP_SPLIT: Record<string, number> = {
  NICKEL: 35,
  SILVER: 35,
  GOLD: 35,
  PLATINUM: 38,  // 100 - 62 = 38 (project.md lists 33 but 62+33=95, using complement)
  RUBY: 30,
  DIAMOND: 30
};

/** Monthly Autoship amount (USD) */
export const MONTHLY_AUTOSHIP_USD: Record<string, number> = {
  NICKEL: 10,
  SILVER: 10,
  GOLD: 10,
  PLATINUM: 20,
  RUBY: 30,
  DIAMOND: 50
};

/** Monthly Autoship admin fee (USD) */
export const AUTOSHIP_ADMIN_FEE_USD: Record<string, number> = {
  NICKEL: 1,
  SILVER: 1,
  GOLD: 1,
  PLATINUM: 3,
  RUBY: 5,
  DIAMOND: 10
};

/** Matching Bonus amount (USD) per package */
export const MATCHING_BONUS_USD: Record<string, number> = {
  NICKEL: 1,
  SILVER: 5,
  GOLD: 50,
  PLATINUM: 150,
  RUBY: 350,
  DIAMOND: 1_000
};

/** Fixed rate: 1000 NGN = 1 USD (from doc) */
export const NGN_TO_USD_RATE = 1000;

export interface PackageInfo {
  label: string;
  regFeeUsd: number;
  adminFeeUsd: number;
  ipvUsd: number;
  regPv: number;
  communityPv: number;
  directReferralPct: number;
  pdpaRate: number;
  cdpaRate: number;
}

export function getPackageInfo(pkg: string): PackageInfo {
  const regNgn = REGISTRATION_FEE_NGN[pkg] ?? REGISTRATION_FEE_NGN['NICKEL'];
  const adminNgn = ADMIN_FEE_NGN[pkg] ?? ADMIN_FEE_NGN['NICKEL'];
  return {
    label: pkg.charAt(0) + pkg.slice(1).toLowerCase(),
    regFeeUsd: regNgn / NGN_TO_USD_RATE,
    adminFeeUsd: adminNgn / NGN_TO_USD_RATE,
    ipvUsd: (regNgn * IPV_PERCENT) / NGN_TO_USD_RATE,
    regPv: INSTANT_REG_PV[pkg] ?? 2,
    communityPv: COMMUNITY_REG_PV[pkg] ?? 0.4,
    directReferralPct: DIRECT_REFERRAL_PCT[pkg] ?? 10,
    pdpaRate: PDPA_RATES[pkg] ?? 0.05,
    cdpaRate: CDPA_RATES[pkg] ?? 5
  };
}

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
