import { Injectable, signal, computed, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Observable, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { formatMerchantUsernameLabel } from '../core/utils/merchant-display.util';

export type OrderFulfilmentMethod = 'pickup' | 'delivery';
export type OrderWalletType = 'cash' | 'voucher' | 'autoship';

export type OrderStatus =
  | 'Pending'
  | 'Processing'
  | 'Approved'
  | 'Ready for Pickup'
  | 'Picked Up'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Cancelled';

export interface OrderItem {
  productId?: string;
  name: string;
  quantity: number;
  price: number;
  pv: number;
  directReferralPv: number;
  cpv: number;
}

export interface Order {
  id: string;
  reference: string;
  date: string;
  items: OrderItem[];
  total: number;
  currency: 'NGN' | 'USD';
  fulfilmentMethod: OrderFulfilmentMethod;
  status: OrderStatus;
  rawStatus?: string;
  paymentMethod?: string;
  deliveryAddress?: string;
  deliveryFee?: number;
  pickupLocationName?: string;
  pickupLocationAddress?: string;
  pickupLocationPhone?: string;
  selectedMerchantId?: string;
  selectedMerchantName?: string;
  checkoutBatchId?: string;
  paymentId?: string;
  hasOpenDispute?: boolean;
}

export interface CheckoutGroupItem {
  productId: string;
  quantity: number;
}

export interface CheckoutGroup {
  fulfilmentMode: 'PICKUP' | 'OFFLINE_DELIVERY';
  items: CheckoutGroupItem[];
  selectedMerchantId?: string;
  deliveryAddress?: string;
  deliveryDisclaimerAccepted?: boolean;
}

export interface CheckoutBatchPayload {
  countryCode: string;
  subdivisionCode: string;
  state: string;
  paymentMethod: 'WALLET';
  idempotencyKey?: string;
  groups: CheckoutGroup[];
}

export interface CheckoutOrderSummary {
  id: string;
  reference?: string;
  fulfilmentMode: 'PICKUP' | 'OFFLINE_DELIVERY';
  selectedMerchantId?: string;
  totalAmount: number;
  items: CheckoutGroupItem[];
}

export interface CheckoutResponse {
  checkoutId: string;
  orders: CheckoutOrderSummary[];
  grandTotal: number;
}

export interface PayCheckoutWalletResponse {
  message?: string;
  paidOrderIds?: string[];
}

export type OrderDisputeStatus = 'OPEN' | 'RESOLVED' | 'CLOSED';

export interface OrderDispute {
  id: string;
  orderId: string;
  reason: string;
  customerNotes?: string | null;
  status: OrderDisputeStatus;
  createdAt: string;
  outcome?: string | null;
  adminNotes?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
}

const ORDER_STATUSES: OrderStatus[] = [
  'Pending',
  'Processing',
  'Approved',
  'Ready for Pickup',
  'Picked Up',
  'Out for Delivery',
  'Delivered',
  'Cancelled',
];

@Injectable({ providedIn: 'root' })
export class OrderService {
  private api = inject(ApiService);
  private listState = signal<Order[]>([]);
  private selectedOrderState = signal<Order | null>(null);
  private fulfilmentOptionState = signal<'pickup' | 'delivery'>('delivery');
  private searchQueryState = signal<string>('');
  private statusFilterState = signal<string>('');

  readonly list = this.listState.asReadonly();
  readonly selectedOrder = this.selectedOrderState.asReadonly();
  readonly fulfilmentOption = this.fulfilmentOptionState.asReadonly();
  readonly searchQuery = this.searchQueryState.asReadonly();
  readonly statusFilter = this.statusFilterState.asReadonly();

  readonly filteredOrders = computed(() => {
    let result = this.listState();
    const query = this.searchQueryState().toLowerCase().trim();
    const statusFilter = this.statusFilterState();
    if (query) {
      result = result.filter(
        (o) =>
          o.id.toLowerCase().includes(query) ||
          o.reference.toLowerCase().includes(query) ||
          o.items.some((i) => i.name.toLowerCase().includes(query)),
      );
    }
    if (statusFilter) {
      result = result.filter((o) => o.status === statusFilter);
    }
    return result;
  });

  readonly orderStatuses = ORDER_STATUSES;

  setSearchQuery(query: string): void {
    this.searchQueryState.set(query);
  }

  setStatusFilter(status: string): void {
    this.statusFilterState.set(status);
  }

  selectOrder(order: Order | null): void {
    this.selectedOrderState.set(order);
  }

  setFulfilmentOption(option: 'pickup' | 'delivery'): void {
    this.fulfilmentOptionState.set(option);
  }

  getOrderById(id: string, forceRefresh = false): Observable<Order | undefined> {
    if (!forceRefresh) {
      const existing = this.listState().find((o) => o.id === id);
      if (existing) return of(existing);
    }

    return this.api.get<any>(`orders/${id}`).pipe(
      map((res) => this.mapOrder(res)),
      tap((mapped) => {
        const list = [...this.listState()];
        const idx = list.findIndex((o) => o.id === id);
        if (idx >= 0) list[idx] = mapped;
        else list.unshift(mapped);
        this.listState.set(list);
      }),
      catchError(() => of(undefined)),
    );
  }

  loadOrders(filters?: any): void {
    let url = 'orders';
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.fromDate) params.append('fromDate', filters.fromDate);
    if (filters?.toDate) params.append('toDate', filters.toDate);
    if (filters?.limit) params.append('limit', filters.limit);
    if (filters?.offset) params.append('offset', filters.offset);
    const qs = params.toString();
    if (qs) url += `?${qs}`;

    this.api.get<any>(url).subscribe({
      next: (res) => {
        if (res && res.orders) {
          const mapped = res.orders.map((o: any) => this.mapOrder(o));
          this.listState.set(mapped);
        } else {
          this.listState.set([]);
        }
      },
      error: (err) => console.error('Failed to load orders', err),
    });
  }

  createOrder(payload: any): Observable<Order> {
    return this.api.post<any>('orders', payload).pipe(map((res) => this.mapOrder(res)));
  }

  checkoutBatch(payload: CheckoutBatchPayload): Observable<CheckoutResponse> {
    return this.api.post<any>('orders/checkout', payload).pipe(
      map((res) => ({
        checkoutId: String(res.checkoutId ?? ''),
        orders: (res.orders ?? []).map((o: any) => ({
          id: String(o.id ?? ''),
          reference: o.reference != null ? String(o.reference) : undefined,
          fulfilmentMode: o.fulfilmentMode === 'PICKUP' ? 'PICKUP' : 'OFFLINE_DELIVERY',
          selectedMerchantId: o.selectedMerchantId ? String(o.selectedMerchantId) : undefined,
          totalAmount: Number(o.totalAmount ?? 0),
          items: (o.items ?? []).map((i: any) => ({
            productId: String(i.productId ?? ''),
            quantity: Number(i.quantity ?? 0),
          })),
        })),
        grandTotal: Number(res.grandTotal ?? 0),
      })),
    );
  }

  payCheckoutWithWallet(
    checkoutId: string,
    walletType?: OrderWalletType,
  ): Observable<PayCheckoutWalletResponse> {
    const normalizedWalletType =
      walletType === 'voucher' ? 'VOUCHER'
      : walletType === 'autoship' ? 'AUTOSHIP'
      : 'CASH';

    return this.api.post<PayCheckoutWalletResponse>(`orders/checkout/${checkoutId}/pay-wallet`, {
      walletType: normalizedWalletType,
    });
  }

  payOrderWithWallet(id: string, walletType?: OrderWalletType): Observable<void> {
    const normalizedWalletType =
      walletType === 'voucher' ? 'VOUCHER'
      : walletType === 'autoship' ? 'AUTOSHIP'
      : 'CASH';

    return this.api.post<void>(`orders/${id}/pay-wallet`, {
      walletType: normalizedWalletType,
    });
  }

  cancelOrder(id: string): Observable<Order> {
    return this.api.post<any>(`orders/${id}/cancel`, {}).pipe(map((res) => this.mapOrder(res)));
  }

  confirmOrderReceived(id: string): Observable<void> {
    return this.api.post<void>(`orders/${id}/confirm-received`, {});
  }

  getOrderDisputes(orderId: string): Observable<OrderDispute[]> {
    return this.api.get<any>(`orders/${orderId}/disputes`).pipe(
      map((res) => {
        const rows = Array.isArray(res) ? res : (res.disputes ?? res.data ?? []);
        return rows.map((d: any) => this.mapDispute(d));
      }),
    );
  }

  openOrderDispute(orderId: string, formData: FormData): Observable<OrderDispute> {
    return this.api.post<any>(`orders/${orderId}/disputes`, formData).pipe(
      map((res) => this.mapDispute(res)),
    );
  }

  static hasOpenDispute(disputes: OrderDispute[]): boolean {
    return disputes.some((d) => d.status === 'OPEN');
  }

  static canConfirmPickupReceived(order: Order, disputes: OrderDispute[]): boolean {
    return (
      order.fulfilmentMethod === 'pickup' &&
      order.rawStatus === 'PICKED_UP' &&
      order.hasOpenDispute !== true &&
      !OrderService.hasOpenDispute(disputes)
    );
  }

  static canOpenPickupDispute(order: Order, disputes: OrderDispute[]): boolean {
    return (
      order.fulfilmentMethod === 'pickup' &&
      order.rawStatus === 'PICKED_UP' &&
      order.hasOpenDispute !== true &&
      !OrderService.hasOpenDispute(disputes)
    );
  }

  static isAwaitingPickupCollection(order: Order): boolean {
    if (order.fulfilmentMethod !== 'pickup') return false;
    const status = order.rawStatus ?? '';
    return status === 'READY_FOR_PICKUP' || status === 'ASSIGNED_TO_MERCHANT';
  }

  static pickupHandoffMessage(order: Order): string {
    if (order.rawStatus === 'READY_FOR_PICKUP') {
      return 'Your order is ready for pickup. Visit the merchant below to collect your items. After the merchant confirms handoff, you can confirm receipt on this page.';
    }
    return 'Your order has been assigned to the merchant. They will prepare it for pickup — check back here once it is ready.';
  }

  private mapDispute(d: any): OrderDispute {
    return {
      id: String(d.id ?? ''),
      orderId: String(d.orderId ?? ''),
      reason: String(d.reason ?? ''),
      customerNotes: d.customerNotes ?? null,
      status: (String(d.status ?? 'OPEN').toUpperCase() as OrderDisputeStatus) || 'OPEN',
      createdAt: String(d.createdAt ?? new Date().toISOString()),
      outcome: d.outcome ?? null,
      adminNotes: d.adminNotes ?? d.admin_notes ?? null,
      resolvedAt: d.resolvedAt ?? d.resolved_at ?? null,
      closedAt: d.closedAt ?? d.closed_at ?? null,
    };
  }

  private mapOrder(o: any): Order {
    const rawId = String(o.id ?? '');
    const reference = String(o.reference ?? '').trim() || rawId;
    const rawStatus = String(o.status ?? '').toUpperCase();
    const merchant = o.selectedMerchant ?? o.merchant;
    const merchantLabel = merchant
      ? formatMerchantUsernameLabel(merchant.username, merchant.businessName ?? merchant.name)
      : '';

    return {
      id: rawId,
      reference,
      date: o.createdAt || new Date().toISOString(),
      items: o.items
        ? o.items.map((i: any) => ({
            productId: i.productId ? String(i.productId) : undefined,
            name: i.productName ?? i.name ?? 'Item',
            quantity: i.quantity,
            price: i.unitPrice ?? i.price ?? 0,
            pv: Number(i.pv ?? 0),
            directReferralPv: Number(i.directReferralPv ?? 0),
            cpv: Number(i.cpv ?? 0),
          }))
        : [],
      total: o.totalAmount || 0,
      currency: o.currency || 'NGN',
      fulfilmentMethod: o.fulfilmentMode?.toLowerCase() === 'pickup' ? 'pickup' : 'delivery',
      status: this.mapStatus(rawStatus),
      rawStatus,
      paymentMethod: o.paymentMethod || 'Cash',
      deliveryAddress: o.deliveryAddress || undefined,
      deliveryFee: o.deliveryFee != null ? Number(o.deliveryFee) : undefined,
      pickupLocationName:
        merchantLabel ||
        merchant?.displayName ||
        (o.selectedMerchantId ? 'Merchant Center' : undefined),
      pickupLocationAddress: merchant?.address ? String(merchant.address) : undefined,
      pickupLocationPhone: merchant?.phoneNumber ? String(merchant.phoneNumber) : undefined,
      selectedMerchantId: o.selectedMerchantId ? String(o.selectedMerchantId) : undefined,
      selectedMerchantName: merchantLabel || merchant?.name || undefined,
      checkoutBatchId: o.checkoutBatchId ? String(o.checkoutBatchId) : undefined,
      paymentId: o.paymentId ? String(o.paymentId) : undefined,
      hasOpenDispute:
        o.hasOpenDispute != null || o.has_open_dispute != null
          ? Boolean(o.hasOpenDispute ?? o.has_open_dispute)
          : undefined,
    };
  }

  private mapStatus(backendStatus: string): OrderStatus {
    const status = String(backendStatus ?? '').toUpperCase();

    switch (status) {
      case 'PENDING':
      case 'CREATED':
        return 'Pending';
      case 'APPROVED':
        return 'Approved';
      case 'PAID':
      case 'PROCESSING':
      case 'CONFIRMED':
      case 'ASSIGNED_TO_MERCHANT':
        return 'Processing';
      case 'READY_FOR_PICKUP':
      case 'READY FOR PICKUP':
        return 'Ready for Pickup';
      case 'PICKED_UP':
        return 'Picked Up';
      case 'OUT_FOR_DELIVERY':
      case 'OUT FOR DELIVERY':
      case 'IN_TRANSIT':
      case 'SHIPPED':
      case 'SENT':
      case 'OFFLINE_DELIVERY_REQUESTED':
        return 'Out for Delivery';
      case 'DELIVERED':
      case 'COMPLETED':
      case 'RECEIVED':
        return 'Delivered';
      case 'CANCELLED':
      case 'CANCELED':
      case 'DECLINED':
      case 'FAILED':
        return 'Cancelled';
      default:
        return 'Processing';
    }
  }

  clearFilters(): void {
    this.searchQueryState.set('');
    this.statusFilterState.set('');
  }
}
