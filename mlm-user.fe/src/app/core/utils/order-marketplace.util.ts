import type { ShopChannel } from '../../services/order.service';

export type OrderMarketplaceFields = {
  channel?: ShopChannel;
  sourceLabel?: string;
  paidFromLabel?: string;
};

export function marketplaceBadgeClass(channel: ShopChannel | undefined | null): string {
  if (channel === 'LEGACY') {
    return 'bg-violet-50 text-violet-800 border border-violet-200';
  }
  return 'bg-sky-50 text-sky-800 border border-sky-200';
}

export function marketplaceSourceLabel(order: OrderMarketplaceFields): string {
  if (order.sourceLabel?.trim()) {
    return order.sourceLabel.trim();
  }
  if (order.channel === 'LEGACY') {
    return 'Legacy Marketplace';
  }
  if (order.channel === 'NETWORK') {
    return 'Network Marketplace';
  }
  return '—';
}

export function marketplacePaidFromLabel(order: Pick<OrderMarketplaceFields, 'paidFromLabel'>): string {
  return order.paidFromLabel?.trim() || '—';
}
