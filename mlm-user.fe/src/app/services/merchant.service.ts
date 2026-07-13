import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError, tap, finalize, shareReplay, switchMap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { UserService } from './user.service';
import type { UsdtGatewayData } from './payment.service';
import { mapInitiatePaymentResponse } from './payment-initiate.mapper';

/* ── Enums ─────────────────────────────────────────────────────── */

export type MerchantType = 'REGIONAL' | 'NATIONAL' | 'GLOBAL';
export type MerchantStatus = 'DRAFT' | 'PENDING' | 'ACTIVE' | 'SUSPENDED';
export type OrderStatus =
  | 'ASSIGNED_TO_MERCHANT'
  | 'READY_FOR_PICKUP'
  | 'PICKED_UP'
  | 'OFFLINE_DELIVERY_REQUESTED'
  | 'DELIVERED'
  | 'PAID'
  | 'SENT';
export type FulfilmentMode = 'PICKUP' | 'OFFLINE_DELIVERY';
export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
export type AllocationStatus =
  | 'PENDING'
  | 'DISPATCHED'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'RECEIVED'
  | 'ACCEPTED'
  | 'CANCELLED';
export type StockDisputeStatus =
  | 'OPEN'
  | 'ADMIN_REJECTED'
  | 'ADMIN_ACCEPTED'
  | 'MERCHANT_ACKNOWLEDGED'
  | 'CLOSED';

export type InventoryAdjustmentType = 'INCREASE' | 'DECREASE';

export type InventoryAdjustmentDisputeStatus =
  | 'OPEN'
  | 'ADMIN_APPROVED'
  | 'ADMIN_REJECTED'
  | 'CLOSED';
export type MerchantFeePaymentSource =
  | 'REGISTRATION_WALLET'
  | 'CASH_WALLET'
  | 'PAYSTACK'
  | 'FLUTTERWAVE'
  | 'USDT';

export function isMerchantGatewaySource(source: MerchantFeePaymentSource): boolean {
  return source === 'PAYSTACK' || source === 'FLUTTERWAVE';
}

export function isMerchantUsdtSource(source: MerchantFeePaymentSource): boolean {
  return source === 'USDT';
}

/* ── Interfaces ────────────────────────────────────────────────── */

export interface MerchantProfile {
  id: string;
  userId: string;
  businessName?: string;
  phoneNumber?: string;
  address?: string;
  type: MerchantType;
  status: MerchantStatus;
  serviceAreas: string[];
  createdAt: string;
}

export interface MerchantProfileResponse {
  id?: string;
  userId?: string;
  businessName?: string;
  phoneNumber?: string;
  address?: string;
  type?: MerchantType;
  status?: MerchantStatus;
  serviceAreas?: string[];
  merchantFeePaidAt?: string | null;
  createdAt?: string;
  message?: string;
}

export interface UpdateMerchantProfileBody {
  /** Allowed before fee paid; locked after payment (403). */
  type?: MerchantType;
  businessName?: string;
  phoneNumber?: string;
  address?: string;
  serviceAreas?: string[];
}

export interface ApplyMerchantBody {
  phoneNumber: string;
  type: MerchantType;
  serviceAreas: string[];
  address?: string;
}

export interface MerchantCategoryConfigItem {
  productId: string;
  productName?: string;
  quantity: number;
}

export interface MerchantCategoryConfig {
  id?: string;
  merchantType: MerchantType;
  deliveryCommissionPct: number;
  productCommissionPct: number;
  registrationFeeUsd: number;
  registrationFeeNGN?: number;
  registrationPV: number;
  onboardingItems: MerchantCategoryConfigItem[];
}

export interface AvailableMerchantProduct {
  id: string;
  name: string;
  sku: string;
  stockQuantity?: number;
  inStock?: boolean;
}

export interface AvailableMerchant {
  id: string;
  name?: string;
  businessName?: string;
  username?: string;
  phoneNumber: string;
  address?: string;
  serviceAreas: string[];
  coversState?: boolean;
  products: AvailableMerchantProduct[];
  requestedProductInStock?: boolean | null;
  pickupAvailable: boolean;
}

export interface FetchPickupMerchantsParams {
  state: string;
  productId?: string;
  quantity?: number;
}

export interface CheckoutAvailabilityItem {
  productId: string;
  quantity: number;
}

export interface CheckoutAvailabilityBody {
  state: string;
  items: CheckoutAvailabilityItem[];
  selectedMerchantId?: string;
}

export interface MerchantWithStock {
  merchantId: string;
  username: string;
  businessName?: string;
  stockQuantity: number;
}

export interface MissingCheckoutItem {
  productId: string;
  quantityNeeded: number;
  merchantsWithStock: MerchantWithStock[];
  anyMerchantHasStock: boolean;
  adminDeliveryAvailable: boolean;
}

export interface SelectedMerchantAvailability {
  merchantId: string;
  canFulfillAll: boolean;
  missingItems: MissingCheckoutItem[];
}

export interface CheckoutAvailabilityResponse {
  merchants: AvailableMerchant[];
  selectedMerchant: SelectedMerchantAvailability | null;
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
  username?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
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
  buyerUsername?: string;
  buyerPhone?: string;
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

export type MerchantDashboardActivityType =
  | 'ORDER_RECEIVED'
  | 'DELIVERY_CONFIRMED'
  | 'EARNING_CREDITED'
  | 'ALLOCATION_DELIVERED'
  | 'STOCK_DISPUTE_OPENED';

export interface MerchantDashboardTrendPoint {
  date: string;
  amount: number;
}

export interface MerchantDashboardMonthlyOverview {
  month: string;
  label: string;
  amount: number;
}

export interface MerchantDashboardRecentActivity {
  id: string;
  type: MerchantDashboardActivityType;
  title: string;
  description: string;
  amount: number | null;
  currency: string | null;
  occurredAt: string;
  metadata?: Record<string, unknown>;
}

export interface MerchantDashboardInventoryCategory {
  categoryId: string;
  categoryName: string;
  productCount: number;
  totalStockQuantity: number;
}

export interface MerchantDashboardSummary {
  currency: string;
  sales: {
    totalSales: number;
    salesChangePct: number | null;
    trend: {
      period: string;
      points: MerchantDashboardTrendPoint[];
      changePctVsPreviousPeriod: number | null;
    };
    monthlyOverview: MerchantDashboardMonthlyOverview[];
  };
  orders: {
    pendingFulfillments: number;
    pendingByStatus?: Record<string, number>;
  };
  inventory: {
    totalProducts: number;
    totalStockQuantity?: number;
    lowStockCount: number;
    outOfStockCount: number;
    lowOrOutCount: number;
    byCategory?: MerchantDashboardInventoryCategory[];
  };
  earnings: {
    totalEarnings: number;
    availableEarnings: number;
    pendingEarnings: number;
    byType: MerchantEarningsByType;
  };
  allocations: {
    actionableCount: number;
  };
  recentActivity: MerchantDashboardRecentActivity[];
}

export interface MerchantAllocationProduct {
  id: string;
  name: string;
  sku: string;
}

export interface MerchantAllocationDispute {
  id: string;
  status: StockDisputeStatus;
  dispatchedQuantity: number;
  claimedReceivedQuantity: number;
}

export interface MerchantAllocation {
  id: string;
  merchantId?: string;
  productId: string;
  productName: string;
  quantity: number;
  status: AllocationStatus;
  quantityReceived: number | null;
  dispatchedAt: string | null;
  inTransitAt: string | null;
  deliveredAt: string | null;
  receivedAt: string | null;
  trackingReference: string | null;
  parentAllocationId: string | null;
  dispute: MerchantAllocationDispute | null;
  product?: MerchantAllocationProduct;
  createdAt?: string;
}

export interface MerchantStockDispute {
  id: string;
  status: StockDisputeStatus;
  dispatchedQuantity: number;
  claimedReceivedQuantity: number;
  allocationId?: string;
  productId?: string;
  productName?: string;
  merchantNotes?: string | null;
  createdAt?: string;
}

export interface ConfirmAllocationReceiptBody {
  quantityReceived: number;
  merchantNotes?: string;
  evidenceFiles?: File[];
}

export interface MerchantInventoryItem {
  merchantProductId: string;
  productId: string;
  productName: string;
  productSku: string;
  stockQuantity: number;
  /** Ledger-derived qty the platform recognizes. Falls back to stockQuantity when BE omits it. */
  authorizedQuantity: number;
  stockStatus: StockStatus | null;
  isActive: boolean;
  hasOpenAdjustmentDispute?: boolean;
  pendingRequestedQuantity?: number | null;
}

export interface MerchantInventoryAdjustmentDispute {
  id: string;
  productId: string;
  productName: string;
  productSku?: string;
  authorizedQuantity: number;
  requestedQuantity: number;
  adjustmentType: InventoryAdjustmentType;
  reason: string;
  status: InventoryAdjustmentDisputeStatus;
  adminNotes?: string | null;
  createdAt?: string;
  resolvedAt?: string | null;
}

export interface SubmitInventoryAdjustmentBody {
  requestedQuantity: number;
  adjustmentType: InventoryAdjustmentType;
  reason: string;
}

export interface UpdateStockBody {
  stockQuantity?: number;
  stockStatus?: StockStatus;
}

export const INVENTORY_ADJUSTMENT_REASON_MIN_LENGTH = 10;

export interface InitiateMerchantFeeBody {
  source: MerchantFeePaymentSource;
  merchantId?: string;
  callbackUrl?: string;
}

export interface InitiateMerchantFeeResponse {
  message: string;
  paymentId?: string;
  reference?: string;
  amount?: number;
  currency?: 'NGN' | 'USD';
  gatewayUrl?: string;
  gatewayData?: UsdtGatewayData;
}

export interface VerifyMerchantFeeBody {
  reference: string;
}

export interface VerifyMerchantFeeResponse {
  success: true;
  payment: unknown;
  message: string;
}

export interface MerchantUpgradeOption {
  merchantType: MerchantType;
  upgradeAmount: number;
  registrationPV: number;
  deliveryCommissionPct: number;
  productCommissionPct: number;
}

export interface MerchantUpgradeOptionsResponse {
  currentType: MerchantType;
  eligibleUpgrades: MerchantUpgradeOption[];
}

export interface InitiateMerchantUpgradeBody {
  source: MerchantFeePaymentSource;
  targetType: MerchantType;
  callbackUrl?: string;
}

export interface InitiateMerchantUpgradeResponse {
  paymentId: string;
  reference: string;
  amount: number;
  currency: 'NGN' | 'USD';
  gatewayUrl?: string;
  gatewayData?: UsdtGatewayData;
}

export interface VerifyMerchantUpgradeBody {
  reference: string;
}

export interface VerifyMerchantUpgradeResponse {
  success: true;
  payment: {
    id: string;
    reference: string;
    amount: number;
    currency: string;
    type: 'MERCHANT_UPGRADE';
    status: 'SUCCESS';
  };
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
  private userService = inject(UserService);

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
  private stockDisputesSignal = signal<MerchantStockDispute[]>([]);
  private inventoryAdjustmentDisputesSignal = signal<MerchantInventoryAdjustmentDispute[]>([]);
  private inventorySignal = signal<MerchantInventoryItem[]>([]);
  private dashboardSummarySignal = signal<MerchantDashboardSummary | null>(null);
  private dashboardLoadingSignal = signal(false);
  private loadingSignal = signal(false);
  private errorSignal = signal<string | null>(null);
  private actionLoadingSignal = signal(false);
  private profileRequest$: Observable<MerchantProfileResponse | null> | null = null;

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
  readonly stockDisputes = this.stockDisputesSignal.asReadonly();
  readonly inventoryAdjustmentDisputes = this.inventoryAdjustmentDisputesSignal.asReadonly();
  readonly inventory = this.inventorySignal.asReadonly();
  readonly dashboardSummary = this.dashboardSummarySignal.asReadonly();
  readonly dashboardLoading = this.dashboardLoadingSignal.asReadonly();
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

  readonly isFeePaid = computed(() => MerchantService.isFeePaidValue(this.profileSignal()?.merchantFeePaidAt));

  /** Admin rejected application: SUSPENDED and registration fee refunded. */
  readonly canReapplyAsMerchant = computed(
    () =>
      this.isMerchant() &&
      this.merchantStatus() === 'SUSPENDED' &&
      !this.isFeePaid(),
  );

  readonly needsPayment = computed(() => {
    if (this.canReapplyAsMerchant()) return true;
    if (!this.isMerchant()) return false;
    if (this.isFeePaid()) return false;
    const status = this.merchantStatus();
    return status !== 'ACTIVE' && status !== 'SUSPENDED';
  });

  readonly isAwaitingAdminApproval = computed(
    () => this.isMerchant() && this.isFeePaid() && this.merchantStatus() === 'PENDING',
  );

  readonly canUpgradeCategory = computed(
    () => this.isActiveMerchant() && this.profileSignal()?.type !== 'GLOBAL',
  );

  readonly actionableAllocationCount = computed(() => {
    const delivered = this.allocationsSignal().filter((a) => a.status === 'DELIVERED').length;
    const rejectedDisputes = this.stockDisputesSignal().filter(
      (d) => d.status === 'ADMIN_REJECTED',
    ).length;
    return delivered + rejectedDisputes;
  });

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

  readonly openInventoryAdjustmentDisputesCount = computed(
    () =>
      this.inventoryAdjustmentDisputesSignal().filter((d) => d.status === 'OPEN').length,
  );

  static resolveAdjustmentType(
    authorizedQuantity: number,
    requestedQuantity: number,
  ): InventoryAdjustmentType {
    return requestedQuantity >= authorizedQuantity ? 'INCREASE' : 'DECREASE';
  }

  static inventoryAdjustmentStatusLabel(status: InventoryAdjustmentDisputeStatus): string {
    const labels: Record<InventoryAdjustmentDisputeStatus, string> = {
      OPEN: 'Waiting for review',
      ADMIN_APPROVED: 'Approved',
      ADMIN_REJECTED: 'Not approved',
      CLOSED: 'Closed',
    };
    return labels[status] ?? status;
  }

  /* ── Application & Discovery ─────────────────────────────────── */

  /** POST /merchants/apply — creates DRAFT; returns observable so callers can chain payment */
  apply(
    type: MerchantType,
    serviceAreas: string[],
    phoneNumber: string,
    address: string,
  ): Observable<MerchantProfile | null> {
    this.actionLoadingSignal.set(true);
    this.errorSignal.set(null);
    const body: ApplyMerchantBody = {
      phoneNumber,
      type,
      serviceAreas,
      ...(address ? { address } : {}),
    };
    return this.api.post<MerchantProfile>('merchants/apply', body).pipe(
      tap((profile) => {
        if (profile && profile.id) {
          const asResponse: MerchantProfileResponse = {
            ...profile,
            merchantFeePaidAt: null,
          };
          this.applyProfile(asResponse);
        }
      }),
      catchError((err) => {
        console.error('[MerchantService] apply failed', err);
        this.errorSignal.set(err?.error?.message || 'Failed to submit merchant application.');
        return of(null);
      }),
      finalize(() => this.actionLoadingSignal.set(false)),
    );
  }

  /** GET /merchants/category-config (public) */
  fetchCategoryConfig(): void {
    this.loadingSignal.set(true);
    this.api
      .get<{ configs?: Record<string, unknown>[] }>('merchants/category-config')
      .pipe(
        tap((res) => {
          const rawConfigs = res.configs ?? [];
          this.categoryConfigSignal.set(
            rawConfigs
              .map((config) => this.mapCategoryConfig(config))
              .filter((config) => config.merchantType),
          );
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
    return this.api.post<Record<string, unknown>>('merchants/merchant-fee/initiate', body).pipe(
      map((res) => this.mapMerchantFeeInitiateResponse(res)),
      switchMap((res) => this.refreshProfileFromApi().pipe(map(() => res))),
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
      switchMap((res) => this.refreshProfileFromApi().pipe(map(() => res))),
      catchError((err) => {
        console.error('[MerchantService] verifyMerchantFeePayment failed', err);
        this.errorSignal.set(err?.error?.message || 'Failed to verify fee payment.');
        return of(null);
      }),
      finalize(() => this.actionLoadingSignal.set(false)),
    );
  }

  /** GET /merchants/me/upgrade-options */
  fetchUpgradeOptions(options?: { silent?: boolean }): Observable<MerchantUpgradeOptionsResponse | null> {
    return this.api.get<Record<string, unknown>>('merchants/me/upgrade-options').pipe(
      map((res) => this.mapUpgradeOptionsResponse(res)),
      catchError((err) => {
        console.error('[MerchantService] fetchUpgradeOptions failed', err);
        if (!options?.silent) {
          this.errorSignal.set(err?.error?.message || 'Failed to load merchant upgrade options.');
        }
        return of(null);
      }),
    );
  }

  /** POST /merchants/merchant-upgrade/initiate */
  initiateMerchantUpgrade(
    body: InitiateMerchantUpgradeBody,
  ): Observable<InitiateMerchantUpgradeResponse | null> {
    this.actionLoadingSignal.set(true);
    this.errorSignal.set(null);
    return this.api
      .post<Record<string, unknown>>('merchants/merchant-upgrade/initiate', body)
      .pipe(
        map((res) => this.mapMerchantUpgradeInitiateResponse(res)),
        switchMap((res) => this.refreshProfileFromApi().pipe(map(() => res))),
        catchError((err) => {
          console.error('[MerchantService] initiateMerchantUpgrade failed', err);
          const msg = err?.error?.message;
          this.errorSignal.set(
            (typeof msg === 'string' ? msg : Array.isArray(msg) ? msg[0] : null) ??
              'Failed to initiate merchant upgrade.',
          );
          return of(null);
        }),
        finalize(() => this.actionLoadingSignal.set(false)),
      );
  }

  /** POST /merchants/merchant-upgrade/verify */
  verifyMerchantUpgrade(
    body: VerifyMerchantUpgradeBody,
  ): Observable<VerifyMerchantUpgradeResponse | null> {
    this.actionLoadingSignal.set(true);
    this.errorSignal.set(null);
    return this.api
      .post<VerifyMerchantUpgradeResponse>('merchants/merchant-upgrade/verify', body)
      .pipe(
        switchMap((res) => this.refreshProfileFromApi().pipe(map(() => res))),
        catchError((err) => {
          console.error('[MerchantService] verifyMerchantUpgrade failed', err);
          const msg = err?.error?.message;
          this.errorSignal.set(
            (typeof msg === 'string' ? msg : Array.isArray(msg) ? msg[0] : null) ??
              'Failed to verify merchant upgrade payment.',
          );
          return of(null);
        }),
        finalize(() => this.actionLoadingSignal.set(false)),
      );
  }

  /** GET /merchants/available (public) */
  fetchAvailableMerchants(location?: string): Observable<AvailableMerchant[]> {
    const params: Record<string, string> = {};
    if (location) params['location'] = location;
    return this.fetchAvailableMerchantsFromApi(params);
  }

  /**
   * Pickup checkout: merchants in a state with address/phone for collection.
   * See mlm-user.fe/PICKUP_MERCHANTS_BY_STATE_API.md
   */
  fetchAvailableMerchantsForPickup(
    params: FetchPickupMerchantsParams,
  ): Observable<AvailableMerchant[]> {
    const qp: Record<string, string> = { state: params.state.trim() };
    if (params.productId) {
      qp['productId'] = params.productId;
      qp['quantity'] = String(params.quantity ?? 1);
    }
    return this.fetchAvailableMerchantsFromApi(qp).pipe(
      catchError((err) => {
        console.error('[MerchantService] fetchAvailableMerchantsForPickup failed', err);
        return throwError(() => err);
      }),
    );
  }

  /** All active merchants in a state (never filtered by stock client-side). */
  fetchPickupMerchantsForCart(
    state: string,
    _cartItems?: { productId: string; quantity: number }[],
  ): Observable<AvailableMerchant[]> {
    return this.fetchAvailableMerchantsForPickup({ state });
  }

  /** POST /merchants/checkout/availability */
  checkCheckoutAvailability(
    body: CheckoutAvailabilityBody,
  ): Observable<CheckoutAvailabilityResponse> {
    return this.api
      .post<{ merchants?: unknown[]; selectedMerchant?: unknown }>(
        'merchants/checkout/availability',
        body,
      )
      .pipe(
        map((res) => ({
          merchants: (res.merchants ?? []).map((m) =>
            this.mapAvailableMerchant(m as Record<string, unknown>),
          ),
          selectedMerchant: res.selectedMerchant
            ? this.mapSelectedMerchantAvailability(
                res.selectedMerchant as Record<string, unknown>,
              )
            : null,
        })),
        catchError((err) => {
          console.error('[MerchantService] checkCheckoutAvailability failed', err);
          return throwError(() => err);
        }),
      );
  }

  static extractApiErrorMessage(err: unknown, fallback: string): string {
    const body = (err as { error?: { message?: string | string[] } })?.error;
    const msg = body?.message;
    if (typeof msg === 'string' && msg.trim()) return msg;
    if (Array.isArray(msg) && typeof msg[0] === 'string') return msg[0];
    return fallback;
  }

  private fetchAvailableMerchantsFromApi(
    params: Record<string, string>,
  ): Observable<AvailableMerchant[]> {
    return this.api.get<{ merchants?: unknown[] }>('merchants/available', params).pipe(
      map((res) =>
        (res.merchants ?? []).map((m) => this.mapAvailableMerchant(m as Record<string, unknown>)),
      ),
      catchError((err) => {
        console.error('[MerchantService] fetchAvailableMerchants failed', err);
        return of([]);
      }),
    );
  }

  private mapAvailableMerchant(raw: Record<string, unknown>): AvailableMerchant {
    const productsRaw = raw['products'];
    const products: AvailableMerchantProduct[] = Array.isArray(productsRaw)
      ? productsRaw.map((p) => {
          const row = p as Record<string, unknown>;
          return {
            id: String(row['id'] ?? ''),
            name: String(row['name'] ?? ''),
            sku: String(row['sku'] ?? ''),
            stockQuantity: row['stockQuantity'] != null ? Number(row['stockQuantity']) : undefined,
            inStock: row['inStock'] != null ? Boolean(row['inStock']) : undefined,
          };
        })
      : [];

    const requested = raw['requestedProductInStock'];
    return {
      id: String(raw['id'] ?? ''),
      name: raw['name'] != null ? String(raw['name']) : undefined,
      businessName: raw['businessName'] != null ? String(raw['businessName']) : undefined,
      username: raw['username'] != null ? String(raw['username']) : undefined,
      phoneNumber: String(raw['phoneNumber'] ?? ''),
      address: raw['address'] != null ? String(raw['address']) : undefined,
      serviceAreas: Array.isArray(raw['serviceAreas'])
        ? (raw['serviceAreas'] as unknown[]).map(String)
        : [],
      coversState: raw['coversState'] != null ? Boolean(raw['coversState']) : undefined,
      products,
      requestedProductInStock:
        requested === null || requested === undefined ? null : Boolean(requested),
      pickupAvailable: Boolean(raw['pickupAvailable']),
    };
  }

  private mapSelectedMerchantAvailability(
    raw: Record<string, unknown>,
  ): SelectedMerchantAvailability {
    const missingRaw = raw['missingItems'];
    const missingItems: MissingCheckoutItem[] = Array.isArray(missingRaw)
      ? missingRaw.map((item) => {
          const row = item as Record<string, unknown>;
          const merchantsRaw = row['merchantsWithStock'];
          return {
            productId: String(row['productId'] ?? ''),
            quantityNeeded: Number(row['quantityNeeded'] ?? 0),
            merchantsWithStock: Array.isArray(merchantsRaw)
              ? merchantsRaw.map((m) => {
                  const mr = m as Record<string, unknown>;
                  return {
                    merchantId: String(mr['merchantId'] ?? ''),
                    username: String(mr['username'] ?? ''),
                    businessName:
                      mr['businessName'] != null ? String(mr['businessName']) : undefined,
                    stockQuantity: Number(mr['stockQuantity'] ?? 0),
                  };
                })
              : [],
            anyMerchantHasStock: Boolean(row['anyMerchantHasStock']),
            adminDeliveryAvailable: Boolean(row['adminDeliveryAvailable']),
          };
        })
      : [];

    return {
      merchantId: String(raw['merchantId'] ?? ''),
      canFulfillAll: Boolean(raw['canFulfillAll']),
      missingItems,
    };
  }

  private readonly LOCAL_PROFILE_KEY = 'mlm_local_merchant_profile';

  private saveLocalMerchantProfile(profile: MerchantProfileResponse): void {
    try {
      localStorage.setItem(this.LOCAL_PROFILE_KEY, JSON.stringify(profile));
    } catch (e) {
      console.error('[MerchantService] Failed to save local profile', e);
    }
  }

  private getLocalMerchantProfile(): MerchantProfileResponse | null {
    try {
      const stored = localStorage.getItem(this.LOCAL_PROFILE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  private static isFeePaidValue(val: string | null | undefined): boolean {
    return val != null && val !== '' && val !== 'null';
  }

  /** Merge API profile with local preview fields; server fields always win. */
  private mergeProfileWithLocal(
    api: MerchantProfileResponse,
    local: MerchantProfileResponse | null,
  ): MerchantProfileResponse {
    if (!local || !api.id || api.id !== local.id) {
      return api;
    }
    return {
      ...api,
      businessName: api.businessName ?? local.businessName,
      phoneNumber: api.phoneNumber ?? local.phoneNumber,
      address: api.address ?? local.address,
      serviceAreas:
        api.serviceAreas && api.serviceAreas.length > 0 ? api.serviceAreas : local.serviceAreas,
    };
  }

  private applyProfile(api: MerchantProfileResponse): void {
    const local = this.getLocalMerchantProfile();
    const merged = this.mergeProfileWithLocal(api, local);
    this.profileSignal.set(merged);
    this.saveLocalMerchantProfile(merged);
    if (merged.status === 'ACTIVE') {
      this.userService.markAsMerchant();
    }
  }

  private refreshProfileFromApi(): Observable<MerchantProfileResponse | null> {
    return this.api.get<MerchantProfileResponse>('merchants/me').pipe(
      tap((res) => {
        if (res && res.id && !res.message) {
          this.applyProfile(res);
        } else {
          this.profileSignal.set(res);
        }
      }),
    );
  }

  isFeeAlreadyPaidError(message: string | null | undefined): boolean {
    if (!message) return false;
    const m = message.toLowerCase();
    return m.includes('already paid') || m.includes('fee already');
  }

  /** GET /merchants/me */
  fetchProfile$(): Observable<MerchantProfileResponse | null> {
    if (this.profileRequest$) {
      return this.profileRequest$;
    }

    this.loadingSignal.set(true);
    this.errorSignal.set(null);
    this.profileRequest$ = this.refreshProfileFromApi().pipe(
      catchError((err) => {
        console.error('[MerchantService] fetchProfile failed', err);
        this.errorSignal.set('Failed to load merchant profile.');
        return of(null);
      }),
      finalize(() => {
        this.profileRequest$ = null;
        this.loadingSignal.set(false);
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    return this.profileRequest$;
  }

  fetchProfile(): void {
    this.fetchProfile$().subscribe();
  }

  /** PATCH /merchants/me — update profile; `type` allowed only before merchant fee is paid */
  updateProfile(body: UpdateMerchantProfileBody): Observable<MerchantProfileResponse | null> {
    this.actionLoadingSignal.set(true);
    this.errorSignal.set(null);

    return this.api.patch<MerchantProfileResponse>('merchants/me', body).pipe(
      switchMap((updatedProfile) => {
        if (updatedProfile?.id && !updatedProfile.message) {
          this.applyProfile(updatedProfile);
          return of(updatedProfile);
        }
        return this.refreshProfileFromApi();
      }),
      catchError((err) => {
        console.error('[MerchantService] updateProfile failed', err);
        const msg = err?.error?.message;
        this.errorSignal.set(
          (typeof msg === 'string' ? msg : Array.isArray(msg) ? msg[0] : null) ??
            'Failed to update merchant profile.',
        );
        return of(null);
      }),
      finalize(() => this.actionLoadingSignal.set(false)),
    );
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
          return this.handleOperationalFetchError(err, 'Failed to load orders.');
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

  /** POST /merchants/orders/:id/mark-picked-up — PICKUP handoff to customer */
  markPickedUp(id: string): void {
    this.actionLoadingSignal.set(true);
    this.errorSignal.set(null);
    this.api
      .post<{ message: string }>(`merchants/orders/${id}/mark-picked-up`, {})
      .pipe(
        tap(() => this.fetchOrderById(id)),
        catchError((err) => {
          console.error('[MerchantService] markPickedUp failed', err);
          this.errorSignal.set(err?.error?.message || 'Failed to mark order as picked up.');
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

  /* ── Dashboard summary ───────────────────────────────────────── */

  /** GET /merchants/dashboard/summary */
  fetchDashboardSummary$(params?: {
    trendDays?: number;
    salesMonths?: number;
  }): Observable<MerchantDashboardSummary | null> {
    this.dashboardLoadingSignal.set(true);
    this.errorSignal.set(null);

    const query: Record<string, number> = {};
    if (params?.trendDays != null) query['trendDays'] = params.trendDays;
    if (params?.salesMonths != null) query['salesMonths'] = params.salesMonths;

    return this.api.get<unknown>('merchants/dashboard/summary', query).pipe(
      map((res) => this.mapDashboardSummary(res)),
      tap((summary) => this.dashboardSummarySignal.set(summary)),
      catchError((err) => {
        console.error('[MerchantService] fetchDashboardSummary failed', err);
        return this.handleOperationalFetchError(err, 'Failed to load dashboard summary.');
      }),
      finalize(() => this.dashboardLoadingSignal.set(false)),
    );
  }

  fetchDashboardSummary(params?: { trendDays?: number; salesMonths?: number }): void {
    this.fetchDashboardSummary$(params).subscribe();
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
          return this.handleOperationalFetchError(err, 'Failed to load earnings summary.');
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
      .get<MerchantAllocation[] | { data?: MerchantAllocation[]; allocations?: MerchantAllocation[] }>(
        'merchants/me/allocations',
      )
      .pipe(
        map((res) => this.normalizeAllocationsResponse(res)),
        tap((res) => this.allocationsSignal.set(res)),
        catchError((err) => {
          console.error('[MerchantService] fetchAllocations failed', err);
          return this.handleOperationalFetchError(err, 'Failed to load allocations.');
        }),
        finalize(() => this.loadingSignal.set(false)),
      )
      .subscribe();
  }

  /** GET /merchants/me/stock-disputes */
  fetchStockDisputes(): void {
    this.api
      .get<
        MerchantStockDispute[] | { data?: MerchantStockDispute[]; disputes?: MerchantStockDispute[] }
      >('merchants/me/stock-disputes')
      .pipe(
        map((res) => this.normalizeStockDisputesResponse(res)),
        tap((res) => this.stockDisputesSignal.set(res)),
        catchError((err) => {
          console.error('[MerchantService] fetchStockDisputes failed', err);
          return of([]);
        }),
      )
      .subscribe();
  }

  /** POST /merchants/me/allocations/:id/confirm-receipt */
  confirmAllocationReceipt(id: string, body: ConfirmAllocationReceiptBody): Observable<{ message?: string }> {
    this.actionLoadingSignal.set(true);
    this.errorSignal.set(null);

    const formData = new FormData();
    formData.append('quantityReceived', String(body.quantityReceived));
    if (body.merchantNotes?.trim()) {
      formData.append('merchantNotes', body.merchantNotes.trim());
    }
    for (const file of body.evidenceFiles ?? []) {
      formData.append('evidence', file, file.name);
    }

    return this.api.post<{ message?: string }>(`merchants/me/allocations/${id}/confirm-receipt`, formData).pipe(
      tap(() => {
        this.fetchAllocations();
        this.fetchStockDisputes();
        this.fetchInventory();
      }),
      catchError((err) => {
        console.error('[MerchantService] confirmAllocationReceipt failed', err);
        this.errorSignal.set(err?.error?.message || 'Failed to confirm receipt.');
        return throwError(() => err);
      }),
      finalize(() => this.actionLoadingSignal.set(false)),
    );
  }

  /** POST /merchants/me/stock-disputes/:id/acknowledge */
  acknowledgeStockDispute(id: string): void {
    this.actionLoadingSignal.set(true);
    this.errorSignal.set(null);
    this.api
      .post<{ message?: string }>(`merchants/me/stock-disputes/${id}/acknowledge`, {})
      .pipe(
        tap(() => {
          this.fetchAllocations();
          this.fetchStockDisputes();
          this.fetchInventory();
        }),
        catchError((err) => {
          console.error('[MerchantService] acknowledgeStockDispute failed', err);
          this.errorSignal.set(err?.error?.message || 'Failed to acknowledge dispute.');
          return of(null);
        }),
        finalize(() => this.actionLoadingSignal.set(false)),
      )
      .subscribe();
  }

  static canConfirmReceipt(allocation: MerchantAllocation): boolean {
    return allocation.status === 'DELIVERED';
  }

  static needsDisputeAcknowledgement(dispute: MerchantAllocationDispute | MerchantStockDispute): boolean {
    return dispute.status === 'ADMIN_REJECTED';
  }

  static allocationStatusLabel(status: AllocationStatus): string {
    const labels: Record<AllocationStatus, string> = {
      PENDING: 'Pending dispatch',
      DISPATCHED: 'Dispatched',
      IN_TRANSIT: 'In transit',
      DELIVERED: 'Delivered',
      RECEIVED: 'Received',
      ACCEPTED: 'Accepted',
      CANCELLED: 'Cancelled',
    };
    return labels[status] ?? status;
  }

  /* ── Inventory ───────────────────────────────────────────────── */

  /** GET /merchants/inventory */
  fetchInventory(): void {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);
    this.api
      .get<{ items: unknown[] }>('merchants/inventory')
      .pipe(
        map((res) => (res.items ?? []).map((raw) => this.mapInventoryItem(raw as Record<string, unknown>))),
        tap((items) => this.inventorySignal.set(items)),
        catchError((err) => {
          console.error('[MerchantService] fetchInventory failed', err);
          return this.handleOperationalFetchError(err, 'Failed to load inventory.');
        }),
        finalize(() => this.loadingSignal.set(false)),
      )
      .subscribe();
  }

  /** GET /merchants/me/inventory-adjustment-disputes */
  fetchInventoryAdjustmentDisputes(): void {
    this.api
      .get<
        | MerchantInventoryAdjustmentDispute[]
        | { disputes?: unknown[]; data?: unknown[]; items?: unknown[]; total?: number }
      >('merchants/me/inventory-adjustment-disputes')
      .pipe(
        map((res) => this.normalizeInventoryAdjustmentDisputesResponse(res)),
        tap((disputes) => this.inventoryAdjustmentDisputesSignal.set(disputes)),
        catchError((err) => {
          console.error('[MerchantService] fetchInventoryAdjustmentDisputes failed', err);
          return of([]);
        }),
      )
      .subscribe();
  }

  /**
   * POST /merchants/inventory/:productId/adjustment-requests
   * Creates a Product Dispute when requested qty differs from authorized qty.
   */
  submitInventoryAdjustmentRequest(
    productId: string,
    body: SubmitInventoryAdjustmentBody,
  ): Observable<MerchantInventoryAdjustmentDispute | null> {
    this.actionLoadingSignal.set(true);
    this.errorSignal.set(null);

    return this.api
      .post<Record<string, unknown>>(
        `merchants/inventory/${productId}/adjustment-requests`,
        body,
      )
      .pipe(
        map((raw) => this.mapInventoryAdjustmentDispute(raw)),
        tap(() => {
          this.fetchInventory();
          this.fetchInventoryAdjustmentDisputes();
        }),
        catchError((err) => {
          console.error('[MerchantService] submitInventoryAdjustmentRequest failed', err);
          const msg = MerchantService.extractApiErrorMessage(
            err,
            'Failed to submit adjustment request.',
          );
          this.errorSignal.set(msg);
          return of(null);
        }),
        finalize(() => this.actionLoadingSignal.set(false)),
      );
  }

  /** PUT /merchants/inventory/:productId/stock — status-only or sync-to-authorized quantity */
  updateStock(productId: string, body: UpdateStockBody): Observable<unknown> {
    this.actionLoadingSignal.set(true);
    this.errorSignal.set(null);
    return this.api.put(`merchants/inventory/${productId}/stock`, body).pipe(
      tap(() => this.fetchInventory()),
      catchError((err) => {
        console.error('[MerchantService] updateStock failed', err);
        this.errorSignal.set(
          MerchantService.extractApiErrorMessage(err, 'Failed to update stock.'),
        );
        return of(null);
      }),
      finalize(() => this.actionLoadingSignal.set(false)),
    );
  }

  /* ── Helpers ─────────────────────────────────────────────────── */

  private handleOperationalFetchError(err: unknown, message: string): Observable<null> {
    const status = (err as { status?: number })?.status;
    if (status === 403 && this.merchantStatus() !== 'ACTIVE') {
      return of(null);
    }
    this.errorSignal.set(message);
    return of(null);
  }

  private mapUpgradeOptionsResponse(
    raw: Record<string, unknown>,
  ): MerchantUpgradeOptionsResponse {
    const currentType = String(raw['currentType'] ?? '') as MerchantType;
    const rawUpgrades = (raw['eligibleUpgrades'] ?? []) as Record<string, unknown>[];
    const eligibleUpgrades: MerchantUpgradeOption[] = rawUpgrades.map((opt) => ({
      merchantType: String(opt['merchantType'] ?? '') as MerchantType,
      upgradeAmount: Number(opt['upgradeAmount'] ?? 0),
      registrationPV: Number(opt['registrationPV'] ?? 0),
      deliveryCommissionPct: Number(opt['deliveryCommissionPct'] ?? 0),
      productCommissionPct: Number(opt['productCommissionPct'] ?? 0),
    }));

    return { currentType, eligibleUpgrades };
  }

  private mapCategoryConfig(raw: Record<string, unknown>): MerchantCategoryConfig {
    const merchantType = String(raw['merchantType'] ?? '') as MerchantType;
    const rawItems = (raw['onboardingItems'] ?? []) as Record<string, unknown>[];

    let onboardingItems: MerchantCategoryConfigItem[] = rawItems
      .filter((item) => item['productId'])
      .map((item) => ({
        productId: String(item['productId']),
        productName: item['productName'] ? String(item['productName']).trim() : undefined,
        quantity: Number(item['quantity'] ?? 0),
      }));

    const legacyProductId = raw['onboardingProductId'];
    if (onboardingItems.length === 0 && legacyProductId) {
      onboardingItems = [
        {
          productId: String(legacyProductId),
          quantity: Number(raw['onboardingQuantity'] ?? 1),
        },
      ];
    }

    return {
      id: raw['id'] ? String(raw['id']) : undefined,
      merchantType,
      deliveryCommissionPct: Number(raw['deliveryCommissionPct'] ?? 0),
      productCommissionPct: Number(raw['productCommissionPct'] ?? 0),
      registrationFeeUsd: Number(raw['registrationFeeUsd'] ?? 0),
      registrationFeeNGN:
        raw['registrationFeeNGN'] != null ? Number(raw['registrationFeeNGN']) : undefined,
      registrationPV: Number(raw['registrationPV'] ?? 0),
      onboardingItems,
    };
  }

  clearError(): void {
    this.errorSignal.set(null);
  }

  private mapMerchantFeeInitiateResponse(res: Record<string, unknown>): InitiateMerchantFeeResponse {
    const mapped = mapInitiatePaymentResponse(res);
    return {
      message: String(res['message'] ?? ''),
      paymentId: mapped.paymentId,
      reference: mapped.reference,
      amount: mapped.amount,
      currency: mapped.currency,
      gatewayUrl: mapped.gatewayUrl,
      gatewayData: mapped.gatewayData,
    };
  }

  private mapMerchantUpgradeInitiateResponse(
    res: Record<string, unknown>,
  ): InitiateMerchantUpgradeResponse {
    const mapped = mapInitiatePaymentResponse(res);
    return {
      paymentId: mapped.paymentId ?? String(res['paymentId'] ?? ''),
      reference: mapped.reference,
      amount: mapped.amount ?? Number(res['amount'] ?? 0),
      currency: (mapped.currency ?? res['currency'] ?? 'USD') as 'NGN' | 'USD',
      gatewayUrl: mapped.gatewayUrl,
      gatewayData: mapped.gatewayData,
    };
  }

  private normalizeAllocationsResponse(
    res:
      | MerchantAllocation[]
      | { data?: unknown; allocations?: unknown; items?: unknown },
  ): MerchantAllocation[] {
    const source = (Array.isArray(res)
      ? res
      : ((res['data'] ?? res['allocations'] ?? res['items'] ?? []) as unknown[])) as Record<
      string,
      unknown
    >[];
    return source.map((raw) => this.mapAllocation(raw));
  }

  private normalizeStockDisputesResponse(
    res:
      | MerchantStockDispute[]
      | { data?: unknown; disputes?: unknown; items?: unknown },
  ): MerchantStockDispute[] {
    const source = (Array.isArray(res)
      ? res
      : ((res['data'] ?? res['disputes'] ?? res['items'] ?? []) as unknown[])) as Record<
      string,
      unknown
    >[];
    return source.map((raw) => this.mapStockDispute(raw));
  }

  private mapAllocationDispute(raw: Record<string, unknown>): MerchantAllocationDispute | null {
    if (!raw || typeof raw !== 'object' || !raw['id']) return null;
    return {
      id: String(raw['id']),
      status: String(raw['status'] ?? 'OPEN') as StockDisputeStatus,
      dispatchedQuantity: Number(raw['dispatchedQuantity'] ?? raw['dispatched_quantity'] ?? 0),
      claimedReceivedQuantity: Number(
        raw['claimedReceivedQuantity'] ?? raw['claimed_received_quantity'] ?? 0,
      ),
    };
  }

  private mapAllocation(raw: Record<string, unknown>): MerchantAllocation {
    const productRaw = (raw['product'] as Record<string, unknown> | undefined) ?? {};
    const productId = String(raw['productId'] ?? productRaw['id'] ?? '');
    const productName = String(
      raw['productName'] ?? productRaw['name'] ?? productRaw['productName'] ?? '—',
    );
    const disputeRaw = raw['dispute'] as Record<string, unknown> | null | undefined;

    return {
      id: String(raw['id'] ?? ''),
      merchantId: raw['merchantId'] ? String(raw['merchantId']) : undefined,
      productId,
      productName,
      quantity: Number(raw['quantity'] ?? 0),
      status: String(raw['status'] ?? 'PENDING') as AllocationStatus,
      quantityReceived:
        raw['quantityReceived'] != null || raw['quantity_received'] != null
          ? Number(raw['quantityReceived'] ?? raw['quantity_received'])
          : null,
      dispatchedAt: (raw['dispatchedAt'] ?? raw['dispatched_at'] ?? null) as string | null,
      inTransitAt: (raw['inTransitAt'] ?? raw['in_transit_at'] ?? null) as string | null,
      deliveredAt: (raw['deliveredAt'] ?? raw['delivered_at'] ?? null) as string | null,
      receivedAt: (raw['receivedAt'] ?? raw['received_at'] ?? null) as string | null,
      trackingReference: (raw['trackingReference'] ?? raw['tracking_reference'] ?? null) as
        | string
        | null,
      parentAllocationId: (raw['parentAllocationId'] ?? raw['parent_allocation_id'] ?? null) as
        | string
        | null,
      dispute: disputeRaw ? this.mapAllocationDispute(disputeRaw) : null,
      product: productId
        ? {
            id: productId,
            name: productName,
            sku: String(productRaw['sku'] ?? raw['productSku'] ?? raw['product_sku'] ?? '—'),
          }
        : undefined,
      createdAt: (raw['createdAt'] ?? raw['created_at']) as string | undefined,
    };
  }

  private mapStockDispute(raw: Record<string, unknown>): MerchantStockDispute {
    const allocation = (raw['allocation'] as Record<string, unknown> | undefined) ?? {};
    return {
      id: String(raw['id'] ?? ''),
      status: String(raw['status'] ?? 'OPEN') as StockDisputeStatus,
      dispatchedQuantity: Number(raw['dispatchedQuantity'] ?? raw['dispatched_quantity'] ?? 0),
      claimedReceivedQuantity: Number(
        raw['claimedReceivedQuantity'] ?? raw['claimed_received_quantity'] ?? 0,
      ),
      allocationId: String(
        raw['allocationId'] ?? raw['allocation_id'] ?? allocation['id'] ?? '',
      ) || undefined,
      productId: String(raw['productId'] ?? allocation['productId'] ?? '') || undefined,
      productName: String(
        raw['productName'] ?? allocation['productName'] ?? allocation['product'] ?? '',
      ) || undefined,
      merchantNotes: (raw['merchantNotes'] ?? raw['merchant_notes'] ?? null) as string | null,
      createdAt: (raw['createdAt'] ?? raw['created_at']) as string | undefined,
    };
  }

  private mapInventoryItem(raw: Record<string, unknown>): MerchantInventoryItem {
    const stockQuantity = Number(raw['stockQuantity'] ?? raw['stock_quantity'] ?? 0);
    const authorizedRaw = raw['authorizedQuantity'] ?? raw['authorized_quantity'];
    const authorizedQuantity =
      authorizedRaw != null ? Number(authorizedRaw) : stockQuantity;

    return {
      merchantProductId: String(raw['merchantProductId'] ?? raw['merchant_product_id'] ?? raw['id'] ?? ''),
      productId: String(raw['productId'] ?? raw['product_id'] ?? ''),
      productName: String(raw['productName'] ?? raw['product_name'] ?? '—'),
      productSku: String(raw['productSku'] ?? raw['product_sku'] ?? raw['sku'] ?? '—'),
      stockQuantity,
      authorizedQuantity,
      stockStatus: (raw['stockStatus'] ?? raw['stock_status'] ?? null) as StockStatus | null,
      isActive: raw['isActive'] !== false && raw['is_active'] !== false,
      hasOpenAdjustmentDispute: Boolean(
        raw['hasOpenAdjustmentDispute'] ?? raw['has_open_adjustment_dispute'],
      ),
      pendingRequestedQuantity:
        raw['pendingRequestedQuantity'] != null || raw['pending_requested_quantity'] != null
          ? Number(raw['pendingRequestedQuantity'] ?? raw['pending_requested_quantity'])
          : null,
    };
  }

  private normalizeInventoryAdjustmentDisputesResponse(
    res:
      | MerchantInventoryAdjustmentDispute[]
      | { disputes?: unknown[]; data?: unknown[]; items?: unknown[] },
  ): MerchantInventoryAdjustmentDispute[] {
    const source = (Array.isArray(res)
      ? res
      : ((res['disputes'] ?? res['data'] ?? res['items'] ?? []) as unknown[])) as Record<
      string,
      unknown
    >[];
    return source.map((raw) => this.mapInventoryAdjustmentDispute(raw));
  }

  private mapDashboardSummary(raw: unknown): MerchantDashboardSummary {
    const data = (raw ?? {}) as Record<string, unknown>;
    const sales = (data['sales'] ?? {}) as Record<string, unknown>;
    const trend = (sales['trend'] ?? {}) as Record<string, unknown>;
    const orders = (data['orders'] ?? {}) as Record<string, unknown>;
    const inventory = (data['inventory'] ?? {}) as Record<string, unknown>;
    const earnings = (data['earnings'] ?? {}) as Record<string, unknown>;
    const allocations = (data['allocations'] ?? {}) as Record<string, unknown>;
    const rawActivity = (data['recentActivity'] ?? data['recent_activity'] ?? []) as unknown[];

    const trendPoints = ((trend['points'] ?? []) as unknown[]).map((point) => {
      const p = (point ?? {}) as Record<string, unknown>;
      return {
        date: String(p['date'] ?? ''),
        amount: Number(p['amount'] ?? 0),
      };
    });

    const monthlyOverview = ((sales['monthlyOverview'] ?? sales['monthly_overview'] ?? []) as unknown[]).map(
      (month) => {
        const m = (month ?? {}) as Record<string, unknown>;
        return {
          month: String(m['month'] ?? ''),
          label: String(m['label'] ?? ''),
          amount: Number(m['amount'] ?? 0),
        };
      },
    );

    const byTypeRaw = (earnings['byType'] ?? earnings['by_type'] ?? {}) as Record<string, unknown>;
    const byType: MerchantEarningsByType = {
      personalProduct: Number(byTypeRaw['personalProduct'] ?? byTypeRaw['personal_product'] ?? 0),
      directReferralProduct: Number(
        byTypeRaw['directReferralProduct'] ?? byTypeRaw['direct_referral_product'] ?? 0,
      ),
      communityProduct: Number(byTypeRaw['communityProduct'] ?? byTypeRaw['community_product'] ?? 0),
      deliveryBonus: Number(byTypeRaw['deliveryBonus'] ?? byTypeRaw['delivery_bonus'] ?? 0),
    };

    return {
      currency: String(data['currency'] ?? 'NGN'),
      sales: {
        totalSales: Number(sales['totalSales'] ?? sales['total_sales'] ?? 0),
        salesChangePct: this.mapNullableNumber(sales['salesChangePct'] ?? sales['sales_change_pct']),
        trend: {
          period: String(trend['period'] ?? '7d'),
          points: trendPoints,
          changePctVsPreviousPeriod: this.mapNullableNumber(
            trend['changePctVsPreviousPeriod'] ?? trend['change_pct_vs_previous_period'],
          ),
        },
        monthlyOverview,
      },
      orders: {
        pendingFulfillments: Number(
          orders['pendingFulfillments'] ?? orders['pending_fulfillments'] ?? 0,
        ),
        pendingByStatus: (orders['pendingByStatus'] ?? orders['pending_by_status']) as
          | Record<string, number>
          | undefined,
      },
      inventory: {
        totalProducts: Number(inventory['totalProducts'] ?? inventory['total_products'] ?? 0),
        totalStockQuantity:
          (inventory['totalStockQuantity'] ?? inventory['total_stock_quantity']) != null
            ? Number(inventory['totalStockQuantity'] ?? inventory['total_stock_quantity'])
            : undefined,
        lowStockCount: Number(inventory['lowStockCount'] ?? inventory['low_stock_count'] ?? 0),
        outOfStockCount: Number(inventory['outOfStockCount'] ?? inventory['out_of_stock_count'] ?? 0),
        lowOrOutCount: Number(inventory['lowOrOutCount'] ?? inventory['low_or_out_count'] ?? 0),
        byCategory: this.mapDashboardInventoryCategories(inventory),
      },
      earnings: {
        totalEarnings: Number(earnings['totalEarnings'] ?? earnings['total_earnings'] ?? 0),
        availableEarnings: Number(earnings['availableEarnings'] ?? earnings['available_earnings'] ?? 0),
        pendingEarnings: Number(earnings['pendingEarnings'] ?? earnings['pending_earnings'] ?? 0),
        byType,
      },
      allocations: {
        actionableCount: Number(allocations['actionableCount'] ?? allocations['actionable_count'] ?? 0),
      },
      recentActivity: rawActivity
        .map((item) => this.mapDashboardActivity(item))
        .filter((item): item is MerchantDashboardRecentActivity => item != null),
    };
  }

  private mapDashboardInventoryCategories(
    inventory: Record<string, unknown>,
  ): MerchantDashboardInventoryCategory[] | undefined {
    const rawCategories = (inventory['byCategory'] ?? inventory['by_category'] ?? []) as unknown[];
    if (!Array.isArray(rawCategories) || rawCategories.length === 0) {
      return undefined;
    }

    return rawCategories.map((item) => {
      const category = (item ?? {}) as Record<string, unknown>;
      return {
        categoryId: String(category['categoryId'] ?? category['category_id'] ?? ''),
        categoryName: String(category['categoryName'] ?? category['category_name'] ?? 'Uncategorized'),
        productCount: Number(category['productCount'] ?? category['product_count'] ?? 0),
        totalStockQuantity: Number(
          category['totalStockQuantity'] ?? category['total_stock_quantity'] ?? 0,
        ),
      };
    });
  }

  private mapDashboardActivity(raw: unknown): MerchantDashboardRecentActivity | null {
    const data = (raw ?? {}) as Record<string, unknown>;
    const id = String(data['id'] ?? '');
    if (!id) return null;

    const type = String(data['type'] ?? 'ORDER_RECEIVED') as MerchantDashboardActivityType;
    const amountRaw = data['amount'];

    return {
      id,
      type,
      title: String(data['title'] ?? ''),
      description: String(data['description'] ?? ''),
      amount: amountRaw == null ? null : Number(amountRaw),
      currency: (data['currency'] ?? null) as string | null,
      occurredAt: String(data['occurredAt'] ?? data['occurred_at'] ?? ''),
      metadata: (data['metadata'] ?? undefined) as Record<string, unknown> | undefined,
    };
  }

  private mapNullableNumber(value: unknown): number | null {
    if (value == null || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  private mapInventoryAdjustmentDispute(
    raw: Record<string, unknown>,
  ): MerchantInventoryAdjustmentDispute {
    const authorizedQuantity = Number(
      raw['authorizedQuantity'] ?? raw['authorized_quantity'] ?? 0,
    );
    const requestedQuantity = Number(
      raw['requestedQuantity'] ?? raw['requested_quantity'] ?? 0,
    );
    const adjustmentTypeRaw = String(
      raw['adjustmentType'] ?? raw['adjustment_type'] ?? '',
    ).toUpperCase();
    const adjustmentType: InventoryAdjustmentType =
      adjustmentTypeRaw === 'DECREASE'
        ? 'DECREASE'
        : MerchantService.resolveAdjustmentType(authorizedQuantity, requestedQuantity);

    return {
      id: String(raw['id'] ?? ''),
      productId: String(raw['productId'] ?? raw['product_id'] ?? ''),
      productName: String(raw['productName'] ?? raw['product_name'] ?? '—'),
      productSku: String(raw['productSku'] ?? raw['product_sku'] ?? '') || undefined,
      authorizedQuantity,
      requestedQuantity,
      adjustmentType,
      reason: String(raw['reason'] ?? ''),
      status: String(raw['status'] ?? 'OPEN') as InventoryAdjustmentDisputeStatus,
      adminNotes: (raw['adminNotes'] ?? raw['admin_notes'] ?? null) as string | null,
      createdAt: (raw['createdAt'] ?? raw['created_at']) as string | undefined,
      resolvedAt: (raw['resolvedAt'] ?? raw['resolved_at'] ?? null) as string | null,
    };
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
      PICKED_UP: 'Picked Up',
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
