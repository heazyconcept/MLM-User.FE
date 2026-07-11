import { describe, it, expect } from 'vitest';
import {
  filterConsultantEarnings,
  formatConsultantEarningType,
  matchesConsultantEarningsKind,
} from './consultant-earnings.util';

describe('consultant-earnings.util', () => {
  const entries = [
    { id: '1', earningType: 'BUSINESS_CONSULTANT_REGISTRATION', amount: 100 },
    { id: '2', earningType: 'BCR', amount: 50 },
    { id: '3', earningType: 'BUSINESS_CONSULTANT_PRODUCT', amount: 25 },
    { id: '4', earningType: 'BCP', amount: 10 },
    { id: '5', earningType: 'DIRECT_REFERRAL', amount: 200 },
  ];

  it('matches registration consultant earnings', () => {
    expect(matchesConsultantEarningsKind(entries[0], 'registration')).toBe(true);
    expect(matchesConsultantEarningsKind(entries[1], 'registration')).toBe(true);
    expect(matchesConsultantEarningsKind(entries[2], 'registration')).toBe(false);
  });

  it('matches product consultant earnings', () => {
    expect(matchesConsultantEarningsKind(entries[2], 'product')).toBe(true);
    expect(matchesConsultantEarningsKind(entries[3], 'product')).toBe(true);
    expect(matchesConsultantEarningsKind(entries[0], 'product')).toBe(false);
  });

  it('filters consultant earnings by kind', () => {
    expect(filterConsultantEarnings(entries, 'registration').map((e) => e.id)).toEqual(['1', '2']);
    expect(filterConsultantEarnings(entries, 'product').map((e) => e.id)).toEqual(['3', '4']);
  });

  it('formats consultant earning type labels', () => {
    expect(formatConsultantEarningType('BCR')).toContain('registration');
    expect(formatConsultantEarningType('BCP')).toContain('product');
  });
});
