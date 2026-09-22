import { describe, expect, it } from 'vitest';
import { LegacyMe, paymentAmountFromMe } from '../models/legacy-club.models';
import {
  legacyHomeScreenPath,
  paymentPurposeFromMe,
  resolveLegacyHomeScreen,
} from './legacy-routing.util';

function baseMe(overrides: Partial<LegacyMe> = {}): LegacyMe {
  return {
    status: 'NONE',
    currency: 'NGN',
    sponsorResolution: 'AUTO',
    defaultSponsor: null,
    membership: null,
    legacyCashout: null,
    legacyVoucher: null,
    instantReceived: 0,
    directSuccesslineCount: 0,
    minDirectsToIncreaseMonthly: 3,
    canCashoutLegacy: false,
    pendingJoin: null,
    ...overrides,
  };
}

describe('resolveLegacyHomeScreen', () => {
  it('routes NONE to join packages', () => {
    expect(resolveLegacyHomeScreen(baseMe())).toBe('JOIN_PACKAGES');
    expect(legacyHomeScreenPath('JOIN_PACKAGES')).toBe('/legacy/join');
  });

  it('routes PENDING_JOIN to join payment', () => {
    expect(resolveLegacyHomeScreen(baseMe({ status: 'PENDING_JOIN' }))).toBe('JOIN_PAYMENT');
    expect(legacyHomeScreenPath('JOIN_PAYMENT')).toBe('/legacy/pay/JOIN');
  });

  it('routes pending upgrade to upgrade payment', () => {
    expect(
      resolveLegacyHomeScreen(
        baseMe({
          status: 'ACTIVE',
          pendingPayment: {
            purpose: 'UPGRADE',
            status: 'PENDING',
            paymentRequired: 50000,
            paymentMethods: ['REGISTRATION_WALLET'],
          },
        }),
      ),
    ).toBe('UPGRADE_PAYMENT');
  });

  it('routes REACTIVATION_DUE with canReactivate to reactivate payment', () => {
    expect(
      resolveLegacyHomeScreen(
        baseMe({
          status: 'REACTIVATION_DUE',
          lifecycle: {
            status: 'REACTIVATION_DUE',
            earningEligible: false,
            cashoutEligible: false,
            canReactivate: true,
            startedAt: null,
            earningEndsAt: null,
            suspensionDueAt: '2026-10-01T00:00:00.000Z',
            reactivationSecondsRemaining: 86400,
          },
        }),
      ),
    ).toBe('REACTIVATE_PAYMENT');
  });

  it('routes REACTIVATION_DUE without canReactivate to home grace', () => {
    expect(
      resolveLegacyHomeScreen(
        baseMe({
          status: 'REACTIVATION_DUE',
          lifecycle: {
            status: 'REACTIVATION_DUE',
            earningEligible: false,
            cashoutEligible: false,
            canReactivate: false,
            startedAt: null,
            earningEndsAt: null,
            suspensionDueAt: null,
            reactivationSecondsRemaining: 0,
          },
        }),
      ),
    ).toBe('HOME_GRACE');
  });

  it('routes SUSPENDED to home suspended', () => {
    expect(resolveLegacyHomeScreen(baseMe({ status: 'SUSPENDED' }))).toBe('HOME_SUSPENDED');
  });

  it('routes ACTIVE to home active', () => {
    expect(resolveLegacyHomeScreen(baseMe({ status: 'ACTIVE' }))).toBe('HOME_ACTIVE');
    expect(legacyHomeScreenPath('HOME_ACTIVE')).toBe('/legacy/home');
  });
});

describe('paymentAmountFromMe', () => {
  it('reads a positive amount from pending join when pending payment is zero', () => {
    expect(
      paymentAmountFromMe(
        baseMe({
          status: 'PENDING_JOIN',
          pendingPayment: {
            purpose: 'JOIN',
            status: 'PENDING',
            paymentRequired: 0,
            paymentMethods: ['REGISTRATION_WALLET'],
          },
          pendingJoin: {
            package: 'VIP',
            sponsorUsername: 'ada',
            sponsorSource: 'AUTO',
            purchaseRequired: 60000,
            legacyCartSubtotal: 0,
            remainingToJoin: 60000,
          },
        }),
      ),
    ).toBe(60000);
  });

  it('reads paymentRequired stored under an alternate join field', () => {
    const me = baseMe({
      status: 'PENDING_JOIN',
      pendingJoin: {
        package: 'VIP',
        sponsorUsername: 'ada',
        sponsorSource: 'AUTO',
        purchaseRequired: 0,
        legacyCartSubtotal: 0,
        remainingToJoin: 0,
      },
    });
    (me.pendingJoin as unknown as Record<string, unknown>)['paymentRequired'] = 60000;
    expect(paymentAmountFromMe(me)).toBe(60000);
  });
});

describe('paymentPurposeFromMe', () => {
  it('prefers pendingPayment purpose', () => {
    expect(
      paymentPurposeFromMe(
        baseMe({
          status: 'PENDING_JOIN',
          pendingPayment: {
            purpose: 'JOIN',
            status: 'PENDING',
            paymentRequired: 60000,
            paymentMethods: ['REGISTRATION_WALLET'],
          },
        }),
      ),
    ).toBe('JOIN');
  });

  it('falls back to REACTIVATE for suspended members', () => {
    expect(paymentPurposeFromMe(baseMe({ status: 'SUSPENDED' }))).toBe('REACTIVATE');
  });
});
