import { Injectable, signal, computed } from '@angular/core';
import { of } from 'rxjs';
import { delay, tap } from 'rxjs/operators';

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
    return of(this.getMockTransactions()).pipe(
      delay(800),
      tap(transactions => {
        this._transactions.set(transactions);
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

  private getMockTransactions(): Transaction[] {
    const now = new Date();
    const transactions: Transaction[] = [
      // Recent transactions
      {
        id: 'TXN-001',
        date: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'Earnings',
        description: 'Direct Referral Commission - John Doe',
        amount: 5000,
        wallet: 'cash',
        status: 'Completed',
        reference: 'REF-DR-001',
        narrative: 'Commission earned from direct referral signup. Member: John Doe, Package: VIP'
      },
      {
        id: 'TXN-002',
        date: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'Payment',
        description: 'Product Purchase - Organic Green Tea Blend',
        amount: 15000,
        wallet: 'cash',
        status: 'Completed',
        reference: 'ORD-TEA-001',
        narrative: 'Product purchase from marketplace. Quantity: 1'
      },
      {
        id: 'TXN-003',
        date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'Earnings',
        description: 'Matrix Matching Bonus - Level 2',
        amount: 2500,
        wallet: 'cash',
        status: 'Completed',
        reference: 'REF-MB-002',
        narrative: 'Matrix matching bonus from level 2 downline activity'
      },
      {
        id: 'TXN-004',
        date: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'Withdrawal',
        description: 'Bank Withdrawal - Access Bank',
        amount: 25000,
        wallet: 'cash',
        status: 'Completed',
        reference: 'WDR-001',
        narrative: 'Withdrawal to Access Bank ****7890'
      },
      {
        id: 'TXN-005',
        date: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'Earnings',
        description: 'Team Volume Bonus',
        amount: 7500,
        wallet: 'voucher',
        status: 'Completed',
        reference: 'REF-TVB-001',
        narrative: 'Monthly team volume bonus for achieving 50,000 CPV'
      },
      {
        id: 'TXN-006',
        date: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'Payment',
        description: 'Monthly Autoship - Wellness Box',
        amount: 18000,
        wallet: 'autoship',
        status: 'Completed',
        reference: 'AUT-001',
        narrative: 'Recurring autoship subscription payment'
      },
      {
        id: 'TXN-007',
        date: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'Earnings',
        description: 'Direct Referral Commission - Jane Smith',
        amount: 5000,
        wallet: 'cash',
        status: 'Completed',
        reference: 'REF-DR-002',
        narrative: 'Commission earned from direct referral signup. Member: Jane Smith, Package: Premium'
      },
      {
        id: 'TXN-008',
        date: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'Withdrawal',
        description: 'Bank Withdrawal - GTBank',
        amount: 15000,
        wallet: 'cash',
        status: 'Pending',
        reference: 'WDR-002',
        narrative: 'Withdrawal to GTBank ****4567. Awaiting approval.'
      },
      {
        id: 'TXN-009',
        date: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'Payment',
        description: 'Product Purchase - Fitness Tracker X1',
        amount: 45000,
        wallet: 'voucher',
        status: 'Completed',
        reference: 'ORD-FIT-001',
        narrative: 'Product purchase using voucher wallet balance'
      },
      {
        id: 'TXN-010',
        date: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'Earnings',
        description: 'Leadership Pool Bonus',
        amount: 12500,
        wallet: 'cash',
        status: 'Completed',
        reference: 'REF-LP-001',
        narrative: 'Monthly leadership pool distribution for qualifying rank'
      },
      {
        id: 'TXN-011',
        date: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'Payment',
        description: 'Registration Fee - VIP Package',
        amount: 50000,
        wallet: 'cash',
        status: 'Completed',
        reference: 'REG-VIP-001',
        narrative: 'Initial registration and package purchase'
      },
      {
        id: 'TXN-012',
        date: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'Earnings',
        description: 'Matrix Cycle Bonus',
        amount: 10000,
        wallet: 'cash',
        status: 'Completed',
        reference: 'REF-MC-001',
        narrative: 'Bonus for completing matrix cycle'
      },
      {
        id: 'TXN-013',
        date: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'Withdrawal',
        description: 'Bank Withdrawal - First Bank',
        amount: 8000,
        wallet: 'cash',
        status: 'Failed',
        reference: 'WDR-003',
        narrative: 'Withdrawal failed. Reason: Invalid account details'
      },
      {
        id: 'TXN-014',
        date: new Date(now.getTime() - 18 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'Earnings',
        description: 'Retail Profit Bonus',
        amount: 3500,
        wallet: 'cash',
        status: 'Completed',
        reference: 'REF-RP-001',
        narrative: 'Profit from retail sales to non-members'
      },
      {
        id: 'TXN-015',
        date: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'Payment',
        description: 'Product Purchase - Headphones',
        amount: 75000,
        wallet: 'cash',
        status: 'Completed',
        reference: 'ORD-HEAD-001',
        narrative: 'Wireless Noise-Cancelling Headphones purchase'
      },
      {
        id: 'TXN-016',
        date: new Date(now.getTime() - 22 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'Earnings',
        description: 'Direct Referral Commission - Mike Johnson',
        amount: 5000,
        wallet: 'cash',
        status: 'Completed',
        reference: 'REF-DR-003',
        narrative: 'Commission earned from direct referral signup. Member: Mike Johnson, Package: Standard'
      },
      {
        id: 'TXN-017',
        date: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'Earnings',
        description: 'Generation Bonus - Level 3',
        amount: 1500,
        wallet: 'voucher',
        status: 'Completed',
        reference: 'REF-GB-001',
        narrative: 'Generation bonus from 3rd level downline'
      },
      {
        id: 'TXN-018',
        date: new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'Payment',
        description: 'Monthly Autoship - Vitamins',
        amount: 12000,
        wallet: 'autoship',
        status: 'Completed',
        reference: 'AUT-002',
        narrative: 'Recurring autoship subscription payment'
      },
      {
        id: 'TXN-019',
        date: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'Withdrawal',
        description: 'Bank Withdrawal - UBA',
        amount: 20000,
        wallet: 'cash',
        status: 'Completed',
        reference: 'WDR-004',
        narrative: 'Withdrawal to UBA ****1234'
      },
      {
        id: 'TXN-020',
        date: new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'Earnings',
        description: 'Rank Advancement Bonus - Gold',
        amount: 25000,
        wallet: 'cash',
        status: 'Completed',
        reference: 'REF-RA-001',
        narrative: 'One-time bonus for advancing to Gold rank'
      },
      {
        id: 'TXN-021',
        date: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'Payment',
        description: 'Product Purchase - Yoga Mat Set',
        amount: 19000,
        wallet: 'voucher',
        status: 'Completed',
        reference: 'ORD-YOGA-001',
        narrative: 'Yoga Mat & Accessories Set purchase'
      },
      {
        id: 'TXN-022',
        date: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'Earnings',
        description: 'Matrix Matching Bonus - Level 1',
        amount: 4000,
        wallet: 'cash',
        status: 'Completed',
        reference: 'REF-MB-003',
        narrative: 'Matrix matching bonus from level 1 downline activity'
      },
      {
        id: 'TXN-023',
        date: new Date(now.getTime() - 50 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'Earnings',
        description: 'Direct Referral Commission - Sarah Lee',
        amount: 5000,
        wallet: 'cash',
        status: 'Completed',
        reference: 'REF-DR-004',
        narrative: 'Commission earned from direct referral signup. Member: Sarah Lee, Package: VIP'
      },
      {
        id: 'TXN-024',
        date: new Date(now.getTime() - 55 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'Withdrawal',
        description: 'Bank Withdrawal - Zenith Bank',
        amount: 30000,
        wallet: 'cash',
        status: 'Completed',
        reference: 'WDR-005',
        narrative: 'Withdrawal to Zenith Bank ****5678'
      }
    ];

    return transactions;
  }
}

