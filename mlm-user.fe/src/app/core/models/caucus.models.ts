export type CaucusMembershipStatus = 'NONE' | 'ACTIVE' | 'DEACTIVATED';

export type CaucusMonthDisplayStatus =
  | 'OPEN'
  | 'KEPT_ASIDE'
  | 'PENDING_PAYOUT'
  | 'PAID'
  | 'ADDED_TO_NEXT'
  | 'NOT_PAYABLE';

export type CaucusCarStatus = 'NONE' | 'QUALIFIED' | 'AWARDED';

export interface CaucusMembershipDates {
  activatedAt: string;
  deactivatedAt: string | null;
  reinstatedAt: string | null;
}

export interface CaucusAppealState {
  id: string | null;
  message: string | null;
  status: string | null;
  submittedAt: string | null;
  canSubmit: boolean;
}

export interface CaucusCurrentMonth {
  monthKey: string;
  windowStartedAt: string;
  windowEndsAt: string;
  directCount: number;
  floor: number;
  target: number;
  floorMet: boolean;
  targetMet: boolean;
  amountNgn: number;
  keptAsideNgn: number;
  displayStatus: CaucusMonthDisplayStatus;
  pvPreview: boolean;
  currency: 'NGN';
}

export interface CaucusNetwork {
  downlineCount: number;
  carTarget: number;
  carStatus: CaucusCarStatus;
  carQualifiedAt: string | null;
  carAwardedAt: string | null;
}

export interface CaucusWalletSummary {
  balanceNgn: number;
  currency: 'NGN';
}

export interface CaucusMisses {
  count: number;
  limit: number;
}

export interface CaucusPvSummary {
  totalPoints: number;
}

export interface CaucusMe {
  status: CaucusMembershipStatus;
  membership: CaucusMembershipDates | null;
  appeal: CaucusAppealState | null;
  currentMonth?: CaucusCurrentMonth;
  network?: CaucusNetwork;
  wallet?: CaucusWalletSummary;
  misses?: CaucusMisses;
  pv?: CaucusPvSummary;
}

export interface CaucusPagination {
  totalRecords: number;
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface CaucusReferral {
  id: string;
  userId: string;
  username: string;
  legacyPackage: string;
  qualifiedAt: string;
  voidedAt: string | null;
}

export interface CaucusReferralsResponse {
  monthKey: string;
  referrals: CaucusReferral[];
  pagination: CaucusPagination;
}

export interface CaucusMonthRow {
  monthKey: string;
  directCount: number;
  amountNgn: number;
  addedFromPreviousNgn: number;
  floorMet: boolean;
  targetMet: boolean;
  displayStatus: CaucusMonthDisplayStatus;
  pvPreview: boolean;
}

export interface CaucusTeamMember {
  userId: string;
  username: string;
  status: 'ACTIVE' | 'DEACTIVATED';
  activatedAt: string;
  depth: number;
}

export interface CaucusWalletEntry {
  id: string;
  direction: 'CREDIT' | 'DEBIT';
  amountNgn: number;
  monthKey: string | null;
  createdAt: string;
}

export interface CaucusWalletHistoryResponse {
  items: CaucusWalletEntry[];
  nextCursor: string | null;
}

export interface CaucusPvAward {
  monthKey: string;
  points: number;
}

export const CAUCUS_ERROR_CODES = {
  CAUCUS_APPEAL_OPEN: 'CAUCUS_APPEAL_OPEN',
  CAUCUS_APPEAL_NOT_ALLOWED: 'CAUCUS_APPEAL_NOT_ALLOWED',
  CAUCUS_NOT_ON_TEAM: 'CAUCUS_NOT_ON_TEAM',
  CAUCUS_BANK_REQUIRED: 'CAUCUS_BANK_REQUIRED',
  CAUCUS_INSUFFICIENT_BALANCE: 'CAUCUS_INSUFFICIENT_BALANCE',
  IMPERSONATION_ACTION_BLOCKED: 'IMPERSONATION_ACTION_BLOCKED',
} as const;

export const CAUCUS_APPEAL_MIN_LENGTH = 10;
export const CAUCUS_APPEAL_MAX_LENGTH = 2000;

/** Trimmed appeal message length for submit eligibility. */
export function caucusAppealTrimmedLength(message: string): number {
  return message.trim().length;
}

export function canSubmitCaucusAppeal(message: string): boolean {
  const len = caucusAppealTrimmedLength(message);
  return len >= CAUCUS_APPEAL_MIN_LENGTH && len <= CAUCUS_APPEAL_MAX_LENGTH;
}
