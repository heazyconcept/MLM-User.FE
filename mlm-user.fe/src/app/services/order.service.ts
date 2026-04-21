import { Injectable, signal, computed, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Observable, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';

export type OrderFulfilmentMethod = 'pickup' | 'delivery';
export type OrderWalletType = 'cash' | 'voucher' | 'autoship';

export type OrderStatus =
  | 'Pending'
  | 'Processing'
  | 'Ready for Pickup'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Cancelled';

export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  date: string;
  items: OrderItem[];
  total: number;
  currency: 'NGN' | 'USD';
  fulfilmentMethod: OrderFulfilmentMethod;
  status: OrderStatus;
  paymentMethod?: string;
  deliveryAddress?: string;
  deliveryFee?: number;
  pickupLocationName?: string;
  pickupLocationDistance?: string;
}

const ORDER_STATUSES: OrderStatus[] = [
  'Pending',
  'Processing',
  'Ready for Pickup',
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

  private mapOrder(o: any): Order {
    return {
      id: o.id,
      date: o.createdAt || new Date().toISOString(),
      items: o.items
        ? o.items.map((i: any) => ({
            name: i.productName,
            quantity: i.quantity,
            price: i.unitPrice,
          }))
        : [],
      total: o.totalAmount || 0,
      currency: o.currency || 'NGN',
      fulfilmentMethod: o.fulfilmentMode?.toLowerCase() === 'pickup' ? 'pickup' : 'delivery',
      status: this.mapStatus(o.status),
      paymentMethod: o.paymentMethod || 'Cash',
      deliveryAddress: o.deliveryAddress || undefined,
      pickupLocationName: o.selectedMerchantId ? 'Merchant Center' : undefined,
    };
  }

  private mapStatus(backendStatus: string): OrderStatus {
    const status = String(backendStatus ?? '').toUpperCase();

    switch (status) {
      case 'PENDING':
      case 'CREATED':
        return 'Pending';
      case 'APPROVED':
      case 'PAID':
      case 'PROCESSING':
      case 'CONFIRMED':
        return 'Processing';
      case 'READY_FOR_PICKUP':
      case 'READY FOR PICKUP':
        return 'Ready for Pickup';
      case 'OUT_FOR_DELIVERY':
      case 'OUT FOR DELIVERY':
      case 'IN_TRANSIT':
      case 'SHIPPED':
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
