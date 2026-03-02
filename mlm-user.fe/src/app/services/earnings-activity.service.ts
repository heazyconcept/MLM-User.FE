import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError, tap, finalize } from 'rxjs/operators';
import { ApiService } from './api.service';

/* ── Item interfaces ─────────────────────────────────────────── */

export interface LedgerActivityItem {
  type: 'ledger';
  id: string;
  createdAt: string;
  walletType: string;          // REGISTRATION | CASH | VOUCHER | AUTOSHIP
  direction: 'CREDIT' | 'DEBIT';
  source: string;
  earningType?: string;
  amount: number;              // base currency (USD)
  displayAmount?: number;      // user display currency (e.g. NGN)
  displayCurrency?: string;    // e.g. NGN
  reference?: string;
  metadata?: Record<string, unknown>;
}

export interface PvActivityItem {
  type: 'pv';
  id: string;
  createdAt: string;
  amount: number;              // CPV points
  source: string;
  sourceId?: string;
  metadata?: Record<string, unknown>;
}

export type ActivityItem = LedgerActivityItem | PvActivityItem;

export interface ActivityQueryParams {
  limit?: number;
  offset?: number;
  from?: string;   // ISO date
  to?: string;     // ISO date
}

/* ── Service ─────────────────────────────────────────────────── */

@Injectable({ providedIn: 'root' })
export class EarningsActivityService {
  private api = inject(ApiService);

  /* ── Raw data from the API ─────────────────────────────────── */
  private allItemsSignal   = signal<ActivityItem[]>([]);
  private loadingSignal    = signal(false);
  private errorSignal      = signal<string | null>(null);

  /* ── Per-tab pagination ────────────────────────────────────── */
  private ledgerPageSignal = signal(1);
  private pvPageSignal     = signal(1);
  readonly pageSize        = 20;

  readonly allItems   = this.allItemsSignal.asReadonly();
  readonly loading    = this.loadingSignal.asReadonly();
  readonly error      = this.errorSignal.asReadonly();

  /** All ledger items from the fetched data (unsliced). */
  private allLedgerItems = computed(() =>
    this.allItemsSignal().filter((i): i is LedgerActivityItem => i.type === 'ledger')
  );

  /** All PV items from the fetched data (unsliced). */
  private allPvItems = computed(() =>
    this.allItemsSignal().filter((i): i is PvActivityItem => i.type === 'pv')
  );

  /**
   * Derive the USD → display-currency exchange rate from the fetched data.
   * Looks for a ledger item with BOTH `amount` and `displayAmount` where the
   * two values differ (e.g. amount=35, displayAmount=35000 → rate=1000).
   * Falls back to 1 if no such item exists (USD user or only PV items).
   */
  private derivedRate = computed(() => {
    const ledgerItems = this.allLedgerItems();
    for (const item of ledgerItems) {
      if (
        item.displayAmount != null &&
        item.amount > 0 &&
        item.displayAmount !== item.amount
      ) {
        return Math.round(item.displayAmount / item.amount);
      }
    }
    return 1;  // fallback: no conversion needed (USD user)
  });

  /* ── Public computed (paginated per tab) ───────────────────── */

  /** Ledger items for the current ledger page. */
  readonly ledgerItems = computed(() => {
    const start = (this.ledgerPageSignal() - 1) * this.pageSize;
    return this.allLedgerItems().slice(start, start + this.pageSize);
  });

  /** PV items for the current PV page. */
  readonly pvItems = computed(() => {
    const start = (this.pvPageSignal() - 1) * this.pageSize;
    return this.allPvItems().slice(start, start + this.pageSize);
  });

  readonly ledgerPage     = this.ledgerPageSignal.asReadonly();
  readonly pvPage         = this.pvPageSignal.asReadonly();
  readonly totalLedger    = computed(() => this.allLedgerItems().length);
  readonly totalPv        = computed(() => this.allPvItems().length);
  readonly ledgerHasMore  = computed(() => this.ledgerPageSignal() * this.pageSize < this.allLedgerItems().length);
  readonly pvHasMore      = computed(() => this.pvPageSignal() * this.pageSize < this.allPvItems().length);
  readonly ledgerTotalPages = computed(() => Math.ceil(this.allLedgerItems().length / this.pageSize) || 1);
  readonly pvTotalPages     = computed(() => Math.ceil(this.allPvItems().length / this.pageSize) || 1);

  /* ── Public API ──────────────────────────────────────────── */

  /** Fetch all activity items (uses limit=100 to get a full picture). */
  fetchActivity(params: ActivityQueryParams = {}): void {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);
    this.ledgerPageSignal.set(1);
    this.pvPageSignal.set(1);

    const qp: Record<string, string | number> = {};
    qp['limit']  = params.limit ?? 100;   // fetch large batch
    qp['offset'] = params.offset ?? 0;
    if (params.from)  qp['from'] = params.from;
    if (params.to)    qp['to']   = params.to;

    this.api.get<{ items: ActivityItem[] }>('earnings/activity', qp).pipe(
      map(res => res.items ?? []),
      tap(items => {
        this.allItemsSignal.set(items);
      }),
      catchError(err => {
        console.error('[EarningsActivityService] fetch failed', err);
        this.errorSignal.set('Failed to load activity data. Please try again.');
        return of([]);
      }),
      finalize(() => this.loadingSignal.set(false))
    ).subscribe();
  }

  /* ── Ledger pagination ────────────────────────────────────── */

  ledgerNextPage(): void {
    if (this.ledgerHasMore()) {
      this.ledgerPageSignal.update(p => p + 1);
    }
  }

  ledgerPrevPage(): void {
    if (this.ledgerPageSignal() > 1) {
      this.ledgerPageSignal.update(p => p - 1);
    }
  }

  ledgerGoToPage(page: number): void {
    if (page >= 1 && page <= this.ledgerTotalPages()) {
      this.ledgerPageSignal.set(page);
    }
  }

  /* ── PV pagination ────────────────────────────────────────── */

  pvNextPage(): void {
    if (this.pvHasMore()) {
      this.pvPageSignal.update(p => p + 1);
    }
  }

  pvPrevPage(): void {
    if (this.pvPageSignal() > 1) {
      this.pvPageSignal.update(p => p - 1);
    }
  }

  pvGoToPage(page: number): void {
    if (page >= 1 && page <= this.pvTotalPages()) {
      this.pvPageSignal.set(page);
    }
  }

  /* ── Display helpers ─────────────────────────────────────── */

  formatDirection(dir: 'CREDIT' | 'DEBIT'): string {
    return dir === 'CREDIT' ? '↑ Credit' : '↓ Debit';
  }

  directionClass(dir: 'CREDIT' | 'DEBIT'): string {
    return dir === 'CREDIT' ? 'text-green-600' : 'text-red-500';
  }

  formatSource(source: string): string {
    return source
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  formatWalletType(wt: string): string {
    return wt.charAt(0) + wt.slice(1).toLowerCase();
  }

  /** Map currency code → symbol, consistent with the rest of the app. */
  getCurrencySymbol(currency?: string): string {
    if (!currency) return '$';
    return currency === 'NGN' ? '₦' : '$';
  }

  /**
   * Show the user-facing amount in display currency.
   *
   * Logic:
   *   1. If `displayAmount` is present AND differs from `amount` → use it
   *      (backend already converted, e.g. amount=35, displayAmount=35000).
   *   2. If `displayAmount` equals `amount` or is missing → convert manually
   *      using the derived exchange rate (e.g. 1.05 × 1000 = ₦1,050).
   *   3. For USD users (rate=1), amounts pass through unchanged.
   */
  formatAmount(item: LedgerActivityItem): string {
    const sym = this.getCurrencySymbol(item.displayCurrency);
    const rate = this.derivedRate();

    // Case 1: displayAmount exists AND was actually converted by the backend
    if (item.displayAmount != null && item.displayAmount !== item.amount) {
      return `${sym}${item.displayAmount.toLocaleString()}`;
    }

    // Case 2: No displayAmount, or displayAmount === amount (not converted).
    // Convert from base (USD) to display currency using derived rate.
    const converted = item.amount * rate;
    return `${sym}${converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}
