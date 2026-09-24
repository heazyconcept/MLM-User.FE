import { Injectable, computed, inject, signal, effect } from '@angular/core';
import { Observable, from, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { mapLegacyHistoryResponse } from '../core/utils/legacy-history.util';
import { normalizeLegacyMemberLookup } from '../core/utils/legacy-member-lookup.util';
import { environment } from '../../environments/environment';
import {
  LegacyCashoutResponse,
  LegacyCashoutTransferRequest,
  LegacyCashoutTransferResponse,
  LegacyCashoutWithdrawRequest,
  LegacyCompanyBankAccount,
  LegacyCurrency,
  LegacyHistoryResponse,
  LegacyJoinPreview,
  LegacyJoinStartRequest,
  LegacyLifecycle,
  LegacyMe,
  LegacyMemberLookup,
  LegacyMonthRow,
  LegacyMonthsResponse,
  LegacyPackageCode,
  LegacyPackagesResponse,
  LegacyPaymentRecord,
  LegacyPaymentWalletRequest,
  LegacyPriorPendingMonth,
  LegacyRegisterSuccesslineRequest,
  LegacyRegisterSuccesslineResponse,
  LegacyPvHistoryItem,
  LegacyPvHistoryResponse,
  LegacyPvSummary,
  LegacySponsorValidateResponse,
  LegacySuccesslinesResponse,
  LegacyUpgradeQuote,
  LegacyVoucherResponse,
  LEGACY_ERROR_CODES,
  canAccessLegacyMarketplace,
  canAccessLegacyVoucher,
  isLegacyMember,
  paymentAmountFromMe,
  resolveLegacyCashoutTransferTarget,
  resolveLegacyShopMode,
} from '../core/models/legacy-club.models';
import {
  legacyHomeScreenPath,
  paymentPurposeFromMe,
  resolveLegacyHomeScreen,
} from '../core/utils/legacy-routing.util';
import {
  LegacyClubHttpError,
  legacyClubMockStore,
} from '../core/mocks/legacy-club.mock';
import { LEGACY_CLUB_USE_MOCKS } from '../core/tokens/legacy-club.tokens';
import { cyclePeriodCount, isWeeklyCycle } from '../core/utils/legacy-cycle.util';
import { ApiService } from './api.service';
import { LegacyQualifyCelebrationService } from './legacy-qualify-celebration.service';
import { UserService } from './user.service';

function unwrapData<T>(raw: unknown): T {
  if (raw && typeof raw === 'object' && 'data' in (raw as object)) {
    return (raw as { data: T }).data;
  }
  return raw as T;
}

function mapHttpErrorCatch(err: unknown): LegacyClubHttpError {
  if (err instanceof LegacyClubHttpError) return err;
  const http = err as {
    status?: number;
    error?: { code?: string; error?: string; message?: string | string[] };
    message?: string;
  };
  const code =
    http?.error?.code ??
    http?.error?.error ??
    LEGACY_ERROR_CODES.SPONSOR_NOT_FOUND;
  const message =
    (typeof http?.error?.message === 'string'
      ? http.error.message
      : Array.isArray(http?.error?.message)
        ? http.error.message[0]
        : undefined) ??
    http?.message ??
    'Something went wrong.';
  return new LegacyClubHttpError(http?.status ?? 500, String(code), message);
}

@Injectable({ providedIn: 'root' })
export class LegacyClubService {
  private api = inject(ApiService);
  private userService = inject(UserService);
  private qualifyCelebration = inject(LegacyQualifyCelebrationService);

  private readonly useMocks =
    inject(LEGACY_CLUB_USE_MOCKS, { optional: true }) ?? environment.useLegacyClubMocks === true;

  private meState = signal<LegacyMe | null>(null);
  private loadingState = signal(false);
  private errorState = signal<string | null>(null);
  private featureAvailableState = signal(this.useMocks);
  private probed = false;

  readonly me = this.meState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly featureAvailable = this.featureAvailableState.asReadonly();

  readonly menuVisible = computed(() => {
    if (!this.userService.isPaid()) return false;
    if (this.useMocks) return true;
    return this.featureAvailableState();
  });

  readonly status = computed(() => this.meState()?.status ?? null);
  readonly shopMode = computed(() => resolveLegacyShopMode(this.meState()));
  /** Weeks (or months) issued so far — for side-menu progress badge. */
  readonly cycleIssuedCount = computed(() => this.meState()?.cycle?.issuedCount ?? 0);
  readonly cyclePeriodTotal = computed(() => cyclePeriodCount(this.meState()?.cycle));
  readonly hasActiveCycle = computed(() => {
    const cycle = this.meState()?.cycle;
    return !!cycle && !cycle.isCycleComplete;
  });
  readonly isWeeklyCycle = computed(() => isWeeklyCycle(this.meState()?.cycle));
  readonly legacyHomeScreen = computed(() => {
    const me = this.meState();
    if (!me) return null;
    return resolveLegacyHomeScreen(me);
  });
  readonly legacyHomePath = computed(() => {
    const screen = this.legacyHomeScreen();
    return screen ? legacyHomeScreenPath(screen) : '/legacy/join';
  });
  readonly paymentPurpose = computed(() => {
    const me = this.meState();
    if (!me) return null;
    return paymentPurposeFromMe(me);
  });
  readonly paymentRequired = computed(() => paymentAmountFromMe(this.meState()));
  readonly canShopProducts = computed(() => canAccessLegacyMarketplace(this.meState()));
  readonly canAccessVoucher = computed(() => canAccessLegacyVoucher(this.meState()));
  readonly isGracePeriod = computed(() => this.meState()?.status === 'REACTIVATION_DUE');
  readonly isSuspended = computed(() => this.meState()?.status === 'SUSPENDED');
  readonly isMember = computed(() => isLegacyMember(this.meState()));

  constructor() {
    effect(() => {
      const paid = this.userService.isPaid();
      if (paid && !this.probed) {
        this.probed = true;
        this.loadMe().subscribe({ error: () => undefined });
      }
      if (!paid) {
        this.probed = false;
        this.meState.set(null);
        if (!this.useMocks) this.featureAvailableState.set(false);
      }
    });
  }

  loadMe(): Observable<LegacyMe | null> {
    this.loadingState.set(true);
    this.errorState.set(null);

    if (!this.userService.isPaid()) {
      this.meState.set(null);
      this.featureAvailableState.set(false);
      this.loadingState.set(false);
      return of(null);
    }

    if (this.useMocks) {
      return from(legacyClubMockStore.getMe()).pipe(
        tap((me) => {
          const normalized = this.normalizeLegacyMe(me);
          this.meState.set(normalized);
          this.featureAvailableState.set(true);
          this.loadingState.set(false);
          this.afterMeLoaded(normalized);
        }),
        catchError((err) => {
          this.loadingState.set(false);
          this.errorState.set(err?.message ?? 'Failed to load Legacy Club');
          return throwError(() => err);
        }),
      );
    }

    return this.api.get<unknown>('legacy/me').pipe(
      map((raw) => this.normalizeLegacyMe(unwrapData<LegacyMe>(raw))),
      tap((me) => {
        this.meState.set(me);
        this.featureAvailableState.set(true);
        this.loadingState.set(false);
        this.afterMeLoaded(me);
      }),
      catchError((err) => {
        this.loadingState.set(false);
        const status = (err as { status?: number })?.status;
        if (status === 404 || status === 501 || status === 403) {
          this.featureAvailableState.set(false);
          this.meState.set(null);
          return of(null);
        }
        this.errorState.set('Failed to load Legacy Club');
        return throwError(() => err);
      }),
    );
  }

  getJoinPreview(): Observable<LegacyJoinPreview> {
    if (this.useMocks) {
      return from(legacyClubMockStore.getJoinPreview());
    }
    return this.api.get<unknown>('legacy/join-preview').pipe(
      map((raw) => unwrapData<LegacyJoinPreview>(raw)),
      catchError((err) => throwError(() => mapHttpErrorCatch(err))),
    );
  }

  getLifecycle(): Observable<LegacyLifecycle> {
    if (this.useMocks) {
      return from(legacyClubMockStore.getLifecycle());
    }
    return this.api.get<unknown>('legacy/lifecycle').pipe(
      map((raw) => unwrapData<LegacyLifecycle>(raw)),
      catchError((err) => throwError(() => mapHttpErrorCatch(err))),
    );
  }

  payWithWallet(body: LegacyPaymentWalletRequest): Observable<void> {
    if (this.useMocks) {
      return from(legacyClubMockStore.payWithWallet(body)).pipe(
        tap(() => void this.loadMe().subscribe()),
        catchError((err) =>
          throwError(() => (err instanceof LegacyClubHttpError ? err : mapHttpErrorCatch(err))),
        ),
      );
    }
    return this.api.post<unknown>('legacy/payments/wallet', body).pipe(
      map(() => undefined),
      tap(() => void this.loadMe().subscribe()),
      catchError((err) => throwError(() => mapHttpErrorCatch(err))),
    );
  }

  payManual(formData: FormData): Observable<LegacyPaymentRecord> {
    if (this.useMocks) {
      return from(legacyClubMockStore.payManual(formData)).pipe(
        tap(() => void this.loadMe().subscribe()),
        catchError((err) =>
          throwError(() => (err instanceof LegacyClubHttpError ? err : mapHttpErrorCatch(err))),
        ),
      );
    }
    return this.api.post<unknown>('legacy/payments/manual', formData).pipe(
      map((raw) => unwrapData<LegacyPaymentRecord>(raw)),
      tap(() => void this.loadMe().subscribe()),
      catchError((err) => throwError(() => mapHttpErrorCatch(err))),
    );
  }

  getCompanyBankAccount(): Observable<LegacyCompanyBankAccount | null> {
    if (this.useMocks) {
      return from(legacyClubMockStore.getCompanyBankAccount());
    }
    return this.api.get<unknown>('legacy/payments/company-bank-account').pipe(
      map((raw) => {
        const data = unwrapData<Record<string, unknown>>(raw);
        if (!data) return null;
        return {
          bankName: String(data['bankName'] ?? data['bank_name'] ?? ''),
          accountNumber: String(data['accountNumber'] ?? data['account_number'] ?? ''),
          accountName: String(data['accountName'] ?? data['account_name'] ?? ''),
        };
      }),
      catchError(() => of(null)),
    );
  }

  getPendingPayments(): Observable<LegacyPaymentRecord[]> {
    if (this.useMocks) {
      return from(legacyClubMockStore.getPendingPayments());
    }
    return this.api.get<unknown>('legacy/payments', { status: 'PENDING' }).pipe(
      map((raw) => {
        const data = unwrapData<LegacyPaymentRecord[] | { items?: LegacyPaymentRecord[] }>(raw);
        if (Array.isArray(data)) return data;
        return data?.items ?? [];
      }),
      catchError((err) => throwError(() => mapHttpErrorCatch(err))),
    );
  }

  getPackages(): Observable<LegacyPackagesResponse> {
    if (this.useMocks) {
      return from(legacyClubMockStore.getPackages());
    }
    return this.api.get<unknown>('legacy/packages').pipe(
      map((raw) => unwrapData<LegacyPackagesResponse>(raw)),
      catchError((err) => throwError(() => mapHttpErrorCatch(err))),
    );
  }

  validateSponsor(username: string): Observable<LegacySponsorValidateResponse> {
    if (this.useMocks) {
      return from(legacyClubMockStore.validateSponsor(username)).pipe(
        catchError((err) => throwError(() => (err instanceof LegacyClubHttpError ? err : mapHttpErrorCatch(err)))),
      );
    }
    return this.api.post<unknown>('legacy/sponsors/validate', { username }).pipe(
      map((raw) => unwrapData<LegacySponsorValidateResponse>(raw)),
      catchError((err) => throwError(() => mapHttpErrorCatch(err))),
    );
  }

  startJoin(packageCode: LegacyPackageCode, sponsorUsername?: string): Observable<void> {
    const body: LegacyJoinStartRequest = { package: packageCode };
    if (sponsorUsername) body.sponsorUsername = sponsorUsername;

    if (this.useMocks) {
      return from(legacyClubMockStore.startJoin(body)).pipe(
        tap(() => {
          void this.loadMe().subscribe();
        }),
        catchError((err) => throwError(() => (err instanceof LegacyClubHttpError ? err : mapHttpErrorCatch(err)))),
      );
    }

    return this.api.post<unknown>('legacy/join/start', body).pipe(
      map(() => undefined),
      tap(() => {
        void this.loadMe().subscribe();
      }),
      catchError((err) => throwError(() => mapHttpErrorCatch(err))),
    );
  }

  lookupMember(username: string): Observable<LegacyMemberLookup> {
    if (this.useMocks) {
      return from(legacyClubMockStore.lookupMember(username));
    }
    return this.api
      .get<unknown>('legacy/members/lookup', { username })
      .pipe(map((raw) => normalizeLegacyMemberLookup(raw)));
  }

  registerSuccessline(
    body: LegacyRegisterSuccesslineRequest,
  ): Observable<LegacyRegisterSuccesslineResponse> {
    if (this.useMocks) {
      return from(legacyClubMockStore.registerSuccessline(body)).pipe(
        tap(() => void this.loadMe().subscribe()),
        catchError((err) =>
          throwError(() => (err instanceof LegacyClubHttpError ? err : mapHttpErrorCatch(err))),
        ),
      );
    }
    return this.api.post<unknown>('legacy/successlines/register', body).pipe(
      map((raw) => unwrapData<LegacyRegisterSuccesslineResponse>(raw)),
      tap(() => void this.loadMe().subscribe()),
      catchError((err) => throwError(() => mapHttpErrorCatch(err))),
    );
  }

  getSuccesslines(page = 1, limit = 20, search = ''): Observable<LegacySuccesslinesResponse> {
    if (this.useMocks) {
      return from(legacyClubMockStore.getSuccesslines(page, limit, search));
    }
    return this.api
      .get<unknown>('legacy/successlines', { page, limit, search })
      .pipe(map((raw) => unwrapData<LegacySuccesslinesResponse>(raw)));
  }

  getCashout(options?: { limit?: number; cursor?: string }): Observable<LegacyCashoutResponse> {
    if (this.useMocks) {
      return from(legacyClubMockStore.getCashout(options)).pipe(
        catchError((err) => throwError(() => (err instanceof LegacyClubHttpError ? err : mapHttpErrorCatch(err)))),
      );
    }
    const params: Record<string, string | number> = {};
    if (options?.limit != null) {
      params['limit'] = options.limit;
    }
    if (options?.cursor) {
      params['cursor'] = options.cursor;
    }
    return this.api.get<unknown>('legacy/cashout', params).pipe(
      map((raw) => unwrapData<LegacyCashoutResponse>(raw)),
      catchError((err) => throwError(() => mapHttpErrorCatch(err))),
    );
  }

  withdrawCashout(body: LegacyCashoutWithdrawRequest): Observable<{ withdrawalId: string }> {
    if (this.useMocks) {
      return from(legacyClubMockStore.withdrawCashout(body)).pipe(
        tap(() => void this.loadMe().subscribe()),
        catchError((err) => throwError(() => (err instanceof LegacyClubHttpError ? err : mapHttpErrorCatch(err)))),
      );
    }
    return this.api.post<{ withdrawalId: string }>('legacy/cashout/withdraw', body).pipe(
      tap(() => void this.loadMe().subscribe()),
      catchError((err) => throwError(() => mapHttpErrorCatch(err))),
    );
  }

  transferCashout(body: LegacyCashoutTransferRequest): Observable<LegacyCashoutTransferResponse> {
    const payload: LegacyCashoutTransferRequest = {
      ...body,
      toWalletType: resolveLegacyCashoutTransferTarget(body.toWalletType),
    };
    if (this.useMocks) {
      return from(legacyClubMockStore.transferCashout(payload)).pipe(
        tap(() => void this.loadMe().subscribe()),
        catchError((err) => throwError(() => (err instanceof LegacyClubHttpError ? err : mapHttpErrorCatch(err)))),
      );
    }
    return this.api.post<LegacyCashoutTransferResponse>('legacy/cashout/transfer', payload).pipe(
      tap(() => void this.loadMe().subscribe()),
      catchError((err) => throwError(() => mapHttpErrorCatch(err))),
    );
  }

  getVoucher(): Observable<LegacyVoucherResponse> {
    if (this.useMocks) {
      return from(legacyClubMockStore.getVoucher());
    }
    return this.api.get<unknown>('legacy/voucher').pipe(
      map((raw) => unwrapData<LegacyVoucherResponse>(raw)),
    );
  }

  fundVoucherFromCash(amount: number, currency: LegacyCurrency): Observable<{ transferId: string }> {
    if (this.useMocks) {
      return from(legacyClubMockStore.fundVoucherFromCash(amount, currency)).pipe(
        tap(() => void this.loadMe().subscribe()),
        catchError((err) => throwError(() => (err instanceof LegacyClubHttpError ? err : mapHttpErrorCatch(err)))),
      );
    }
    return this.api
      .post<{ transferId: string }>('wallets/transfer', {
        fromWalletType: 'CASH',
        toWalletType: 'LEGACY_VOUCHER',
        amount,
        currency,
      })
      .pipe(
        tap(() => void this.loadMe().subscribe()),
        catchError((err) => throwError(() => mapHttpErrorCatch(err))),
      );
  }

  getMockCashBalance(): number {
    return this.useMocks ? legacyClubMockStore.getCashBalance() : 0;
  }

  getMonths(): Observable<LegacyMonthsResponse> {
    if (this.useMocks) {
      return of(this.buildMockMonthsResponse());
    }
    return this.api.get<unknown>('legacy/months').pipe(
      map((raw) => this.mapMonthsResponse(unwrapData<Record<string, unknown>>(raw))),
      catchError((err) => throwError(() => mapHttpErrorCatch(err))),
    );
  }

  getUpgradeQuote(packageCode: LegacyPackageCode): Observable<LegacyUpgradeQuote> {
    return this.api
      .get<unknown>('legacy/upgrade/quote', { package: packageCode })
      .pipe(
        map((raw) => unwrapData<LegacyUpgradeQuote>(raw)),
        catchError((err) => throwError(() => mapHttpErrorCatch(err))),
      );
  }

  startUpgrade(packageCode: LegacyPackageCode): Observable<void> {
    return this.api.post<unknown>('legacy/upgrade/start', { package: packageCode }).pipe(
      map(() => undefined),
      tap(() => void this.loadMe().subscribe()),
      catchError((err) => throwError(() => mapHttpErrorCatch(err))),
    );
  }

  cancelUpgrade(): Observable<void> {
    return this.api.post<unknown>('legacy/upgrade/cancel', {}).pipe(
      map(() => undefined),
      tap(() => void this.loadMe().subscribe()),
      catchError((err) => throwError(() => mapHttpErrorCatch(err))),
    );
  }

  startReactivate(): Observable<void> {
    return this.api.post<unknown>('legacy/reactivate/start', {}).pipe(
      map(() => undefined),
      tap(() => void this.loadMe().subscribe()),
      catchError((err) => throwError(() => mapHttpErrorCatch(err))),
    );
  }

  cancelReactivate(): Observable<void> {
    return this.api.post<unknown>('legacy/reactivate/cancel', {}).pipe(
      map(() => undefined),
      tap(() => void this.loadMe().subscribe()),
      catchError((err) => throwError(() => mapHttpErrorCatch(err))),
    );
  }

  getHistory(): Observable<LegacyHistoryResponse> {
    const currency = this.meState()?.currency ?? 'NGN';
    if (this.useMocks) {
      return from(legacyClubMockStore.getHistory()).pipe(
        map((raw) => mapLegacyHistoryResponse(raw, currency)),
        catchError((err) => throwError(() => (err instanceof LegacyClubHttpError ? err : mapHttpErrorCatch(err)))),
      );
    }
    return this.api.get<unknown>('legacy/history').pipe(
      map((raw) => mapLegacyHistoryResponse(unwrapData(raw), currency)),
      catchError((err) => throwError(() => mapHttpErrorCatch(err))),
    );
  }

  getPvHistory(options?: { limit?: number; cursor?: string }): Observable<LegacyPvHistoryResponse> {
    if (this.useMocks) {
      return from(legacyClubMockStore.getPvHistory(options));
    }
    const params: Record<string, string | number> = {
      limit: options?.limit ?? 20,
    };
    if (options?.cursor) {
      params['cursor'] = options.cursor;
    }
    return this.api.get<unknown>('legacy/pv/history', params).pipe(
      map((raw) => this.mapPvHistoryResponse(unwrapData<Record<string, unknown>>(raw))),
      catchError((err) => throwError(() => mapHttpErrorCatch(err))),
    );
  }

  /** Reset mock store (tests / demo). No-op in live mode. */
  resetMocks(options?: { sponsorResolution?: 'AUTO' | 'MANUAL' }): void {
    if (!this.useMocks) return;
    legacyClubMockStore.reset(options);
    this.meState.set(null);
  }

  private normalizeLegacyMe(me: LegacyMe): LegacyMe {
    const record = me as LegacyMe & { legacy_pv?: Record<string, unknown> };
    const legacyPvRaw = me.legacyPv ?? record.legacy_pv;
    if (!legacyPvRaw || typeof legacyPvRaw !== 'object') {
      return {
        ...me,
        legacyPv: me.legacyPv ?? {
          totalPv: 0,
          personalProductPv: 0,
          directReferralProductPv: 0,
        },
      };
    }
    const raw = legacyPvRaw as Record<string, unknown>;
    const legacyPv: LegacyPvSummary = {
      totalPv: Number(raw['totalPv'] ?? raw['total_pv'] ?? 0),
      personalProductPv: Number(raw['personalProductPv'] ?? raw['personal_product_pv'] ?? 0),
      directReferralProductPv: Number(
        raw['directReferralProductPv'] ?? raw['direct_referral_product_pv'] ?? 0,
      ),
    };
    return { ...me, legacyPv };
  }

  private mapPvHistoryResponse(raw: Record<string, unknown>): LegacyPvHistoryResponse {
    const itemsRaw = Array.isArray(raw['items']) ? (raw['items'] as Record<string, unknown>[]) : [];
    const items: LegacyPvHistoryItem[] = itemsRaw.map((row) => ({
      id: String(row['id'] ?? ''),
      kind: (row['kind'] as LegacyPvHistoryItem['kind']) ?? 'OWN_PURCHASE',
      pvAmount: Number(row['pvAmount'] ?? row['pv_amount'] ?? 0),
      at: String(row['at'] ?? row['createdAt'] ?? ''),
      orderId: String(row['orderId'] ?? row['order_id'] ?? ''),
      orderReference:
        (row['orderReference'] as string | null | undefined) ??
        (row['order_reference'] as string | null | undefined) ??
        null,
      orderTotal:
        row['orderTotal'] != null
          ? Number(row['orderTotal'])
          : row['order_total'] != null
            ? Number(row['order_total'])
            : null,
      currency:
        (row['currency'] as LegacyPvHistoryItem['currency']) ??
        (row['currency_code'] as LegacyPvHistoryItem['currency']) ??
        null,
      productSummary: String(row['productSummary'] ?? row['product_summary'] ?? ''),
      buyerUsername:
        (row['buyerUsername'] as string | null | undefined) ??
        (row['buyer_username'] as string | null | undefined) ??
        null,
      downlineUsername:
        (row['downlineUsername'] as string | null | undefined) ??
        (row['downline_username'] as string | null | undefined) ??
        null,
    }));
    const nextCursor =
      (raw['nextCursor'] as string | null | undefined) ??
      (raw['next_cursor'] as string | null | undefined) ??
      null;
    return { items, nextCursor };
  }

  private buildMockMonthsResponse(): LegacyMonthsResponse {
    const me = this.meState();
    const cycle = me?.cycle ?? null;
    const currency = me?.currency ?? 'NGN';
    const cycleMonths = cycle?.cycleMonths ?? 6;
    const cycleWeeks = cycle?.cycleWeeks ?? 24;
    const startedAt = cycle?.startedAt ?? new Date().toISOString();
    const weeks = cycleWeeks;
    const amount = cycle?.nextDueAmount ?? 7500;
    const cashoutAmount = cycle?.nextDueCashoutAmount ?? 5000;
    const voucherNet = cycle?.nextDueVoucherNet ?? 2250;
    const voucherGross = Math.round(voucherNet / 0.9);
    const voucherFee = voucherGross - voucherNet;
    const issued = cycle?.issuedCount ?? 0;
    const months: LegacyMonthRow[] = Array.from({ length: weeks }, (_, i) => {
      const periodIndex = i + 1;
      const dueAt = new Date(
        new Date(startedAt).getTime() + periodIndex * 7 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const dropped = periodIndex <= issued;
      return {
        periodIndex,
        dueAt,
        amount,
        cashoutAmount,
        voucherGross,
        voucherFee,
        voucherNet,
        rateTier: cycle?.nextDueRateTier ?? 'BASE',
        status: dropped ? 'DROPPED' : 'SCHEDULED',
        droppedAt: dropped ? dueAt : null,
        autoshipOrderId: null,
      };
    });
    return {
      currency,
      cycleMonths,
      cycleWeeks,
      cycleStartedAt: startedAt,
      pendingTotal: 0,
      monthlyQualify: me?.monthlyQualify ?? null,
      months,
      priorPending: [],
    };
  }

  private mapMonthsResponse(raw: Record<string, unknown>): LegacyMonthsResponse {
    const monthsRaw = Array.isArray(raw['months']) ? (raw['months'] as Record<string, unknown>[]) : [];
    const priorRaw = Array.isArray(raw['priorPending'])
      ? (raw['priorPending'] as Record<string, unknown>[])
      : [];

    const months: LegacyMonthRow[] = monthsRaw.map((row) => ({
      periodIndex: Number(row['periodIndex'] ?? 0),
      dueAt: String(row['dueAt'] ?? ''),
      amount: Number(row['amount'] ?? 0),
      cashoutAmount:
        row['cashoutAmount'] != null ? Number(row['cashoutAmount']) : undefined,
      voucherGross: row['voucherGross'] != null ? Number(row['voucherGross']) : undefined,
      voucherFee: row['voucherFee'] != null ? Number(row['voucherFee']) : undefined,
      voucherNet: row['voucherNet'] != null ? Number(row['voucherNet']) : undefined,
      rateTier: (row['rateTier'] as LegacyMonthRow['rateTier']) ?? 'BASE',
      status: (row['status'] as LegacyMonthRow['status']) ?? 'SCHEDULED',
      droppedAt: (row['droppedAt'] as string | null) ?? null,
      autoshipOrderId: (row['autoshipOrderId'] as string | null) ?? null,
    }));

    const priorPending: LegacyPriorPendingMonth[] = priorRaw.map((row) => ({
      cyclePackage: row['cyclePackage'] as LegacyPriorPendingMonth['cyclePackage'],
      periodIndex: Number(row['periodIndex'] ?? 0),
      amount: Number(row['amount'] ?? 0),
      rateTier: (row['rateTier'] as LegacyPriorPendingMonth['rateTier']) ?? 'BASE',
      dueAt: String(row['dueAt'] ?? ''),
      status: (row['status'] as LegacyPriorPendingMonth['status']) ?? 'PENDING',
    }));

    return {
      currency: (raw['currency'] as LegacyMonthsResponse['currency']) ?? 'NGN',
      cycleMonths: Number(raw['cycleMonths'] ?? 6),
      cycleWeeks:
        raw['cycleWeeks'] != null ? Number(raw['cycleWeeks']) : undefined,
      cycleStartedAt: raw['cycleStartedAt'] as string | undefined,
      pendingTotal: raw['pendingTotal'] != null ? Number(raw['pendingTotal']) : undefined,
      monthlyQualify: (raw['monthlyQualify'] as LegacyMonthsResponse['monthlyQualify']) ?? null,
      months,
      priorPending,
    };
  }

  private afterMeLoaded(me: LegacyMe | null): void {
    const userId = this.userService.currentUser()?.id ?? '';
    this.qualifyCelebration.maybeCelebrate(me, userId);
  }
}

