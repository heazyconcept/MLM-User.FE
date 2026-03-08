import { Injectable, signal, computed, inject } from '@angular/core';
import { of } from 'rxjs';
import { catchError, finalize, tap } from 'rxjs/operators';
import { PaymentService, PaymentRecord } from './payment.service';

export type TransactionType = 'Earnings' | 'Withdrawal' | 'Payment';
export type WalletType = 'cash' | 'voucher' | 'autoship';
export type TransactionStatus = 'Pending' | 'Completed' | 'Failed';
export type DateRangePreset = 'all' | 'today' | 'last7days' | 'last30days' | 'thisMonth' | 'custom';
export type SortField = 'date' | 'amount';
export type SortOrder = 'asc' | 'desc';

export interface Transaction {
  id: string;
  date: string;
  type: TransactionType;
  description: string;
  amount: number;
  wallet: WalletType;
  status: TransactionStatus;
  reference?: string;
  narrative?: string;
}

export interface TransactionFilters {
  dateRange: DateRangePreset;
  customStartDate?: Date;
  customEndDate?: Date;
  type?: TransactionType | 'all';
  wallet?: WalletType | 'all';
  status?: TransactionStatus | 'all';
  searchQuery?: string;
}

const FILTERS_KEY = 'mlm_transaction_filters';

@Injectable({
  providedIn: 'root'
})
export class TransactionService {
  private paymentService = inject(PaymentService);
  private _transactions = signal<Transaction[]>([]);
  private _filters = signal<TransactionFilters>({
    dateRange: 'all',
    type: 'all',
    wallet: 'all',
    status: 'all',
    searchQuery: ''
  });
  private _sortField = signal<SortField>('date');
  private _sortOrder = signal<SortOrder>('desc');
  private _isLoading = signal<boolean>(false);

  readonly transactions = this._transactions.asReadonly();
  readonly filters = this._filters.asReadonly();
  readonly sortField = this._sortField.asReadonly();
  readonly sortOrder = this._sortOrder.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();

  // Filtered and sorted transactions
  readonly filteredTransactions = computed(() => {
    let result = [...this._transactions()];
    const filters = this._filters();
    const sortField = this._sortField();
    const sortOrder = this._sortOrder();

    // Apply date range filter
    result = this.applyDateFilter(result, filters);

    // Apply type filter
    if (filters.type && filters.type !== 'all') {
      result = result.filter(t => t.type === filters.type);
    }

    // Apply wallet filter
    if (filters.wallet && filters.wallet !== 'all') {
      result = result.filter(t => t.wallet === filters.wallet);
    }

    // Apply status filter
    if (filters.status && filters.status !== 'all') {
      result = result.filter(t => t.status === filters.status);
    }

    // Apply search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      result = result.filter(t => 
        t.description.toLowerCase().includes(query) ||
        t.reference?.toLowerCase().includes(query) ||
        t.id.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'date') {
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (sortField === 'amount') {
        comparison = a.amount - b.amount;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return result;
  });

  readonly transactionCount = computed(() => this.filteredTransactions().length);
  readonly totalTransactionCount = computed(() => this._transactions().length);

  // Stats computed signals
  readonly totalEarnings = computed(() => {
    return this._transactions()
      .filter(t => t.type === 'Earnings' && t.status === 'Completed')
      .reduce((sum, t) => sum + t.amount, 0);
  });

  readonly totalWithdrawals = computed(() => {
    return this._transactions()
      .filter(t => t.type === 'Withdrawal' && t.status === 'Completed')
      .reduce((sum, t) => sum + t.amount, 0);
  });

  readonly totalPayments = computed(() => {
    return this._transactions()
      .filter(t => t.type === 'Payment' && t.status === 'Completed')
      .reduce((sum, t) => sum + t.amount, 0);
  });

  constructor() {
    this.loadFiltersFromStorage();
  }

  loadTransactions() {
    this._isLoading.set(true);
    return this.paymentService.getPayments(20, 0).pipe(
      tap((res) => {
        const items = res.items ?? [];
        const transactions = items.map((item) => this.mapPaymentToTransaction(item));
        this._transactions.set(transactions);
      }),
      catchError((err) => {
        console.error('Failed to load transactions from /payments', err);
        this._transactions.set([]);
        return of({ items: [] as PaymentRecord[], total: 0 });
      }),
      finalize(() => {
        this._isLoading.set(false);
      })
    );
  }

  setFilter<K extends keyof TransactionFilters>(key: K, value: TransactionFilters[K]): void {
    this._filters.update(f => ({ ...f, [key]: value }));
    this.saveFiltersToStorage();
  }

  setFilters(filters: Partial<TransactionFilters>): void {
    this._filters.update(f => ({ ...f, ...filters }));
    this.saveFiltersToStorage();
  }

  setSorting(field: SortField, order: SortOrder): void {
    this._sortField.set(field);
    this._sortOrder.set(order);
  }

  clearFilters(): void {
    this._filters.set({
      dateRange: 'all',
      type: 'all',
      wallet: 'all',
      status: 'all',
      searchQuery: ''
    });
    this.saveFiltersToStorage();
  }

  getTransactionById(id: string): Transaction | undefined {
    return this._transactions().find(t => t.id === id);
  }

  private applyDateFilter(transactions: Transaction[], filters: TransactionFilters): Transaction[] {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (filters.dateRange) {
      case 'today':
        return transactions.filter(t => new Date(t.date) >= startOfToday);
      
      case 'last7days':
        const last7Days = new Date(startOfToday);
        last7Days.setDate(last7Days.getDate() - 7);
        return transactions.filter(t => new Date(t.date) >= last7Days);
      
      case 'last30days':
        const last30Days = new Date(startOfToday);
        last30Days.setDate(last30Days.getDate() - 30);
        return transactions.filter(t => new Date(t.date) >= last30Days);
      
      case 'thisMonth':
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return transactions.filter(t => new Date(t.date) >= startOfMonth);
      
      case 'custom':
        if (filters.customStartDate && filters.customEndDate) {
          return transactions.filter(t => {
            const date = new Date(t.date);
            return date >= filters.customStartDate! && date <= filters.customEndDate!;
          });
        }
        return transactions;
      
      default:
        return transactions;
    }
  }

  private loadFiltersFromStorage(): void {
    const saved = localStorage.getItem(FILTERS_KEY);
    if (saved) {
      try {
        const filters = JSON.parse(saved) as TransactionFilters;
        // Don't restore custom dates as they may be stale
        if (filters.dateRange === 'custom') {
          filters.dateRange = 'all';
        }
        this._filters.set(filters);
      } catch {
        // Ignore invalid stored data
      }
    }
  }

  private saveFiltersToStorage(): void {
    const filters = this._filters();
    // Don't save custom dates
    const toSave = { ...filters };
    delete toSave.customStartDate;
    delete toSave.customEndDate;
    localStorage.setItem(FILTERS_KEY, JSON.stringify(toSave));
  }
  private mapPaymentToTransaction(item: PaymentRecord): Transaction {
    const createdAt = item.createdAt ? new Date(item.createdAt) : new Date();
    const rawStatus = (item.status || '').toString().toUpperCase();

    let status: TransactionStatus;
    if (rawStatus === 'COMPLETED' || rawStatus === 'SUCCESS') {
      status = 'Completed';
    } else if (rawStatus === 'FAILED') {
      status = 'Failed';
    } else {
      status = 'Pending';
    }

    const description =
      item.type && item.reference
        ? `${item.type} - ${item.reference}`
        : item.type || item.reference || 'Payment';

    return {
      id: item.id,
      date: createdAt.toISOString(),
      type: 'Payment',
      description,
      amount: item.amount,
      wallet: 'cash',
      status,
      reference: item.reference,
      narrative: undefined,
    };
  }
}

