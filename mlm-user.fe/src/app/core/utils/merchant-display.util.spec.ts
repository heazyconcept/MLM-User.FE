import { describe, it, expect } from 'vitest';
import { formatMerchantUsernameLabel } from './merchant-display.util';

describe('formatMerchantUsernameLabel', () => {
  it('formats username(businessName) when both differ', () => {
    expect(formatMerchantUsernameLabel('janedoe', 'Herb World Ventures')).toBe(
      'janedoe(Herb World Ventures)',
    );
  });

  it('returns username only when business name is missing', () => {
    expect(formatMerchantUsernameLabel('janedoe', null)).toBe('janedoe');
    expect(formatMerchantUsernameLabel('janedoe', '')).toBe('janedoe');
    expect(formatMerchantUsernameLabel('janedoe', undefined)).toBe('janedoe');
  });

  it('returns business name only when username is missing', () => {
    expect(formatMerchantUsernameLabel(null, 'Herb World Ventures')).toBe(
      'Herb World Ventures',
    );
    expect(formatMerchantUsernameLabel('', 'Herb World Ventures')).toBe(
      'Herb World Ventures',
    );
  });

  it('returns single value when username equals business name (case-insensitive)', () => {
    expect(formatMerchantUsernameLabel('HerbWorld', 'herbworld')).toBe('HerbWorld');
  });

  it('returns empty string when neither is provided', () => {
    expect(formatMerchantUsernameLabel(null, null)).toBe('');
    expect(formatMerchantUsernameLabel('', '')).toBe('');
  });

  it('trims surrounding whitespace', () => {
    expect(formatMerchantUsernameLabel('  janedoe  ', '  Herb World  ')).toBe(
      'janedoe(Herb World)',
    );
  });
});
