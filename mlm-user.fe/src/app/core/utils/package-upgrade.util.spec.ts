import { describe, expect, it } from 'vitest';
import {
  canPayUpgradeFromRegistrationWallet,
  formatUpgradePaymentError,
  mergeUpgradeBenefits,
  upgradeActionLabel,
  upgradeDepositAmountMatches,
} from './package-upgrade.util';

describe('package upgrade helpers', () => {
  it('offers the registration wallet only when it covers the difference', () => {
    expect(canPayUpgradeFromRegistrationWallet(20000, 15000)).toBe(true);
    expect(canPayUpgradeFromRegistrationWallet(15000, 15000)).toBe(true);
    expect(canPayUpgradeFromRegistrationWallet(14999, 15000)).toBe(false);
    expect(canPayUpgradeFromRegistrationWallet(null, 15000)).toBe(false);
    expect(canPayUpgradeFromRegistrationWallet(20000, 0)).toBe(false);
  });

  it('labels the action with the tier and the amount due', () => {
    expect(upgradeActionLabel('Silver', '₦15,000')).toBe('Upgrade to Silver — ₦15,000');
  });

  it('keeps a short-balance 400 specific', () => {
    const message = formatUpgradePaymentError({
      error: {
        message: 'Insufficient registration wallet balance',
        requiredAmount: 15000,
        currentBalance: 2000,
        currency: 'NGN',
      },
    });

    expect(message).toContain('Insufficient registration wallet balance');
    expect(message).toContain('₦15,000');
    expect(message).toContain('₦2,000');
  });

  it('shows a locked registration wallet message from the API', () => {
    expect(
      formatUpgradePaymentError({
        error: { message: 'Registration wallet is locked' },
      }),
    ).toBe('Registration wallet is locked');
  });

  it('replaces the direct referral line with the API earnings rate', () => {
    expect(
      mergeUpgradeBenefits(['10% Direct Referral', '0.05% PDPA'], {
        newEarningsRate: 12,
      }),
    ).toEqual(['12% Direct Referral', '0.05% PDPA']);
  });

  it('keeps a manual upgrade deposit on the quoted difference', () => {
    expect(upgradeDepositAmountMatches(15000, 15000)).toBe(true);
    expect(upgradeDepositAmountMatches(15000, 20000)).toBe(false);
    expect(upgradeDepositAmountMatches(null, 20000)).toBe(true);
  });

  it('uses benefit strings from the API when they are provided', () => {
    expect(
      mergeUpgradeBenefits(['10% Direct Referral'], {
        benefits: ['Custom benefit'],
        newEarningsRate: 12,
      }),
    ).toEqual(['Custom benefit']);
  });
});
