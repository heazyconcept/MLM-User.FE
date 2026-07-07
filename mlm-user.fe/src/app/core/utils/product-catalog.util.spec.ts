import { describe, it, expect } from 'vitest';
import {
  canPurchaseProduct,
  formatAvailableFrom,
  formatCatalogPrice,
  formatNextActiveFrom,
  getNextActiveLabel,
  getUnavailableCartMessage,
} from './product-catalog.util';
import type { Product } from '../../services/product.service';

function baseProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    name: 'Test',
    description: '',
    memberPriceNGN: 10000,
    nonMemberPriceNGN: 15000,
    price: 6.67,
    currency: 'USD',
    pv: 1,
    directReferralPv: 0,
    cpv: 0.5,
    category: 'health',
    images: [],
    inStock: true,
    eligibleWallets: ['voucher'],
    purchasable: true,
    availableFrom: null,
    nextPriceEffectiveFrom: null,
    priceStatus: 'active',
    ...overrides,
  };
}

describe('product-catalog.util', () => {
  it('formats USD and NGN prices', () => {
    expect(formatCatalogPrice(6.67, 'USD')).toBe('$6.67');
    expect(formatCatalogPrice(10000, 'NGN')).toBe('₦10,000');
  });

  it('canPurchaseProduct respects purchasable flag', () => {
    expect(canPurchaseProduct(baseProduct())).toBe(true);
    expect(canPurchaseProduct(baseProduct({ purchasable: false }))).toBe(false);
  });

  it('getUnavailableCartMessage for scheduled products', () => {
    const msg = getUnavailableCartMessage(
      baseProduct({
        purchasable: false,
        priceStatus: 'scheduled',
        availableFrom: '2026-06-30T00:00:00.000Z',
      }),
    );
    expect(msg).toContain('not available for purchase yet');
    expect(msg).toContain('Available from');
  });

  it('getUnavailableCartMessage prefers nextPriceEffectiveFrom', () => {
    const msg = getUnavailableCartMessage(
      baseProduct({
        purchasable: false,
        inStock: false,
        priceStatus: 'active',
        nextPriceEffectiveFrom: '2026-07-10T15:48:00.000Z',
      }),
    );
    expect(msg).toContain('not available for purchase yet');
    expect(msg).toContain('Available from');
    expect(msg).toContain('2026');
  });

  it('getNextActiveLabel uses nextPriceEffectiveFrom over availableFrom', () => {
    const label = getNextActiveLabel(
      baseProduct({
        priceStatus: 'scheduled',
        availableFrom: '2026-06-30T00:00:00.000Z',
        nextPriceEffectiveFrom: '2026-07-10T15:48:00.000Z',
      }),
    );
    expect(label).toContain('Available from');
    expect(label).toContain('2026');
  });

  it('formatNextActiveFrom shows date only', () => {
    const formatted = formatNextActiveFrom('2026-07-10T15:48:00.000Z');
    expect(formatted).toContain('2026');
    expect(formatted).toContain('July');
    expect(formatted).not.toMatch(/\d{1,2}:\d{2}/);
  });

  it('formatAvailableFrom parses ISO dates', () => {
    const formatted = formatAvailableFrom('2026-06-30T00:00:00.000Z');
    expect(formatted).toContain('2026');
    expect(formatted).toContain('June');
  });
});
