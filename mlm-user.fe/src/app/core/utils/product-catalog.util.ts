import type { Product } from '../../services/product.service';

export function formatCatalogPrice(amount: number, currency: 'NGN' | 'USD'): string {
  const sym = currency === 'USD' ? '$' : '₦';
  return `${sym}${amount.toLocaleString('en-US')}`;
}

export function formatAvailableFrom(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
}

export function formatNextActiveFrom(dateStr: string | null | undefined): string {
  return formatAvailableFrom(dateStr);
}

export function getNextActiveFrom(product: Product): string | null {
  const next = product.nextPriceEffectiveFrom?.trim();
  if (next) return next;
  if (product.priceStatus === 'scheduled' && product.availableFrom) {
    return product.availableFrom;
  }
  return null;
}

export function getNextActiveLabel(product: Product): string | null {
  const from = getNextActiveFrom(product);
  if (!from) return null;
  const formatted = formatNextActiveFrom(from);
  return formatted ? `Available from ${formatted}` : null;
}

export function canPurchaseProduct(product: Product): boolean {
  return product.purchasable;
}

export function getUnavailableCartMessage(product: Product): string {
  const nextActive = getNextActiveLabel(product);
  if (nextActive) {
    return `This product is not available for purchase yet. ${nextActive}.`;
  }
  if (product.priceStatus === 'scheduled') {
    return 'This product is not available for purchase yet.';
  }
  return 'This product is not available for purchase.';
}
