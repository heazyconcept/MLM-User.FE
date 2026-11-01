import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import {
  CaucusMe,
  CaucusMembershipStatus,
  CaucusMonthRow,
  CaucusPvAward,
  CaucusReferralsResponse,
  CaucusTeamMember,
  CaucusWalletHistoryResponse,
} from '../core/models/caucus.models';
import { caucusErrorMessage } from '../core/utils/caucus-error.util';
import { ApiService } from './api.service';
import { UserService } from './user.service';

function unwrapData<T>(raw: unknown): T {
  if (raw && typeof raw === 'object' && 'data' in (raw as object)) {
    return (raw as { data: T }).data;
  }
  return raw as T;
}

@Injectable({ providedIn: 'root' })
export class CaucusService {
  private readonly api = inject(ApiService);
  private readonly userService = inject(UserService);

  private meState = signal<CaucusMe | null>(null);
  private loadingState = signal(false);
  private featureAvailableState = signal(false);
  private probed = false;

  readonly me = this.meState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly featureAvailable = this.featureAvailableState.asReadonly();

  readonly menuVisible = computed(() => {
    if (!this.userService.isPaid()) {
      return false;
    }
    const status = this.meState()?.status;
    if (status === 'NONE' || status == null) {
      return false;
    }
    return this.featureAvailableState();
  });

  readonly membershipStatus = computed(
    () => (this.meState()?.status ?? 'NONE') as CaucusMembershipStatus,
  );

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
        this.featureAvailableState.set(false);
      }
    });
  }

  loadMe(): Observable<CaucusMe | null> {
    this.loadingState.set(true);
    if (!this.userService.isPaid()) {
      this.meState.set(null);
      this.featureAvailableState.set(false);
      this.loadingState.set(false);
      return of(null);
    }

    return this.api.get<unknown>('caucus/me').pipe(
      map((raw) => unwrapData<CaucusMe>(raw)),
      tap((me) => {
        this.meState.set(me);
        const onTeam = me.status === 'ACTIVE' || me.status === 'DEACTIVATED';
        this.featureAvailableState.set(onTeam);
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
        return throwError(() => err);
      }),
    );
  }

  referrals(month: string, page = 1, limit = 20): Observable<CaucusReferralsResponse> {
    return this.api.get<unknown>('caucus/referrals', { month, page, limit }).pipe(
      map((raw) => unwrapData<CaucusReferralsResponse>(raw)),
    );
  }

  months(): Observable<CaucusMonthRow[]> {
    return this.api.get<unknown>('caucus/months').pipe(
      map((raw) => {
        const data = unwrapData<{ months: CaucusMonthRow[] } | CaucusMonthRow[]>(raw);
        return Array.isArray(data) ? data : (data.months ?? []);
      }),
    );
  }

  team(page = 1, limit = 20, search?: string): Observable<{ members: CaucusTeamMember[] }> {
    const params: Record<string, string | number> = { page, limit };
    const q = search?.trim();
    if (q) {
      params['search'] = q;
    }
    return this.api
      .get<unknown>('caucus/team', params)
      .pipe(map((raw) => unwrapData<{ members: CaucusTeamMember[] }>(raw)));
  }

  wallet(limit = 20, cursor?: string): Observable<CaucusWalletHistoryResponse> {
    const params: Record<string, string | number> = { limit };
    if (cursor) {
      params['cursor'] = cursor;
    }
    return this.api
      .get<unknown>('caucus/wallet', params)
      .pipe(map((raw) => unwrapData<CaucusWalletHistoryResponse>(raw)));
  }

  pv(): Observable<CaucusPvAward[]> {
    return this.api.get<unknown>('caucus/pv').pipe(
      map((raw) => {
        const data = unwrapData<{ awards?: CaucusPvAward[]; items?: CaucusPvAward[] } | CaucusPvAward[]>(
          raw,
        );
        if (Array.isArray(data)) {
          return data;
        }
        return data.awards ?? data.items ?? [];
      }),
    );
  }

  submitAppeal(message: string): Observable<CaucusMe> {
    return this.api.post<unknown>('caucus/appeal', { message: message.trim() }).pipe(
      map((raw) => unwrapData<CaucusMe>(raw)),
      tap((me) => this.meState.set(me)),
      catchError((err) => throwError(() => new Error(caucusErrorMessage(err)))),
    );
  }

  withdraw(amount: number, pin: string): Observable<CaucusCashoutWithdrawResult> {
    return this.api.post<unknown>('caucus/cashout/withdraw', { amount, pin }).pipe(
      map((raw) => this.mapCaucusWithdrawResult(raw, amount)),
      tap(() => {
        this.loadMe().subscribe({ error: () => undefined });
      }),
      catchError((err) => throwError(() => new Error(caucusErrorMessage(err)))),
    );
  }

  private mapCaucusWithdrawResult(raw: unknown, requestedAmount: number): CaucusCashoutWithdrawResult {
    const root = (raw as Record<string, unknown>) ?? {};
    const data = (root['data'] as Record<string, unknown> | undefined) ?? root;
    const feeRaw = data['feeAmount'] ?? data['fee_amount'];
    const netRaw = data['netAmount'] ?? data['net_amount'];
    const amountNgn = Number(data['amountNgn'] ?? data['amount_ngn'] ?? data['amount'] ?? requestedAmount);
    return {
      id: String(data['id'] ?? ''),
      amountNgn,
      feeAmount: feeRaw == null ? null : Number(feeRaw),
      netAmount: netRaw == null ? null : Number(netRaw),
      currency: String(data['currency'] ?? 'NGN'),
      status: String(data['status'] ?? 'PENDING'),
    };
  }
}

export interface CaucusCashoutWithdrawResult {
  id: string;
  amountNgn: number;
  feeAmount: number | null;
  netAmount: number | null;
  currency: string;
  status: string;
}
