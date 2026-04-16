import { Injectable, signal, computed, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { ApiService } from './api.service';
import { ModalService } from './modal.service';

// API response types (OpenAPI has no schema; infer from API.md)
export type WalletType = 'CASH' | 'VOUCHER' | 'AUTOSHIP' | 'REGISTRATION';

export interface AutoshipStatus {
  nextAutoshipDate: string | null;
  status: 'Active' | 'Inactive';
  configuration: {
    monthlyAutoshipAmountUsd: number;
    deductFrom: string;
  };
}

export interface TransferRequest {
  fromWalletType: 'CASH';
  toWalletType: 'REGISTRATION' | 'VOUCHER' | 'AUTOSHIP';
  amount: number;
  currency: 'NGN' | 'USD';
}

export interface TransferResponse {
  transferId: string;
}

export interface ApiWalletItem {
  id: string;
  type?: WalletType;
  balance: number;
  currency?: 'NGN' | 'USD';
  status?: string;
  cash_balance?: number;
  voucher_balance?: number;
  autoship_balance?: number;
}

export interface Wallet {
  id: string;
  currency: 'NGN' | 'USD';
  balance: number;
  cashBalance: number;
  voucherBalance: number;
  autoshipBalance: number;
  registrationBalance: number;
}

export interface Transaction {
  id: string;
  date: string;
  type: 'Deposit' | 'Commission' | 'Withdrawal';
  amount: number;
  currency: 'NGN' | 'USD';
  status: 'Pending' | 'Approved' | 'Rejected';
  description?: string;
}

/** API response shape for GET/POST withdrawals (WithdrawalResponseDto) */
export interface WithdrawalResponseDto {
  id: string;
  userId?: string;
  walletId?: string;
  amount: number;
  baseAmount?: number;
  currency: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';
  reason?: string | null;
  payoutReference?: string | null;
  approvedAt?: string | null;
  paidAt?: string | null;
  rejectedAt?: string | null;
  approvedById?: string | null;
  rejectedById?: string | null;
  paidById?: string | null;
  createdAt: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
}

export interface WithdrawalRequest {
  id: string;
  date: string;
  currency: 'NGN' | 'USD';
  amount: number;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Paid';
  bankName: string;
  accountNumber: string;
  accountName: string;
  reason?: string | null;
  payoutReference?: string | null;
  paidAt?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class WalletService {
  private api = inject(ApiService);
  private modalService = inject(ModalService);

  private wallets = signal<Wallet[]>([]);
  private transactions = signal<Transaction[]>([]);
  private withdrawalRequests = signal<WithdrawalRequest[]>([]);
  private autoshipStatusSignal = signal<AutoshipStatus | null>(null);

  readonly allWallets = computed(() => this.wallets());
  readonly allTransactions = computed(() => this.transactions());
  readonly allWithdrawals = computed(() => this.withdrawalRequests());
  readonly autoshipStatus = this.autoshipStatusSignal.asReadonly();

  readonly totalBalance = computed(() =>
    this.wallets().reduce((sum, w) => sum + w.balance, 0)
  );
  readonly totalCashBalance = computed(() =>
    this.wallets().reduce((sum, w) => sum + w.cashBalance, 0)
  );
  readonly totalVoucherBalance = computed(() =>
    this.wallets().reduce((sum, w) => sum + w.voucherBalance, 0)
  );
  readonly totalAutoshipBalance = computed(() =>
    this.wallets().reduce((sum, w) => sum + w.autoshipBalance, 0)
  );
  readonly totalRegistrationBalance = computed(() =>
    this.wallets().reduce((sum, w) => sum + w.registrationBalance, 0)
  );

  getWallet(currency: 'NGN' | 'USD') {
    return computed(() => this.wallets().find(w => w.currency === currency));
  }

  /**
   * Maps API response to Wallet[]. Handles:
   * - Array of per-type wallets (CASH, VOUCHER, AUTOSHIP) grouped by currency
   * - Single wallet object with cash/voucher/autoship balances
   */
  private mapApiWalletsToWallets(raw: unknown): Wallet[] {
    if (!raw) return [];

    const items = Array.isArray(raw) ? raw : (raw as { wallets?: unknown[] }).wallets ?? [];
    if (!Array.isArray(items) || items.length === 0) {
      // Single summary object (multiple possible shapes)
      const obj = raw as Record<string, unknown>;

      // Shape A: aggregated balances { cash, voucher, autoship, currency }
      let cash = Number(obj['cash'] ?? obj['cashBalance'] ?? 0);
      let voucher = Number(obj['voucher'] ?? obj['voucherBalance'] ?? 0);
      let autoship = Number(obj['autoship'] ?? obj['autoshipBalance'] ?? 0);
      let currency = (obj['currency'] ?? 'NGN') as 'NGN' | 'USD';

      // Shape B: separate wallets { cashWallet, voucherWallet, autoshipWallet, registrationWallet }
      const cashWallet = obj['cashWallet'] as { balance?: unknown; currency?: unknown } | undefined;
      const voucherWallet = obj['voucherWallet'] as { balance?: unknown; currency?: unknown } | undefined;
      const autoshipWallet = obj['autoshipWallet'] as { balance?: unknown; currency?: unknown } | undefined;

      const registrationWallet = obj['registrationWallet'] as { balance?: unknown; currency?: unknown } | undefined;

      if (cashWallet || voucherWallet || autoshipWallet || registrationWallet) {
        const derivedCurrency =
          (cashWallet?.currency ??
            voucherWallet?.currency ??
            autoshipWallet?.currency ??
            registrationWallet?.currency ??
            'NGN') as 'NGN' | 'USD';
        cash = Number(cashWallet?.balance ?? cash ?? 0);
        voucher = Number(voucherWallet?.balance ?? voucher ?? 0);
        autoship = Number(autoshipWallet?.balance ?? autoship ?? 0);
        const registration = Number(registrationWallet?.balance ?? 0);
        currency = derivedCurrency;

        if (cash === 0 && voucher === 0 && autoship === 0 && registration === 0) return [];
        return [{
          id: '1',
          currency,
          balance: cash + voucher + autoship + registration,
          cashBalance: cash,
          voucherBalance: voucher,
          autoshipBalance: autoship,
          registrationBalance: registration
        }];
      }

      if (cash === 0 && voucher === 0 && autoship === 0) return [];
      return [{
        id: '1',
        currency,
        balance: cash + voucher + autoship,
        cashBalance: cash,
        voucherBalance: voucher,
        autoshipBalance: autoship,
        registrationBalance: 0
      }];
    }

    const byCurrency = new Map<string, { cash: number; voucher: number; autoship: number; registration: number; id: string }>();
    for (const item of items as ApiWalletItem[]) {
      const type = (item.type ?? 'CASH').toUpperCase();
      const currency = (item.currency ?? 'NGN') as 'NGN' | 'USD';
      const balance = Number(item.balance ?? 0);
      const cash = Number(item.cash_balance ?? (type === 'CASH' ? balance : 0));
      const voucher = Number(item.voucher_balance ?? (type === 'VOUCHER' ? balance : 0));
      const autoship = Number(item.autoship_balance ?? (type === 'AUTOSHIP' ? balance : 0));

      const key = currency;
      const existing = byCurrency.get(key);
      if (existing) {
        existing.cash += type === 'CASH' ? balance : cash;
        existing.voucher += type === 'VOUCHER' ? balance : voucher;
        existing.autoship += type === 'AUTOSHIP' ? balance : autoship;
        existing.registration += type === 'REGISTRATION' ? balance : 0;
      } else {
        byCurrency.set(key, {
          id: item.id,
          cash: type === 'CASH' ? balance : cash,
          voucher: type === 'VOUCHER' ? balance : voucher,
          autoship: type === 'AUTOSHIP' ? balance : autoship,
          registration: type === 'REGISTRATION' ? balance : 0
        });
      }
    }

    return Array.from(byCurrency.entries()).map(([currency, data]) => ({
      id: data.id,
      currency: currency as 'NGN' | 'USD',
      balance: data.cash + data.voucher + data.autoship + data.registration,
      cashBalance: data.cash,
      voucherBalance: data.voucher,
      autoshipBalance: data.autoship,
      registrationBalance: data.registration
    }));
  }

  /**
   * Maps API withdrawal item to WithdrawalRequest.
   */
  private mapApiWithdrawalToWithdrawal(item: Record<string, unknown>): WithdrawalRequest {
    const status = String(item['status'] ?? 'PENDING').toUpperCase();
    let mappedStatus: 'Pending' | 'Approved' | 'Rejected' | 'Paid' = 'Pending';
    if (status === 'PAID') mappedStatus = 'Paid';
    else if (status === 'APPROVED') mappedStatus = 'Approved';
    else if (status === 'REJECTED') mappedStatus = 'Rejected';

    return {
      id: String(item['id'] ?? ''),
      date: String(item['createdAt'] ?? item['date'] ?? new Date().toISOString()),
      currency: (item['currency'] ?? 'NGN') as 'NGN' | 'USD',
      amount: Number(item['amount'] ?? 0),
      status: mappedStatus,
      bankName: String(item['bankName'] ?? item['bank_name'] ?? ''),
      accountNumber: String(item['accountNumber'] ?? item['account_number'] ?? ''),
      accountName: String(item['accountName'] ?? item['account_name'] ?? ''),
      reason: item['reason'] != null ? String(item['reason']) : undefined,
      payoutReference: item['payoutReference'] != null ? String(item['payoutReference']) : undefined,
      paidAt: item['paidAt'] != null ? String(item['paidAt']) : undefined
    };
  }

  fetchWallets(): Observable<Wallet[]> {
    return this.api.get<unknown>('wallets').pipe(
      map(raw => this.mapApiWalletsToWallets(raw)),
      tap(wallets => this.wallets.set(wallets)),
      catchError(err => {
        if (err?.status === 403) {
          this.wallets.set([]);
          return of([]);
        }
        throw err;
      })
    );
  }

  /**
   * TODO: No transactions endpoint in API.md. Returns empty for now.
   */
  fetchTransactions(currency?: 'NGN' | 'USD'): Observable<Transaction[]> {
    this.transactions.set([]);
    return of([]);
  }

  withdraw(params: {
    currency: 'NGN' | 'USD';
    amount: number;
    bankName: string;
    accountNumber: string;
    accountName: string;
  }): Observable<WithdrawalRequest> {
    const { currency, amount } = params;

    return this.api.post<Record<string, unknown>>('withdrawals/request', { amount }).pipe(
      map(raw => this.mapApiWithdrawalToWithdrawal(raw as Record<string, unknown>)),
      tap(mapped => {
        this.modalService.open(
          'success',
          'Withdrawal Submitted',
          `Your withdrawal request of ${currency === 'NGN' ? '₦' : '$'}${amount} has been successfully submitted and is currently pending admin approval.`,
          `/withdrawals/${mapped.id}`
        );
        this.fetchWallets().subscribe();
        this.fetchWithdrawals().subscribe();
      }),
      catchError(err => {
        const msg = err?.status === 403
          ? "You're not yet eligible to withdraw."
          : (err?.error?.message ?? (Array.isArray(err?.error?.message) ? err.error.message[0] : null)
            ?? 'Could not submit withdrawal. Please try again or contact support.');
        this.modalService.open('error', 'Withdrawal Failed', msg);
        throw err;
      })
    );
  }

  fetchWithdrawals(limit = 20, offset = 0): Observable<WithdrawalRequest[]> {
    return this.api
      .get<{ items?: unknown[]; data?: unknown[] } | unknown[]>('withdrawals', { limit, offset })
      .pipe(
        map(raw => {
          const arr = Array.isArray(raw) ? raw : (raw as { items?: unknown[] }).items ?? (raw as { data?: unknown[] }).data ?? [];
          return (arr as Record<string, unknown>[]).map(item => this.mapApiWithdrawalToWithdrawal(item));
        }),
        tap(requests => this.withdrawalRequests.set(requests)),
        catchError(err => {
          if (err?.status === 403) {
            this.withdrawalRequests.set([]);
            return of([]);
          }
          throw err;
        })
      );
  }

  /** GET /withdrawals/{id} - fetch a single withdrawal by id */
  fetchWithdrawalById(id: string): Observable<WithdrawalRequest> {
    return this.api.get<Record<string, unknown>>(`withdrawals/${id}`).pipe(
      map(raw => this.mapApiWithdrawalToWithdrawal(raw as Record<string, unknown>))
    );
  }

  /** GET /wallets/autoship/status */
  fetchAutoshipStatus(): Observable<AutoshipStatus | null> {
    return this.api.get<Record<string, unknown>>('wallets/autoship/status').pipe(
      map(raw => {
        const config = (raw['configuration'] ?? {}) as Record<string, unknown>;
        return {
          nextAutoshipDate: raw['nextAutoshipDate'] ? String(raw['nextAutoshipDate']) : null,
          status: String(raw['status'] ?? 'Inactive') as 'Active' | 'Inactive',
          configuration: {
            monthlyAutoshipAmountUsd: Number(config['monthlyAutoshipAmountUsd'] ?? 10),
            deductFrom: String(config['deductFrom'] ?? 'AUTOSHIP')
          }
        };
      }),
      tap(status => this.autoshipStatusSignal.set(status)),
      catchError(() => {
        this.autoshipStatusSignal.set(null);
        return of(null);
      })
    );
  }

  /** POST /wallets/transfer */
  transferBetweenWallets(request: TransferRequest): Observable<TransferResponse> {
    return this.api.post<TransferResponse>('wallets/transfer', request).pipe(
      tap(() => {
        const sym = request.currency === 'NGN' ? '₦' : '$';
        const targetLabel = request.toWalletType === 'AUTOSHIP' ? 'Autoship'
          : request.toWalletType === 'VOUCHER' ? 'Voucher'
          : 'Registration';
        this.modalService.open(
          'success',
          'Transfer Successful',
          `${sym}${request.amount.toLocaleString()} has been moved from your Cash wallet to your ${targetLabel} wallet.`,
          '/wallet'
        );
        // Refresh wallets to show updated balances
        this.fetchWallets().subscribe();
      }),
      catchError(err => {
        const raw = err?.error?.message;
        const msg = Array.isArray(raw) ? raw[0] : (raw ?? 'Transfer failed. Please try again or contact support.');
        this.modalService.open('error', 'Transfer Failed', msg);
        throw err;
      })
    );
  }
}
