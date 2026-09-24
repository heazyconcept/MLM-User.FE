import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildLegacyQualifyCelebrationCopy,
  hasCelebratedLegacyQualify,
  legacyQualifyCelebrationStorageKey,
  markCelebratedLegacyQualify,
  shouldCelebrateLegacyQualify,
} from './legacy-qualify-celebration.util';
import { LegacyMe } from '../models/legacy-club.models';

function qualifiedMe(overrides: Partial<LegacyMe> = {}): LegacyMe {
  return {
    status: 'ACTIVE',
    currency: 'NGN',
    sponsorResolution: 'AUTO',
    defaultSponsor: null,
    membership: null,
    legacyCashout: { balance: 0, status: 'ACTIVE' },
    legacyVoucher: { balance: 0, status: 'ACTIVE' },
    instantReceived: 0,
    directSuccesslineCount: 3,
    minDirectsToIncreaseMonthly: 3,
    canCashoutLegacy: true,
    pendingJoin: null,
    monthlyQualify: {
      directSuccesslineCount: 3,
      required: 3,
      qualifiedAt: '2026-09-24T12:00:00.000Z',
      isQualified: true,
    },
    cycle: {
      startedAt: '2026-09-18T10:00:00.000Z',
      cycleMonths: 6,
      issuedCount: 1,
      droppedCount: 1,
      pendingCount: 0,
      pendingAmount: 0,
      nextDueAt: '2026-10-09T10:00:00.000Z',
      nextDueAmount: 75000,
      nextDueRateTier: 'INCREASED',
      isCycleComplete: false,
    },
    ...overrides,
  };
}

describe('legacy-qualify-celebration.util', () => {
  let storage: Map<string, string>;

  beforeEach(() => {
    storage = new Map();
  });

  const storageAdapter = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
  };

  it('shouldCelebrateLegacyQualify is false when not qualified', () => {
    const me = qualifiedMe({
      monthlyQualify: {
        directSuccesslineCount: 2,
        required: 3,
        qualifiedAt: null,
        isQualified: false,
      },
    });
    expect(shouldCelebrateLegacyQualify(me)).toBe(false);
  });

  it('builds storage key from qualifiedAt', () => {
    const me = qualifiedMe();
    expect(legacyQualifyCelebrationStorageKey('user-1', me)).toBe(
      'legacyQualifyCelebrated:user-1:2026-09-24T12:00:00.000Z',
    );
  });

  it('marks and detects celebrated state', () => {
    const me = qualifiedMe();
    const key = legacyQualifyCelebrationStorageKey('user-1', me);
    expect(hasCelebratedLegacyQualify(storageAdapter, key)).toBe(false);
    markCelebratedLegacyQualify(storageAdapter, key);
    expect(hasCelebratedLegacyQualify(storageAdapter, key)).toBe(true);
  });

  it('includes next weekly amount in message when cycle provides it', () => {
    const copy = buildLegacyQualifyCelebrationCopy(qualifiedMe());
    expect(copy.message).toContain('₦75,000');
    expect(copy.title).toBe('Increased weekly commission unlocked!');
    expect(copy.redirectTo).toBe('/legacy/weeks');
  });

  it('skips duplicate celebration for same qualifiedAt marker', () => {
    const me = qualifiedMe();
    const key = legacyQualifyCelebrationStorageKey('user-1', me);
    markCelebratedLegacyQualify(storageAdapter, key);
    expect(hasCelebratedLegacyQualify(storageAdapter, key)).toBe(true);
  });
});
