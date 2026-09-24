import { describe, expect, it } from 'vitest';
import {
  classifyLedgerKind,
  filterLegacyHistoryItems,
  ledgerItemToHistoryItem,
  mapLegacyHistoryResponse,
  mergeLegacyHistoryItems,
} from './legacy-history.util';

describe('mapLegacyHistoryResponse', () => {
  it('maps backend events[] into frontend items[]', () => {
    const result = mapLegacyHistoryResponse({
      currency: 'NGN',
      events: [
        {
          type: 'JOIN',
          toPackage: 'SUPREME',
          instantCommission: 200000,
          payAmount: 500000,
          createdAt: '2026-09-23T12:50:06.000Z',
          cycleId: 'cycle-1',
        },
      ],
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      kind: 'JOIN',
      package: 'SUPREME',
      amount: 200000,
      direction: 'CREDIT',
      title: 'Joined SUPREME',
      at: '2026-09-23T12:50:06.000Z',
    });
  });

  it('passes through unified items[] from future backend', () => {
    const result = mapLegacyHistoryResponse({
      currency: 'NGN',
      items: [
        {
          id: 'row-1',
          kind: 'SUCCESSLINE_INSTANT_BONUS',
          title: 'Legacy Successline bonus — Instant from bode',
          amount: 4000,
          direction: 'CREDIT',
          at: '2026-09-23T15:00:00.000Z',
        },
      ],
      nextCursor: '2026-09-23T15:00:00.000Z',
    });

    expect(result.items[0]?.kind).toBe('SUCCESSLINE_INSTANT_BONUS');
    expect(result.nextCursor).toBe('2026-09-23T15:00:00.000Z');
  });
});

describe('ledgerItemToHistoryItem', () => {
  it('classifies successline and transfer rows', () => {
    const bonus = ledgerItemToHistoryItem({
      id: '1',
      date: '2026-09-23T15:00:00.000Z',
      description: 'Legacy Successline bonus — Instant from bode',
      type: 'Credit',
      amount: 4000,
      currency: 'NGN',
    });
    expect(bonus.kind).toBe('SUCCESSLINE_INSTANT_BONUS');

    const transfer = ledgerItemToHistoryItem({
      id: '2',
      date: '2026-09-23T15:11:17.000Z',
      description: 'Move to undefined',
      type: 'Debit',
      amount: 10000,
      currency: 'NGN',
    });
    expect(transfer.kind).toBe('TRANSFER');
    expect(transfer.title).toBe('Move to Legacy product voucher');
  });
});

describe('mergeLegacyHistoryItems', () => {
  it('dedupes membership join instant against matching ledger credit', () => {
    const membership = [
      {
        id: 'join-1',
        kind: 'JOIN' as const,
        at: '2026-09-23T12:50:06.000Z',
        title: 'Joined SUPREME',
        amount: 200000,
        direction: 'CREDIT' as const,
        currency: 'NGN' as const,
        package: 'SUPREME' as const,
      },
    ];
    const ledger = [
      ledgerItemToHistoryItem({
        id: 'ledger-1',
        date: '2026-09-23T12:50:06.000Z',
        description: 'Legacy Club Instant Membership Commission (SUPREME)',
        type: 'Credit',
        amount: 200000,
        currency: 'NGN',
      }),
      ledgerItemToHistoryItem({
        id: 'ledger-2',
        date: '2026-09-23T15:11:17.000Z',
        description: 'Move to undefined',
        type: 'Debit',
        amount: 10000,
        currency: 'NGN',
      }),
    ];

    const merged = mergeLegacyHistoryItems(membership, ledger);
    expect(merged).toHaveLength(2);
    expect(merged.some((row) => row.kind === 'INSTANT_COMMISSION')).toBe(false);
    expect(merged.some((row) => row.kind === 'TRANSFER')).toBe(true);
  });
});

describe('filterLegacyHistoryItems', () => {
  it('filters membership and account rows', () => {
    const items = [
      {
        id: '1',
        kind: 'JOIN' as const,
        at: '2026-09-23T12:50:06.000Z',
        title: 'Joined SUPREME',
        amount: 200000,
        direction: 'CREDIT' as const,
        currency: 'NGN' as const,
      },
      {
        id: '2',
        kind: 'TRANSFER' as const,
        at: '2026-09-23T15:11:17.000Z',
        title: 'Move to Legacy product voucher',
        amount: 10000,
        direction: 'DEBIT' as const,
        currency: 'NGN' as const,
      },
    ];

    expect(filterLegacyHistoryItems(items, 'MEMBERSHIP')).toHaveLength(1);
    expect(filterLegacyHistoryItems(items, 'ACCOUNT')).toHaveLength(1);
    expect(classifyLedgerKind('Legacy Club Monthly Membership Commission (month 1, base)')).toBe(
      'MONTHLY_COMMISSION',
    );
  });
});
