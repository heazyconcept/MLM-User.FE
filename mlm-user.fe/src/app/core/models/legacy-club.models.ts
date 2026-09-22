export type LegacyPackageCode = 'VIP' | 'EXECUTIVE' | 'SUPREME';
export type LegacyMemberStatus = 'NONE' | 'PENDING_JOIN' | 'ACTIVE';
export type LegacySponsorResolution = 'AUTO' | 'MANUAL';
export type LegacySponsorSource = 'AUTO' | 'CHOSEN' | 'SEED';
export type ShopChannel = 'NETWORK' | 'LEGACY';
export type LegacyCurrency = 'NGN' | 'USD';
export type LegacyWalletStatus = 'ACTIVE' | 'LOCKED';

/** Phase 2–3 shop mode. Phase 1 backends omit this. */
export type LegacyShopMode = 'JOIN' | 'AUTOSHIP' | 'UPGRADE' | 'REACTIVATE' | 'NONE';
export type LegacyRateTier = 'BASE' | 'INCREASED';
export type LegacyMonthStatus = 'SCHEDULED' | 'PENDING' | 'DROPPED';
export type LegacyIntent = 'NONE' | 'UPGRADE' | 'REACTIVATE';
export type LegacyHistoryKind = 'JOIN' | 'UPGRADE' | 'REACTIVATE' | 'SEED';

export type LegacyCashoutTransferTarget =
  | 'CASH'
  | 'VOUCHER'
  | 'AUTOSHIP'
  | 'LEGACY_VOUCHER';

export interface LegacyPackage {
  code: LegacyPackageCode;
  name: string;
  isActive: boolean;
  purchaseAmount: number;
  instantCommission: number;
  /** Phase 1 flyer field; Phase 2 may still send as increased default. */
  monthlyCommission: number;
  monthlyCommissionBase?: number;
  monthlyCommissionIncreased?: number;
  sixMonthTotal: number;
  successlineBonusPercent: number;
  autoshipAmount: number;
  cycleMonths: number;
  minDirectsToIncreaseMonthly: number;
}

export interface LegacyPackagesResponse {
  currency: LegacyCurrency;
  fxRateNgnPerUsd: number;
  packages: LegacyPackage[];
}

export interface LegacyDefaultSponsor {
  username: string;
  legacyPackage: LegacyPackageCode;
}

export interface LegacyWalletSnapshot {
  balance: number;
  status: LegacyWalletStatus;
}

export interface LegacyMembership {
  package: LegacyPackageCode;
  sponsorUsername: string;
  sponsorSource: LegacySponsorSource;
  joinedAt: string;
  cycleStartedAt: string;
  joinOrderId: string;
}

export interface LegacyPendingJoin {
  package: LegacyPackageCode;
  sponsorUsername: string;
  sponsorSource: LegacySponsorSource;
  purchaseRequired: number;
  legacyCartSubtotal: number;
  remainingToJoin: number;
}

export interface LegacyCycle {
  startedAt: string;
  cycleMonths: number;
  /** Weekly model: 24 weeks (6 × 4). Absent on monthly-only backends. */
  cycleWeeks?: number;
  issuedCount: number;
  droppedCount: number;
  pendingCount: number;
  pendingAmount: number;
  nextDueAt: string | null;
  nextDueAmount: number;
  /** Weekly cashout slice of next due (hide when absent). */
  nextDueCashoutAmount?: number;
  /** Weekly voucher net of next due after 10% fee (hide when absent). */
  nextDueVoucherNet?: number;
  nextDueRateTier: LegacyRateTier;
  isCycleComplete: boolean;
}

export interface LegacyMonthlyQualify {
  directSuccesslineCount: number;
  required: number;
  qualifiedAt: string | null;
  isQualified: boolean;
}

export interface LegacyAutoship {
  requiredAmount: number;
  /** Weekly Autoship slice — display helper only; not a checkout floor. */
  weeklyAutoshipAmount?: number;
  lastAutoshipAt: string | null;
  shopMode: LegacyShopMode;
}

export interface LegacyPriorPendingSummary {
  count: number;
  amount: number;
}

export interface LegacyMe {
  status: LegacyMemberStatus;
  currency: LegacyCurrency;
  sponsorResolution: LegacySponsorResolution;
  defaultSponsor: LegacyDefaultSponsor | null;
  membership: LegacyMembership | null;
  legacyCashout: LegacyWalletSnapshot | null;
  legacyVoucher: LegacyWalletSnapshot | null;
  instantReceived: number;
  directSuccesslineCount: number;
  minDirectsToIncreaseMonthly: number;
  canCashoutLegacy: boolean;
  pendingJoin: LegacyPendingJoin | null;
  /** Phase 2+ */
  cycle?: LegacyCycle | null;
  monthlyQualify?: LegacyMonthlyQualify | null;
  autoship?: LegacyAutoship | null;
  /** Phase 3 — may also live on autoship.shopMode in Phase 2 */
  shopMode?: LegacyShopMode;
  intent?: LegacyIntent;
  intentPackage?: LegacyPackageCode | null;
  canReactivate?: boolean;
  upgradeTargets?: LegacyPackageCode[];
  priorPending?: LegacyPriorPendingSummary | null;
}

export interface LegacySponsorValidateRequest {
  username: string;
}

export interface LegacySponsorValidateResponse {
  valid: true;
  username: string;
  legacyPackage: LegacyPackageCode;
}

export interface LegacyJoinStartRequest {
  package: LegacyPackageCode;
  sponsorUsername?: string;
}

export interface LegacyMemberLookup {
  username: string;
  exists: boolean;
  isRegistrationPaid: boolean;
  legacyStatus: LegacyMemberStatus | 'NONE';
}

export interface LegacySuccessline {
  username: string;
  package: LegacyPackageCode;
  joinedAt: string;
  sponsorSource: LegacySponsorSource;
}

export interface LegacySuccesslinesResponse {
  summary: {
    directSuccesslineCount: number;
    minDirectsToIncreaseMonthly: number;
  };
  pagination: {
    totalRecords: number;
    currentPage: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  successlines: LegacySuccessline[];
}

export interface LegacyCashoutLedgerItem {
  id: string;
  date: string;
  description: string;
  type: 'Credit' | 'Debit';
  amount: number;
  currency: LegacyCurrency;
}

export interface LegacyCashoutResponse {
  currency: LegacyCurrency;
  balance: number;
  walletStatus: LegacyWalletStatus;
  canCashoutLegacy: boolean;
  directSuccesslineCount: number;
  items: LegacyCashoutLedgerItem[];
  nextCursor: string | null;
}

export interface LegacyCashoutWithdrawRequest {
  amount: number;
  currency: LegacyCurrency;
  pin: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
}

export interface LegacyCashoutTransferRequest {
  toWalletType: LegacyCashoutTransferTarget;
  amount: number;
  currency: LegacyCurrency;
  pin: string;
}

export interface LegacyCashoutTransferResponse {
  transferId: string;
}

export interface LegacyVoucherResponse {
  currency: LegacyCurrency;
  balance: number;
  status: LegacyWalletStatus;
}

export interface LegacyMonthRow {
  periodIndex: number;
  dueAt: string;
  amount: number;
  /** Weekly split — hide column when absent. */
  cashoutAmount?: number;
  voucherGross?: number;
  voucherFee?: number;
  voucherNet?: number;
  rateTier: LegacyRateTier;
  status: LegacyMonthStatus;
  droppedAt: string | null;
  /** Deprecated for release logic; may still arrive from older backends. */
  autoshipOrderId: string | null;
}

export interface LegacyPriorPendingMonth {
  cyclePackage: LegacyPackageCode;
  periodIndex: number;
  amount: number;
  rateTier: LegacyRateTier;
  dueAt: string;
  status: LegacyMonthStatus;
}

export interface LegacyMonthsResponse {
  currency: LegacyCurrency;
  cycleMonths: number;
  /** When present, UI labels periods as weeks. */
  cycleWeeks?: number;
  cycleStartedAt?: string;
  pendingTotal?: number;
  monthlyQualify?: LegacyMonthlyQualify | null;
  months: LegacyMonthRow[];
  priorPending?: LegacyPriorPendingMonth[];
}

export interface LegacyUpgradeQuote {
  fromPackage: LegacyPackageCode;
  toPackage: LegacyPackageCode;
  currency: LegacyCurrency;
  payAmount: number;
  instantCommission: number;
  newMonthlyBase: number;
  newMonthlyIncreased: number;
  newAutoshipAmount: number;
}

export interface LegacyHistoryItem {
  id: string;
  kind: LegacyHistoryKind;
  package: LegacyPackageCode;
  fromPackage?: LegacyPackageCode | null;
  instantAmount: number;
  currency: LegacyCurrency;
  at: string;
  orderId?: string | null;
}

export interface LegacyHistoryResponse {
  items: LegacyHistoryItem[];
}

export interface LegacyApiErrorBody {
  code?: string;
  message?: string;
  error?: string;
}

export const LEGACY_ERROR_CODES = {
  SPONSOR_NOT_FOUND: 'SPONSOR_NOT_FOUND',
  SPONSOR_NOT_LEGACY: 'SPONSOR_NOT_LEGACY',
  SPONSOR_SELF: 'SPONSOR_SELF',
  SPONSOR_USERNAME_REQUIRED: 'SPONSOR_USERNAME_REQUIRED',
  SPONSOR_MUST_BE_AUTO: 'SPONSOR_MUST_BE_AUTO',
  PACKAGE_INACTIVE: 'PACKAGE_INACTIVE',
  ALREADY_ACTIVE: 'ALREADY_ACTIVE',
  REGISTRATION_UNPAID: 'REGISTRATION_UNPAID',
  LEGACY_CART_BELOW_PACKAGE: 'LEGACY_CART_BELOW_PACKAGE',
  LEGACY_JOIN_REQUIRED: 'LEGACY_JOIN_REQUIRED',
  LEGACY_SHOP_JOIN_ONLY: 'LEGACY_SHOP_JOIN_ONLY',
  LEGACY_VOUCHER_REQUIRED: 'LEGACY_VOUCHER_REQUIRED',
  IMPERSONATION_ACTION_BLOCKED: 'IMPERSONATION_ACTION_BLOCKED',
  PACKAGE_NOT_HIGHER: 'PACKAGE_NOT_HIGHER',
  CYCLE_NOT_COMPLETE: 'CYCLE_NOT_COMPLETE',
  NOT_LEGACY_MEMBER: 'NOT_LEGACY_MEMBER',
  WALLET_LOCKED: 'WALLET_LOCKED',
} as const;

export function resolveLegacyShopMode(me: LegacyMe | null | undefined): LegacyShopMode {
  if (!me) return 'NONE';
  if (me.shopMode) return me.shopMode;
  if (me.autoship?.shopMode) return me.autoship.shopMode;
  if (me.status === 'PENDING_JOIN') return 'JOIN';
  return 'NONE';
}

export function packageMonthlyDisplay(pkg: LegacyPackage): {
  base: number;
  increased: number;
} {
  const increased = pkg.monthlyCommissionIncreased ?? pkg.monthlyCommission;
  const base = pkg.monthlyCommissionBase ?? pkg.monthlyCommission;
  return { base, increased };
}

/** Weekly preview from monthly flyer (backend ÷ 4). */
export function packageWeeklyDisplay(pkg: LegacyPackage): {
  base: number;
  increased: number;
} {
  const { base, increased } = packageMonthlyDisplay(pkg);
  return { base: base / 4, increased: increased / 4 };
}
