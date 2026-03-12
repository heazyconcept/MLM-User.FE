import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError, tap, finalize } from 'rxjs/operators';
import { ApiService } from './api.service';

/* ── Enums ─────────────────────────────────────────────────────── */

export type MerchantType = 'REGIONAL' | 'NATIONAL' | 'GLOBAL';
export type MerchantStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED';
export type OrderStatus =
  | 'ASSIGNED_TO_MERCHANT'
  | 'READY_FOR_PICKUP'
  | 'OFFLINE_DELIVERY_REQUESTED'
  | 'DELIVERED'
  | 'PAID'
  | 'SENT';
export type FulfilmentMode = 'PICKUP' | 'OFFLINE_DELIVERY';
export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
export type AllocationStatus = 'PENDING' | 'ACCEPTED';
export type MerchantFeePaymentSource = 'REGISTRATION_WALLET' | 'CASH_WALLET' | 'PAYSTACK';

/* ── Interfaces ────────────────────────────────────────────────── */

export interface MerchantProfile {
  id: string;
  userId: string;
  type: MerchantType;
  status: MerchantStatus;
  serviceAreas: string[];
  createdAt: string;
}

export interface MerchantProfileResponse {
  id?: string;
  userId?: string;
  type?: MerchantType;
  status?: MerchantStatus;
  serviceAreas?: string[];
  merchantFeePaidAt?: string | null;
  createdAt?: string;
  message?: string;
}

export interface MerchantCategoryConfigItem {
  productId: string;
  quantity: number;
}

export interface MerchantCategoryConfig {
  id: string;
  merchantType: MerchantType;
  deliveryCommissionPct: number;
  productCommissionPct: number;
  registrationFeeUsd: number;
  onboardingItems: MerchantCategoryConfigItem[];
}

export interface AvailableMerchantProduct {
  id: string;
  name: string;
  sku: string;
}

export interface AvailableMerchant {
  id: string;
  name: string;
  serviceAreas: string[];
  products: AvailableMerchantProduct[];
  pickupAvailable: boolean;
}

export interface MerchantOrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  pv: number;
  cpv: number;
}

export interface MerchantOrderUser {
  id: string;
  email: string;
}

export interface DeliveryConfirmation {
  id: string;
  orderId: string;
  confirmedBy: string;
  proof: string | null;
  notes: string | null;
  createdAt: string;
  order?: MerchantOrder;
}

export interface MerchantOrder {
  id: string;
  userId: string;
  status: OrderStatus;
  totalAmount: number;
  baseAmount: number;
  currency: string;
  paymentMethod: string;
  fulfilmentMode: FulfilmentMode;
  selectedMerchantId: string;
  deliveryAddress: string | null;
  items: MerchantOrderItem[];
  user: MerchantOrderUser;
  deliveryConfirmation: DeliveryConfirmation | null;
  createdAt: string;
  updatedAt: string;
}

export interface MerchantOrdersResponse {
  orders: MerchantOrder[];
  total: number;
  limit: number;
  offset: number;
}

export interface MerchantOrdersQueryParams {
  status?: OrderStatus;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  offset?: number;
}

export interface MerchantEarningsByType {
  personalProduct: number;
  directReferralProduct: number;
  communityProduct: number;
  deliveryBonus: number;
  [key: string]: number;
}

export interface MerchantEarningsBlock {
  totalEarnings: number;
  availableEarnings: number;
  pendingEarnings: number;
  byType: MerchantEarningsByType;
}

export interface NetworkEarningsBlock {
  totalEarnings: number;
  availableEarnings: number;
  pendingEarnings: number;
  byType: Record<string, number>;
}

export interface MerchantEarningsSummary {
  merchantEarnings: MerchantEarningsBlock;
  networkEarnings: NetworkEarningsBlock;
  currency: string;
}

export interface MerchantAllocationProduct {
  id: string;
  name: string;
  sku: string;
}

export interface MerchantAllocation {
  id: string;
  merchantId: string;
  productId: string;
  quantity: number;
  status: AllocationStatus;
  createdAt: string;
  product: MerchantAllocationProduct;
}

export interface MerchantInventoryItem {
  merchantProductId: string;
  productId: string;
  productName: string;
  productSku: string;
  stockQuantity: number;
  stockStatus: StockStatus | null;
  isActive: boolean;
}

export interface UpdateStockBody {
  stockQuantity?: number;
  stockStatus?: StockStatus;
}

export interface InitiateMerchantFeeBody {
  source: MerchantFeePaymentSource;
  merchantId?: string;
  callbackUrl?: string;
}

export interface InitiateMerchantFeeResponse {
  message: string;
  gatewayUrl?: string;
  reference?: string;
}

export interface VerifyMerchantFeeBody {
  reference: string;
}

export interface VerifyMerchantFeeResponse {
  success: true;
  payment: unknown;
  message: string;
}

export interface ConfirmDeliveryBody {
  proof?: string;
  notes?: string;
}

export interface DeliveriesResponse {
  confirmations: DeliveryConfirmation[];
  total: number;
}

/* ── Service ───────────────────────────────────────────────────── */

@Injectable({ providedIn: 'root' })
export class MerchantService {
  private api = inject(ApiService);

  /* ── Signals ─────────────────────────────────────────────────── */
  private profileSignal = signal<MerchantProfileResponse | null>(null);
  private categoryConfigSignal = signal<MerchantCategoryConfig[]>([]);
  private ordersSignal = signal<MerchantOrder[]>([]);
  private ordersTotalSignal = signal(0);
  private orderDetailSignal = signal<MerchantOrder | null>(null);
  private deliveriesSignal = signal<DeliveryConfirmation[]>([]);
  private deliveriesTotalSignal = signal(0);
  private earningsSignal = signal<MerchantEarningsSummary | null>(null);
  private allocationsSignal = signal<MerchantAllocation[]>([]);
  private inventorySignal = signal<MerchantInventoryItem[]>([]);
  private loadingSignal = signal(false);
  private errorSignal = signal<string | null>(null);
  private actionLoadingSignal = signal(false);

  /* ── Public readonly signals ─────────────────────────────────── */
  readonly profile = this.profileSignal.asReadonly();
  readonly categoryConfig = this.categoryConfigSignal.asReadonly();
  readonly orders = this.ordersSignal.asReadonly();
  readonly ordersTotal = this.ordersTotalSignal.asReadonly();
  readonly orderDetail = this.orderDetailSignal.asReadonly();
  readonly deliveries = this.deliveriesSignal.asReadonly();
  readonly deliveriesTotal = this.deliveriesTotalSignal.asReadonly();
  readonly earnings = this.earningsSignal.asReadonly();
  readonly allocations = this.allocationsSignal.asReadonly();
  readonly inventory = this.inventorySignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly actionLoading = this.actionLoadingSignal.asReadonly();

  /* ── Computed helpers ────────────────────────────────────────── */

  readonly isMerchant = computed(() => {
    const p = this.profileSignal();
    return p != null && !p.message && !!p.id;
  });

  readonly merchantStatus = computed(() => {
    const p = this.profileSignal();
    return p?.status ?? null;
  });

  readonly isActiveMerchant = computed(() => this.merchantStatus() === 'ACTIVE');

  readonly totalMerchantSales = computed(() => {
    return this.ordersSignal().reduce((sum, o) => sum + o.totalAmount, 0);
  });

  readonly pendingFulfilmentsCount = computed(() => {
    return this.ordersSignal().filter(
      (o) =>
        o.status === 'ASSIGNED_TO_MERCHANT' ||
        o.status === 'READY_FOR_PICKUP' ||
        o.status === 'OFFLINE_DELIVERY_REQUESTED',
    ).length;
  });

  readonly inventorySummary = computed(() => {
    const inv = this.inventorySignal();
    const total = inv.length;
    const lowOrOut = inv.filter(
      (i) => i.stockStatus === 'LOW_STOCK' || i.stockStatus === 'OUT_OF_STOCK',
    ).length;
    return { total, lowOrOut };
  });

  /* ── Application & Discovery ─────────────────────────────────── */

  /** POST /merchants/apply */
  apply(type: MerchantType, serviceAreas: string[]): void {
    this.actionLoadingSignal.set(true);
    this.errorSignal.set(null);
    this.api
      .post<MerchantProfile>('merchants/apply', { type, serviceAreas })
      .pipe(
        tap((profile) => this.profileSignal.set(profile)),
        catchError((err) => {
          console.error('[MerchantService] apply failed', err);
          this.errorSignal.set(err?.error?.message || 'Failed to submit merchant application.');
          return of(null);
        }),
        finalize(() => this.actionLoadingSignal.set(false)),
      )
      .subscribe();
  }

  /** GET /merchants/category-config (public) */
  fetchCategoryConfig(): void {
    this.loadingSignal.set(true);
    this.api
      .get<{ configs: MerchantCategoryConfig[] }>('merchants/category-config')
      .pipe(
        tap((res) => {
          this.categoryConfigSignal.set(res.configs ?? []);
        }),
        catchError((err) => {
          console.error('[MerchantService] fetchCategoryConfig failed', err);
          this.errorSignal.set('Failed to load merchant categories.');
          return of(null);
        }),
        finalize(() => this.loadingSignal.set(false)),
      )
      .subscribe();
  }

  /** POST /merchants/merchant-fee/initiate */
  initiateMerchantFeePayment(
    body: InitiateMerchantFeeBody,
  ): Observable<InitiateMerchantFeeResponse | null> {
    this.actionLoadingSignal.set(true);
    this.errorSignal.set(null);
    return this.api.post<InitiateMerchantFeeResponse>('merchants/merchant-fee/initiate', body).pipe(
      tap(() => this.fetchProfile()),
      catchError((err) => {
        console.error('[MerchantService] initiateMerchantFeePayment failed', err);
        this.errorSignal.set(err?.error?.message || 'Failed to initiate fee payment.');
        return of(null);
      }),
      finalize(() => this.actionLoadingSignal.set(false)),
    );
  }

  /** POST /merchants/merchant-fee/verify */
  verifyMerchantFeePayment(
    body: VerifyMerchantFeeBody,
  ): Observable<VerifyMerchantFeeResponse | null> {
    this.actionLoadingSignal.set(true);
    this.errorSignal.set(null);
    return this.api.post<VerifyMerchantFeeResponse>('merchants/merchant-fee/verify', body).pipe(
      tap(() => this.fetchProfile()),
      catchError((err) => {
        console.error('[MerchantService] verifyMerchantFeePayment failed', err);
        this.errorSignal.set(err?.error?.message || 'Failed to verify fee payment.');
        return of(null);
      }),
      finalize(() => this.actionLoadingSignal.set(false)),
    );
  }

  /** GET /merchants/available (public) */
  fetchAvailableMerchants(location?: string): Observable<AvailableMerchant[]> {
    const params: Record<string, string> = {};
    if (location) params['location'] = location;
    return this.api.get<{ merchants: AvailableMerchant[] }>('merchants/available', params).pipe(
      map((res) => res.merchants ?? []),
      catchError((err) => {
        console.error('[MerchantService] fetchAvailableMerchants failed', err);
        return of([]);
      }),
    );
  }

  /** GET /merchants/me */
  fetchProfile(): void {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);
    this.api
      .get<MerchantProfileResponse>('merchants/me')
      .pipe(
        tap((res) => this.profileSignal.set(res)),
        catchError((err) => {
          console.error('[MerchantService] fetchProfile failed', err);
          this.errorSignal.set('Failed to load merchant profile.');
          return of(null);
        }),
        finalize(() => this.loadingSignal.set(false)),
      )
      .subscribe();
  }

  /* ── Orders ──────────────────────────────────────────────────── */

  /** GET /merchants/orders */
  fetchOrders(params: MerchantOrdersQueryParams = {}): void {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    const qp: Record<string, string | number> = {};
    if (params.status) qp['status'] = params.status;
    if (params.fromDate) qp['fromDate'] = params.fromDate;
    if (params.toDate) qp['toDate'] = params.toDate;
    qp['limit'] = params.limit ?? 20;
    qp['offset'] = params.offset ?? 0;

    this.api
      .get<MerchantOrdersResponse>('merchants/orders', qp)
      .pipe(
        tap((res) => {
          this.ordersSignal.set(res.orders ?? []);
          this.ordersTotalSignal.set(res.total ?? 0);
        }),
        catchError((err) => {
          console.error('[MerchantService] fetchOrders failed', err);
          this.errorSignal.set('Failed to load orders.');
          return of(null);
        }),
        finalize(() => this.loadingSignal.set(false)),
      )
      .subscribe();
  }

  /** GET /merchants/orders/:id */
  fetchOrderById(id: string): void {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);
    this.api
      .get<MerchantOrder>(`merchants/orders/${id}`)
      .pipe(
        tap((order) => this.orderDetailSignal.set(order)),
        catchError((err) => {
          console.error('[MerchantService] fetchOrderById failed', err);
          this.errorSignal.set('Failed to load order details.');
          return of(null);
        }),
        finalize(() => this.loadingSignal.set(false)),
      )
      .subscribe();
  }

  /** POST /merchants/orders/:id/mark-ready-for-pickup */
  markReadyForPickup(id: string): void {
    this.actionLoadingSignal.set(true);
    this.errorSignal.set(null);
    this.api
      .post<{ message: string }>(`merchants/orders/${id}/mark-ready-for-pickup`, {})
      .pipe(
        tap(() => this.fetchOrderById(id)),
        catchError((err) => {
          console.error('[MerchantService] markReadyForPickup failed', err);
          this.errorSignal.set(err?.error?.message || 'Failed to mark order as ready for pickup.');
          return of(null);
        }),
        finalize(() => this.actionLoadingSignal.set(false)),
      )
      .subscribe();
  }

  /** POST /merchants/orders/:id/mark-delivery-requested */
  markDeliveryRequested(id: string): void {
    this.actionLoadingSignal.set(true);
    this.errorSignal.set(null);
    this.api
      .post<{ message: string }>(`merchants/orders/${id}/mark-delivery-requested`, {})
      .pipe(
        tap(() => this.fetchOrderById(id)),
        catchError((err) => {
          console.error('[MerchantService] markDeliveryRequested failed', err);
          this.errorSignal.set(err?.error?.message || 'Failed to mark delivery requested.');
          return of(null);
        }),
        finalize(() => this.actionLoadingSignal.set(false)),
      )
      .subscribe();
  }

  /** POST /merchants/orders/:id/mark-sent */
  markSent(id: string): void {
    this.actionLoadingSignal.set(true);
    this.errorSignal.set(null);
    this.api
      .post<{ message: string }>(`merchants/orders/${id}/mark-sent`, {})
      .pipe(
        tap(() => this.fetchOrderById(id)),
        catchError((err) => {
          console.error('[MerchantService] markSent failed', err);
          this.errorSignal.set(err?.error?.message || 'Failed to mark order as sent.');
          return of(null);
        }),
        finalize(() => this.actionLoadingSignal.set(false)),
      )
      .subscribe();
  }

  /** POST /merchants/orders/:id/confirm-delivery */
  confirmDelivery(id: string, body: ConfirmDeliveryBody = {}): void {
    this.actionLoadingSignal.set(true);
    this.errorSignal.set(null);
    this.api
      .post<{ message: string }>(`merchants/orders/${id}/confirm-delivery`, body)
      .pipe(
        tap(() => this.fetchOrderById(id)),
        catchError((err) => {
          console.error('[MerchantService] confirmDelivery failed', err);
          this.errorSignal.set(err?.error?.message || 'Failed to confirm delivery.');
          return of(null);
        }),
        finalize(() => this.actionLoadingSignal.set(false)),
      )
      .subscribe();
  }

  /* ── Deliveries ──────────────────────────────────────────────── */

  /** GET /merchants/deliveries */
  fetchDeliveries(limit?: number, offset?: number): void {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);
    const qp: Record<string, number> = {};
    if (limit != null) qp['limit'] = limit;
    if (offset != null) qp['offset'] = offset;

    this.api
      .get<DeliveriesResponse>('merchants/deliveries', qp)
      .pipe(
        tap((res) => {
          this.deliveriesSignal.set(res.confirmations ?? []);
          this.deliveriesTotalSignal.set(res.total ?? 0);
        }),
        catchError((err) => {
          console.error('[MerchantService] fetchDeliveries failed', err);
          this.errorSignal.set('Failed to load deliveries.');
          return of(null);
        }),
        finalize(() => this.loadingSignal.set(false)),
      )
      .subscribe();
  }

  /* ── Earnings ────────────────────────────────────────────────── */

  /** GET /merchants/earnings/summary */
  fetchEarningsSummary(): void {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);
    this.api
      .get<MerchantEarningsSummary>('merchants/earnings/summary')
      .pipe(
        tap((res) => this.earningsSignal.set(res)),
        catchError((err) => {
          console.error('[MerchantService] fetchEarningsSummary failed', err);
          this.errorSignal.set('Failed to load earnings summary.');
          return of(null);
        }),
        finalize(() => this.loadingSignal.set(false)),
      )
      .subscribe();
  }

  /* ── Allocations ─────────────────────────────────────────────── */

  /** GET /merchants/me/allocations */
  fetchAllocations(): void {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);
    this.api
      .get<MerchantAllocation[]>('merchants/me/allocations')
      .pipe(
        tap((res) => this.allocationsSignal.set(res ?? [])),
        catchError((err) => {
          console.error('[MerchantService] fetchAllocations failed', err);
          this.errorSignal.set('Failed to load allocations.');
          return of(null);
        }),
        finalize(() => this.loadingSignal.set(false)),
      )
      .subscribe();
  }

  /** POST /merchants/me/allocations/:id/accept */
  acceptAllocation(id: string): void {
    this.actionLoadingSignal.set(true);
    this.errorSignal.set(null);
    this.api
      .post<{ message: string }>(`merchants/me/allocations/${id}/accept`, {})
      .pipe(
        tap(() => {
          this.fetchAllocations();
          this.fetchInventory();
        }),
        catchError((err) => {
          console.error('[MerchantService] acceptAllocation failed', err);
          this.errorSignal.set(err?.error?.message || 'Failed to accept allocation.');
          return of(null);
        }),
        finalize(() => this.actionLoadingSignal.set(false)),
      )
      .subscribe();
  }

  /* ── Inventory ───────────────────────────────────────────────── */

  /** GET /merchants/inventory */
  fetchInventory(): void {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);
    this.api
      .get<{ items: MerchantInventoryItem[] }>('merchants/inventory')
      .pipe(
        tap((res) => this.inventorySignal.set(res.items ?? [])),
        catchError((err) => {
          console.error('[MerchantService] fetchInventory failed', err);
          this.errorSignal.set('Failed to load inventory.');
          return of(null);
        }),
        finalize(() => this.loadingSignal.set(false)),
      )
      .subscribe();
  }

  /** PUT /merchants/inventory/:productId/stock */
  updateStock(productId: string, body: UpdateStockBody): void {
    this.actionLoadingSignal.set(true);
    this.errorSignal.set(null);
    this.api
      .put(`merchants/inventory/${productId}/stock`, body)
      .pipe(
        tap(() => this.fetchInventory()),
        catchError((err) => {
          console.error('[MerchantService] updateStock failed', err);
          this.errorSignal.set(err?.error?.message || 'Failed to update stock.');
          return of(null);
        }),
        finalize(() => this.actionLoadingSignal.set(false)),
      )
      .subscribe();
  }

  /* ── Helpers ─────────────────────────────────────────────────── */

  clearError(): void {
    this.errorSignal.set(null);
  }

  getCurrencySymbol(currency?: string): string {
    if (!currency) return '$';
    return currency === 'NGN' ? '₦' : '$';
  }

  formatCurrency(amount: number, currency?: string): string {
    const sym = this.getCurrencySymbol(currency);
    return `${sym}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  getStatusLabel(status: OrderStatus): string {
    const labels: Record<OrderStatus, string> = {
      ASSIGNED_TO_MERCHANT: 'Assigned',
      READY_FOR_PICKUP: 'Ready for Pickup',
      OFFLINE_DELIVERY_REQUESTED: 'Delivery Requested',
      DELIVERED: 'Delivered',
      PAID: 'Paid',
      SENT: 'Sent',
    };
    return labels[status] ?? status;
  }

  getStockStatusLabel(status: StockStatus | null): string {
    if (!status) return '—';
    const labels: Record<StockStatus, string> = {
      IN_STOCK: 'In Stock',
      LOW_STOCK: 'Low Stock',
      OUT_OF_STOCK: 'Out of Stock',
    };
    return labels[status] ?? status;
  }
}
