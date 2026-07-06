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

export function canPurchaseProduct(product: Product): boolean {
  return product.purchasable;
}

export function getUnavailableCartMessage(product: Product): string {
  if (product.priceStatus === 'scheduled') {
    const from = formatAvailableFrom(product.availableFrom);
    return from
      ? `This product is not available for purchase yet. Available from ${from}.`
      : 'This product is not available for purchase yet.';
  }
  return 'This product is not available for purchase.';
}
