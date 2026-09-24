import {
  LegacyMemberLookup,
  LegacyMemberStatus,
  LEGACY_ERROR_CODES,
} from '../models/legacy-club.models';

export type LegacyMemberLookupUiKind =
  | 'ready'
  | 'blocked'
  | 'already'
  | 'pending'
  | 'not-member'
  | 'unpaid';

export interface LegacyMemberLookupUiResult {
  kind: LegacyMemberLookupUiKind;
  message: string;
  username: string;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

/** Normalize lookup API payloads (wrapped `data`, snake_case). */
export function normalizeLegacyMemberLookup(raw: unknown): LegacyMemberLookup {
  const source =
    raw && typeof raw === 'object' && 'data' in (raw as object)
      ? (raw as { data: unknown }).data
      : raw;

  if (!source || typeof source !== 'object') {
    return {
      username: '',
      exists: false,
      isRegistrationPaid: false,
      legacyStatus: 'NONE',
    };
  }

  const row = source as Record<string, unknown>;
  const legacyStatusRaw = readString(row['legacyStatus'] ?? row['legacy_status']) ?? 'NONE';
  const legacyStatus = legacyStatusRaw as LegacyMemberStatus | 'NONE';

  return {
    username: readString(row['username']) ?? '',
    exists: readBoolean(row['exists']) ?? false,
    isRegistrationPaid:
      readBoolean(row['isRegistrationPaid'] ?? row['is_registration_paid']) ?? false,
    legacyStatus,
    canRegisterUnderMe: readBoolean(
      row['canRegisterUnderMe'] ?? row['can_register_under_me'],
    ),
    sponsorSourceIfRegistered: (readString(
      row['sponsorSourceIfRegistered'] ?? row['sponsor_source_if_registered'],
    ) ?? undefined) as LegacyMemberLookup['sponsorSourceIfRegistered'],
    blockCode: readString(row['blockCode'] ?? row['block_code']),
  };
}

/** Payer-facing copy for lookup `blockCode` values. */
export function legacyMemberLookupBlockMessage(
  blockCode: string | undefined,
  fallback = 'You cannot register this member under you.',
): string {
  if (!blockCode) return fallback;

  switch (blockCode) {
    case LEGACY_ERROR_CODES.NOT_IN_DOWNLINE:
      return 'That member is not in your downline. You can only register people who appear in your Network downline list.';
    case LEGACY_ERROR_CODES.SPONSOR_MUST_BE_AUTO:
      return 'They must join Legacy under their Segulah sponsor, not you.';
    case LEGACY_ERROR_CODES.TARGET_NOT_FOUND:
      return 'We could not find that username.';
    case LEGACY_ERROR_CODES.TARGET_NOT_PAID:
      return 'That person has not completed Segulah registration payment.';
    case LEGACY_ERROR_CODES.ALREADY_IN_LEGACY:
      return 'That member is already in Legacy Club.';
    case LEGACY_ERROR_CODES.ALREADY_PENDING:
      return 'That member already started joining Legacy Club. They must finish or cancel first.';
    case LEGACY_ERROR_CODES.NOT_LEGACY_MEMBER:
      return 'Join Legacy Club before registering a Successline.';
    case LEGACY_ERROR_CODES.IMPERSONATION_ACTION_BLOCKED:
      return 'Action disabled during impersonation.';
    default:
      return fallback;
  }
}

export function interpretLegacyMemberLookup(
  res: LegacyMemberLookup,
): LegacyMemberLookupUiResult {
  const username = res.username || 'that username';

  if (!res.exists) {
    return {
      kind: 'not-member',
      message: 'This is not a registered member in Segulah Global Network.',
      username,
    };
  }

  if (!res.isRegistrationPaid) {
    return {
      kind: 'unpaid',
      message: `@${username} has not completed Segulah registration payment yet.`,
      username,
    };
  }

  if (res.legacyStatus === 'ACTIVE') {
    return {
      kind: 'already',
      message: `@${username} is already in Legacy Club.`,
      username,
    };
  }

  if (res.legacyStatus === 'PENDING_JOIN') {
    return {
      kind: 'pending',
      message: `@${username} already started joining Legacy Club. They must finish or cancel first.`,
      username,
    };
  }

  if (res.canRegisterUnderMe === false) {
    return {
      kind: 'blocked',
      message: legacyMemberLookupBlockMessage(res.blockCode),
      username,
    };
  }

  return {
    kind: 'ready',
    message: `Ready — @${username} can join under you.`,
    username,
  };
}
