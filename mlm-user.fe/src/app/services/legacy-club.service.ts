import { Injectable, computed, inject, signal, effect } from '@angular/core';
import { Observable, from, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  LegacyCashoutResponse,
  LegacyCashoutTransferRequest,
  LegacyCashoutTransferResponse,
  LegacyCashoutWithdrawRequest,
  LegacyCurrency,
  LegacyHistoryResponse,
  LegacyJoinStartRequest,
  LegacyMe,
  LegacyMemberLookup,
  LegacyMonthRow,
  LegacyMonthsResponse,
  LegacyPackageCode,
  LegacyPackagesResponse,
  LegacyPriorPendingMonth,
  LegacySponsorValidateResponse,
  LegacySuccesslinesResponse,
  LegacyUpgradeQuote,
  LegacyVoucherResponse,
  LEGACY_ERROR_CODES,
  resolveLegacyShopMode,
} from '../core/models/legacy-club.models';
import {
  LegacyClubHttpError,
  legacyClubMockStore,
} from '../core/mocks/legacy-club.mock';
import { LEGACY_CLUB_USE_MOCKS } from '../core/tokens/legacy-club.tokens';
import { cyclePeriodCount, isWeeklyCycle } from '../core/utils/legacy-cycle.util';
import { ApiService } from './api.service';
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
          this.meState.set(me);
          this.featureAvailableState.set(true);
          this.loadingState.set(false);
        }),
        catchError((err) => {
          this.loadingState.set(false);
          this.errorState.set(err?.message ?? 'Failed to load Legacy Club');
          return throwError(() => err);
        }),
      );
    }

    return this.api.get<unknown>('legacy/me').pipe(
      map((raw) => unwrapData<LegacyMe>(raw)),
      tap((me) => {
        this.meState.set(me);
        this.featureAvailableState.set(true);
        this.loadingState.set(false);
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
      .pipe(map((raw) => unwrapData<LegacyMemberLookup>(raw)));
  }

  getSuccesslines(page = 1, limit = 20, search = ''): Observable<LegacySuccesslinesResponse> {
    if (this.useMocks) {
      return from(legacyClubMockStore.getSuccesslines(page, limit, search));
    }
    return this.api
      .get<unknown>('legacy/successlines', { page, limit, search })
      .pipe(map((raw) => unwrapData<LegacySuccesslinesResponse>(raw)));
  }

  getCashout(): Observable<LegacyCashoutResponse> {
    if (this.useMocks) {
      return from(legacyClubMockStore.getCashout()).pipe(
        catchError((err) => throwError(() => (err instanceof LegacyClubHttpError ? err : mapHttpErrorCatch(err)))),
      );
    }
    return this.api.get<unknown>('legacy/cashout').pipe(
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
    if (this.useMocks) {
      return from(legacyClubMockStore.transferCashout(body)).pipe(
        tap(() => void this.loadMe().subscribe()),
        catchError((err) => throwError(() => (err instanceof LegacyClubHttpError ? err : mapHttpErrorCatch(err)))),
      );
    }
    return this.api.post<LegacyCashoutTransferResponse>('legacy/cashout/transfer', body).pipe(
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
    return this.api.get<unknown>('legacy/history').pipe(
      map((raw) => {
        const data = unwrapData<LegacyHistoryResponse | LegacyHistoryItemLike[]>(raw);
        if (Array.isArray(data)) return { items: data as LegacyHistoryResponse['items'] };
        return data;
      }),
      catchError((err) => throwError(() => mapHttpErrorCatch(err))),
    );
  }

  /** Reset mock store (tests / demo). No-op in live mode. */
  resetMocks(options?: { sponsorResolution?: 'AUTO' | 'MANUAL' }): void {
    if (!this.useMocks) return;
    legacyClubMockStore.reset(options);
    this.meState.set(null);
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
}

type LegacyHistoryItemLike = LegacyHistoryResponse['items'][number];
