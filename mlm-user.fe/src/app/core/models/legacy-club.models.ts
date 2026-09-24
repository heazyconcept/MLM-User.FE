export type LegacyPackageCode = 'VIP' | 'EXECUTIVE' | 'SUPREME';
export type LegacyMemberStatus =
  | 'NONE'
  | 'PENDING_JOIN'
  | 'ACTIVE'
  | 'REACTIVATION_DUE'
  | 'SUSPENDED';
export type LegacySponsorResolution = 'AUTO' | 'MANUAL';
export type LegacySponsorSource = 'AUTO' | 'CHOSEN' | 'SEED';
export type ShopChannel = 'NETWORK' | 'LEGACY';
export type LegacyCurrency = 'NGN' | 'USD';
export type LegacyWalletStatus = 'ACTIVE' | 'LOCKED';

/** Product shop gate — orthogonal to membership status. */
export type LegacyShopMode = 'JOIN' | 'SHOP' | 'NONE';
/** Legacy shop modes from older backends (mapped to SHOP in resolver). */
export type LegacyShopModeLegacy = 'AUTOSHIP' | 'UPGRADE' | 'REACTIVATE';
export type LegacyPaymentPurpose = 'JOIN' | 'UPGRADE' | 'REACTIVATE';
export type LegacyPaymentMethod = 'REGISTRATION_WALLET' | 'MANUAL_BANK';
export type LegacyPaymentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type LegacyRateTier = 'BASE' | 'INCREASED';
export type LegacyMonthStatus = 'SCHEDULED' | 'PENDING' | 'DROPPED';
export type LegacyIntent = 'NONE' | 'UPGRADE' | 'REACTIVATE';
export type LegacyHistoryKind =
  | 'JOIN'
  | 'UPGRADE'
  | 'REACTIVATE'
  | 'SEED'
  | 'INSTANT_COMMISSION'
  | 'SUCCESSLINE_INSTANT_BONUS'
  | 'MONTHLY_COMMISSION'
  | 'SUCCESSLINE_MONTHLY_BONUS'
  | 'WITHDRAWAL'
  | 'TRANSFER';

export type LegacyHistoryDirection = 'CREDIT' | 'DEBIT';
export type LegacyHistoryFilter = 'ALL' | 'MEMBERSHIP' | 'ACCOUNT';
export type LegacyPvHistoryKind = 'OWN_PURCHASE' | 'DIRECT_REFERRAL_PURCHASE';

export interface LegacyPvSummary {
  totalPv: number;
  personalProductPv: number;
  directReferralProductPv: number;
}

export interface LegacyPvHistoryItem {
  id: string;
  kind: LegacyPvHistoryKind;
  pvAmount: number;
  at: string;
  orderId: string;
  orderReference?: string | null;
  orderTotal?: number | null;
  currency?: LegacyCurrency | null;
  productSummary: string;
  buyerUsername?: string | null;
  downlineUsername?: string | null;
}

export interface LegacyPvHistoryResponse {
  items: LegacyPvHistoryItem[];
  nextCursor: string | null;
}

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

export interface LegacyLifecycle {
  status: LegacyMemberStatus;
  earningEligible: boolean;
  cashoutEligible: boolean;
  canReactivate: boolean;
  startedAt: string | null;
  earningEndsAt: string | null;
  suspensionDueAt: string | null;
  reactivationSecondsRemaining: number;
}

export interface LegacyPendingPayment {
  purpose: LegacyPaymentPurpose;
  status: 'PENDING';
  paymentRequired: number;
  paymentMethods: LegacyPaymentMethod[];
  rejectionReason?: string | null;
}

export interface LegacyPendingUpgrade {
  package: LegacyPackageCode;
  paymentRequired: number;
}

export interface LegacyJoinPreview {
  sponsorResolution: LegacySponsorResolution;
  defaultSponsor: LegacyDefaultSponsor | null;
  paymentRequired?: number;
}

export interface LegacyPaymentWalletRequest {
  purpose: LegacyPaymentPurpose;
  requestKey: string;
  /** Not required for registration-wallet Legacy membership payments. */
  pin?: string;
}

export interface LegacyPaymentRecord {
  id: string;
  purpose: LegacyPaymentPurpose;
  status: LegacyPaymentStatus;
  amount: number;
  currency: LegacyCurrency;
  rejectionReason?: string | null;
  createdAt: string;
}

export interface LegacyCompanyBankAccount {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export interface LegacyMe {
  status: LegacyMemberStatus;
  currency: LegacyCurrency;
  lifecycle?: LegacyLifecycle | null;
  sponsorResolution: LegacySponsorResolution;
  defaultSponsor: LegacyDefaultSponsor | null;
  membership: LegacyMembership | null;
  legacyCashout: LegacyWalletSnapshot | null;
  legacyVoucher: LegacyWalletSnapshot | null;
  instantReceived: number;
  directSuccesslineCount: number;
  minDirectsToIncreaseMonthly: number;
  canCashoutLegacy: boolean;
  cashoutRestrictionReason?: string | null;
  pendingJoin: LegacyPendingJoin | null;
  pendingUpgrade?: LegacyPendingUpgrade | null;
  pendingPayment?: LegacyPendingPayment | null;
  /** Phase 2+ */
  cycle?: LegacyCycle | null;
  monthlyQualify?: LegacyMonthlyQualify | null;
  autoship?: LegacyAutoship | null;
  /** May also live on autoship.shopMode in older backends */
  shopMode?: LegacyShopMode | LegacyShopModeLegacy;
  intent?: LegacyIntent;
  intentPackage?: LegacyPackageCode | null;
  canReactivate?: boolean;
  upgradeTargets?: LegacyPackageCode[];
  priorPending?: LegacyPriorPendingSummary | null;
  /** Legacy marketplace PV summary — from GET /legacy/me */
  legacyPv?: LegacyPvSummary | null;
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
  /** When caller is ACTIVE Legacy member — backend optional. */
  canRegisterUnderMe?: boolean;
  sponsorSourceIfRegistered?: LegacySponsorSource;
  blockCode?: string;
}

export interface LegacyRegisterSuccesslineRequest {
  username: string;
  package: LegacyPackageCode;
  requestKey: string;
}

export interface LegacyRegisterSuccesslineResponse {
  username: string;
  package: LegacyPackageCode;
  legacyStatus: 'ACTIVE';
  sponsorUsername: string;
  sponsorSource: LegacySponsorSource;
  joinedAt: string;
  instantCommission: number;
  successlineBonus: number;
  currency: LegacyCurrency;
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
  cashoutRestrictionReason?: string | null;
  directSuccesslineCount: number;
  items: LegacyCashoutLedgerItem[];
  nextCursor: string | null;
}

export interface LegacyCashoutWithdrawRequest {
  amount: number;
  currency: LegacyCurrency;
  pin: string;
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
  at: string;
  title: string;
  amount: number;
  direction: LegacyHistoryDirection;
  currency: LegacyCurrency;
  subtitle?: string | null;
  package?: LegacyPackageCode | null;
  fromPackage?: LegacyPackageCode | null;
  payAmount?: number | null;
  orderId?: string | null;
  /** Present on membership lifecycle rows for compatibility. */
  instantAmount?: number | null;
}

export interface LegacyHistoryResponse {
  currency?: LegacyCurrency;
  items: LegacyHistoryItem[];
  nextCursor?: string | null;
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
  LEGACY_ALREADY_ACTIVE: 'LEGACY_ALREADY_ACTIVE',
  REGISTRATION_UNPAID: 'REGISTRATION_UNPAID',
  LEGACY_CART_BELOW_PACKAGE: 'LEGACY_CART_BELOW_PACKAGE',
  LEGACY_JOIN_REQUIRED: 'LEGACY_JOIN_REQUIRED',
  LEGACY_SHOP_JOIN_ONLY: 'LEGACY_SHOP_JOIN_ONLY',
  LEGACY_VOUCHER_REQUIRED: 'LEGACY_VOUCHER_REQUIRED',
  LEGACY_CASHOUT_LOCKED: 'LEGACY_CASHOUT_LOCKED',
  IMPERSONATION_ACTION_BLOCKED: 'IMPERSONATION_ACTION_BLOCKED',
  PACKAGE_NOT_HIGHER: 'PACKAGE_NOT_HIGHER',
  CYCLE_NOT_COMPLETE: 'CYCLE_NOT_COMPLETE',
  NOT_LEGACY_MEMBER: 'NOT_LEGACY_MEMBER',
  WALLET_LOCKED: 'WALLET_LOCKED',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  DUPLICATE_REQUEST_KEY: 'DUPLICATE_REQUEST_KEY',
  TARGET_NOT_FOUND: 'TARGET_NOT_FOUND',
  TARGET_NOT_PAID: 'TARGET_NOT_PAID',
  ALREADY_IN_LEGACY: 'ALREADY_IN_LEGACY',
  ALREADY_PENDING: 'ALREADY_PENDING',
} as const;

/** Legacy cashout has no Autoship wallet — route those transfers to Legacy product voucher. */
export function resolveLegacyCashoutTransferTarget(
  target: LegacyCashoutTransferTarget,
): LegacyCashoutTransferTarget {
  return target === 'AUTOSHIP' ? 'LEGACY_VOUCHER' : target;
}

export function formatLegacyCashoutTransferLabel(
  target: LegacyCashoutTransferTarget | string,
): string {
  const resolved = resolveLegacyCashoutTransferTarget(target as LegacyCashoutTransferTarget);
  switch (resolved) {
    case 'LEGACY_VOUCHER':
    case 'AUTOSHIP':
      return 'Legacy product voucher';
    case 'VOUCHER':
      return 'Network product voucher';
    case 'CASH':
      return 'Cash wallet';
  }
}

export function formatLegacyPvAmount(pv: number): string {
  return Number.isInteger(pv) ? `${pv} PV` : `${pv.toFixed(1)} PV`;
}

export function legacyPvCardDescription(summary: LegacyPvSummary | null | undefined): string {
  if (!summary) {
    return 'PV from Legacy marketplace purchases and Successline shopping.';
  }
  const { personalProductPv, directReferralProductPv } = summary;
  if (personalProductPv === 0 && directReferralProductPv === 0) {
    return 'Shop the Legacy marketplace to earn PV that counts toward your network totals.';
  }
  const parts: string[] = [];
  if (personalProductPv > 0) {
    parts.push(`${formatLegacyPvAmount(personalProductPv).replace(' PV', '')} from your purchases`);
  }
  if (directReferralProductPv > 0) {
    parts.push(
      `${formatLegacyPvAmount(directReferralProductPv).replace(' PV', '')} from Successlines`,
    );
  }
  return parts.join(' · ');
}

export function legacyPvHistoryRowTitle(item: LegacyPvHistoryItem): string {
  const kind: LegacyPvHistoryKind = item.kind;
  switch (kind) {
    case 'OWN_PURCHASE':
      return `You earned ${item.pvAmount} PV from your purchase`;
    case 'DIRECT_REFERRAL_PURCHASE': {
      const username = item.downlineUsername ?? item.buyerUsername;
      return username
        ? `You earned ${item.pvAmount} PV from @${username}'s purchase`
        : `You earned ${item.pvAmount} PV from a Successline purchase`;
    }
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

/** Normalize ledger copy from GET /legacy/cashout for member-facing history. */
export function humanizeLegacyCashoutLedgerDescription(description: string): string {
  const trimmed = description.trim();
  const moveMatch = /^Move to (.+)$/.exec(trimmed);
  if (!moveMatch) return description;
  const target = moveMatch[1]?.trim();
  if (!target || target === 'undefined') {
    return 'Move to Legacy product voucher';
  }
  return `Move to ${formatLegacyCashoutTransferLabel(target)}`;
}

function normalizeShopMode(raw: string | undefined): LegacyShopMode {
  if (!raw) return 'NONE';
  if (raw === 'SHOP' || raw === 'AUTOSHIP') return 'SHOP';
  if (raw === 'JOIN') return 'JOIN';
  if (raw === 'UPGRADE' || raw === 'REACTIVATE') return 'JOIN';
  return 'NONE';
}

export function resolveLegacyShopMode(me: LegacyMe | null | undefined): LegacyShopMode {
  if (!me) return 'NONE';
  if (me.shopMode) return normalizeShopMode(me.shopMode);
  if (me.autoship?.shopMode) return normalizeShopMode(me.autoship.shopMode);
  if (me.status === 'PENDING_JOIN' || me.pendingPayment?.purpose === 'JOIN') return 'JOIN';
  if (me.pendingPayment?.purpose === 'UPGRADE' || me.pendingPayment?.purpose === 'REACTIVATE') {
    return 'JOIN';
  }
  if (me.pendingUpgrade) return 'JOIN';
  return 'NONE';
}

export function isLegacyMember(me: LegacyMe | null | undefined): boolean {
  if (!me) return false;
  return me.status !== 'NONE' && me.status !== 'PENDING_JOIN';
}

/** Legacy marketplace is only for registered Legacy members with an open shop. */
export function canAccessLegacyMarketplace(me: LegacyMe | null | undefined): boolean {
  return isLegacyMember(me) && resolveLegacyShopMode(me) === 'SHOP';
}

/** Legacy product voucher is available during join or after registration — not before join starts. */
export function canAccessLegacyVoucher(me: LegacyMe | null | undefined): boolean {
  if (!me) return false;
  return me.status !== 'NONE';
}

function positiveAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function firstPositiveAmount(
  source: object | null | undefined,
  keys: string[],
): number | null {
  if (!source) return null;
  const record = source as Record<string, unknown>;
  for (const key of keys) {
    const amount = positiveAmount(record[key]);
    if (amount != null) return amount;
  }
  return null;
}

/** Amount the member must pay for the current join, upgrade, or reactivate. */
export function paymentAmountFromMe(me: LegacyMe | null | undefined): number {
  if (!me) return 0;
  return (
    firstPositiveAmount(me.pendingPayment, [
      'paymentRequired',
      'payment_required',
      'amount',
      'purchaseRequired',
      'purchaseAmount',
    ]) ??
    firstPositiveAmount(me.pendingJoin, [
      'purchaseRequired',
      'paymentRequired',
      'purchase_required',
      'purchaseAmount',
      'remainingToJoin',
      'amount',
    ]) ??
    firstPositiveAmount(me.pendingUpgrade, [
      'paymentRequired',
      'payAmount',
      'amount',
      'purchaseAmount',
    ]) ??
    0
  );
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
