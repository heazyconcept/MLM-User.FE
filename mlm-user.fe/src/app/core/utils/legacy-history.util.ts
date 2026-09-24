import {
  LegacyCashoutLedgerItem,
  LegacyCurrency,
  LegacyHistoryFilter,
  LegacyHistoryItem,
  LegacyHistoryKind,
  LegacyHistoryResponse,
  LegacyPackageCode,
  humanizeLegacyCashoutLedgerDescription,
} from '../models/legacy-club.models';

const MEMBERSHIP_KINDS = new Set<LegacyHistoryKind>(['JOIN', 'UPGRADE', 'REACTIVATE', 'SEED']);

type LegacyHistoryEventLike = {
  id?: string;
  type?: string;
  kind?: string;
  toPackage?: LegacyPackageCode;
  package?: LegacyPackageCode;
  fromPackage?: LegacyPackageCode | null;
  instantCommission?: number;
  instantAmount?: number;
  payAmount?: number;
  orderId?: string | null;
  cycleId?: string | null;
  createdAt?: string;
  at?: string;
  title?: string;
  amount?: number;
  direction?: 'CREDIT' | 'DEBIT';
  currency?: LegacyCurrency;
  subtitle?: string | null;
};

type LegacyHistoryPayloadLike = {
  currency?: LegacyCurrency;
  items?: LegacyHistoryEventLike[];
  events?: LegacyHistoryEventLike[];
  nextCursor?: string | null;
};

function isMembershipKind(value: string): value is LegacyHistoryKind {
  return MEMBERSHIP_KINDS.has(value as LegacyHistoryKind);
}

function isUnifiedHistoryItem(row: LegacyHistoryEventLike): boolean {
  return typeof row.title === 'string' && (row.direction === 'CREDIT' || row.direction === 'DEBIT');
}

function membershipEventToItem(
  row: LegacyHistoryEventLike,
  currency: LegacyCurrency,
  index: number,
): LegacyHistoryItem {
  const kind = (row.kind ?? row.type ?? 'JOIN') as LegacyHistoryKind;
  const pkg = row.package ?? row.toPackage ?? 'VIP';
  const instantAmount = Number(row.instantAmount ?? row.instantCommission ?? 0);
  const at = String(row.at ?? row.createdAt ?? new Date(0).toISOString());
  const id = row.id ?? `membership-${row.cycleId ?? 'event'}-${at}-${index}`;

  return {
    id,
    kind: isMembershipKind(kind) ? kind : 'JOIN',
    at,
    title: membershipHistoryTitle(kind, pkg, row.fromPackage ?? null),
    amount: instantAmount,
    direction: 'CREDIT',
    currency: row.currency ?? currency,
    subtitle: row.payAmount != null ? `Package payment ${row.payAmount}` : 'Instant to Legacy account',
    package: pkg,
    fromPackage: row.fromPackage ?? null,
    payAmount: row.payAmount ?? null,
    orderId: row.orderId ?? null,
    instantAmount,
  };
}

function unifiedItemToHistoryItem(row: LegacyHistoryEventLike, currency: LegacyCurrency): LegacyHistoryItem {
  return {
    id: String(row.id ?? `history-${row.at ?? row.createdAt}`),
    kind: (row.kind ?? row.type ?? 'INSTANT_COMMISSION') as LegacyHistoryKind,
    at: String(row.at ?? row.createdAt ?? new Date(0).toISOString()),
    title: String(row.title),
    amount: Number(row.amount ?? 0),
    direction: row.direction === 'DEBIT' ? 'DEBIT' : 'CREDIT',
    currency: row.currency ?? currency,
    subtitle: row.subtitle ?? null,
    package: row.package ?? row.toPackage ?? null,
    fromPackage: row.fromPackage ?? null,
    payAmount: row.payAmount ?? null,
    orderId: row.orderId ?? null,
    instantAmount: row.instantAmount ?? row.instantCommission ?? null,
  };
}

export function mapLegacyHistoryResponse(
  raw: unknown,
  fallbackCurrency: LegacyCurrency = 'NGN',
): LegacyHistoryResponse {
  const data = raw as LegacyHistoryPayloadLike;
  const currency = data.currency ?? fallbackCurrency;
  const rows = data.items ?? data.events ?? [];

  if (rows.length > 0 && rows.every(isUnifiedHistoryItem)) {
    return {
      currency,
      items: rows.map((row) => unifiedItemToHistoryItem(row, currency)),
      nextCursor: data.nextCursor ?? null,
    };
  }

  return {
    currency,
    items: rows.map((row, index) => membershipEventToItem(row, currency, index)),
    nextCursor: data.nextCursor ?? null,
  };
}

export function classifyLedgerKind(description: string): LegacyHistoryKind {
  const text = description.toLowerCase();
  if (text.includes('successline bonus') && text.includes('instant')) {
    return 'SUCCESSLINE_INSTANT_BONUS';
  }
  if (text.includes('successline bonus') && text.includes('month')) {
    return 'SUCCESSLINE_MONTHLY_BONUS';
  }
  if (text.includes('instant membership commission')) {
    return 'INSTANT_COMMISSION';
  }
  if (text.includes('monthly membership commission')) {
    return 'MONTHLY_COMMISSION';
  }
  if (text.includes('withdrawal')) {
    return 'WITHDRAWAL';
  }
  if (text.startsWith('move to')) {
    return 'TRANSFER';
  }
  return 'INSTANT_COMMISSION';
}

export function ledgerItemToHistoryItem(item: LegacyCashoutLedgerItem): LegacyHistoryItem {
  const title = humanizeLegacyCashoutLedgerDescription(item.description);
  return {
    id: `ledger-${item.id}`,
    kind: classifyLedgerKind(title),
    at: item.date,
    title,
    amount: item.amount,
    direction: item.type === 'Debit' ? 'DEBIT' : 'CREDIT',
    currency: item.currency,
    subtitle: null,
    instantAmount: item.type === 'Credit' ? item.amount : null,
  };
}

function isDuplicateInstantLedger(
  membership: LegacyHistoryItem,
  ledger: LegacyHistoryItem,
): boolean {
  if (ledger.kind !== 'INSTANT_COMMISSION' || ledger.direction !== 'CREDIT') {
    return false;
  }
  if (!MEMBERSHIP_KINDS.has(membership.kind) || membership.amount <= 0) {
    return false;
  }
  if (membership.amount !== ledger.amount) {
    return false;
  }
  const membershipTime = Date.parse(membership.at);
  const ledgerTime = Date.parse(ledger.at);
  if (Number.isNaN(membershipTime) || Number.isNaN(ledgerTime)) {
    return false;
  }
  return Math.abs(membershipTime - ledgerTime) <= 5 * 60 * 1000;
}

export function mergeLegacyHistoryItems(
  membership: LegacyHistoryItem[],
  ledger: LegacyHistoryItem[],
): LegacyHistoryItem[] {
  const consumedLedgerIds = new Set<string>();

  for (const memberRow of membership) {
    for (const ledgerRow of ledger) {
      if (isDuplicateInstantLedger(memberRow, ledgerRow)) {
        consumedLedgerIds.add(ledgerRow.id);
      }
    }
  }

  const merged = [
    ...membership,
    ...ledger.filter((row) => !consumedLedgerIds.has(row.id)),
  ];

  return merged.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

export function isMembershipHistoryKind(kind: LegacyHistoryKind): boolean {
  return MEMBERSHIP_KINDS.has(kind);
}

export function filterLegacyHistoryItems(
  items: LegacyHistoryItem[],
  filter: LegacyHistoryFilter,
): LegacyHistoryItem[] {
  switch (filter) {
    case 'ALL':
      return items;
    case 'MEMBERSHIP':
      return items.filter((item) => isMembershipHistoryKind(item.kind));
    case 'ACCOUNT':
      return items.filter((item) => !isMembershipHistoryKind(item.kind));
    default: {
      const _exhaustive: never = filter;
      return _exhaustive;
    }
  }
}

export function membershipHistoryTitle(
  kind: string,
  pkg: LegacyPackageCode,
  fromPackage: LegacyPackageCode | null,
): string {
  switch (kind) {
    case 'JOIN':
      return `Joined ${pkg}`;
    case 'UPGRADE':
      return fromPackage ? `Upgraded ${fromPackage} → ${pkg}` : `Upgraded to ${pkg}`;
    case 'REACTIVATE':
      return `Reactivated ${pkg}`;
    case 'SEED':
      return `Joined ${pkg} (admin seed)`;
    default:
      return `Legacy ${pkg}`;
  }
}

export function legacyHistoryAmountPrefix(direction: LegacyHistoryItem['direction']): string {
  return direction === 'CREDIT' ? '+' : '−';
}
