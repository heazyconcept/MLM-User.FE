import { Component, inject, signal, computed, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DashboardService, DashboardTransaction } from '../../services/dashboard.service';

type DateRangePreset = 'all' | 'today' | 'last7days' | 'last30days' | 'thisMonth';
type TransactionStatus = DashboardTransaction['status'];
type TransactionType = DashboardTransaction['type'];

type TransactionFilters = {
  dateRange: DateRangePreset;
  type: TransactionType | 'all';
  status: TransactionStatus | 'all';
  searchQuery: string;
};

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DatePipe
  ],
  templateUrl: './transactions.component.html',
  
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TransactionsComponent implements OnInit {
  private dashboardService = inject(DashboardService);

  allTransactions = signal<DashboardTransaction[]>([]);
  nextCursor = signal<string | null>(null);
  isLoading = signal(false);
  filters = signal<TransactionFilters>({
    dateRange: 'all',
    type: 'all',
    status: 'all',
    searchQuery: ''
  });

  // Local state
  searchInput = signal('');

  transactions = computed(() => {
    let result = [...this.allTransactions()];
    const f = this.filters();

    result = this.applyDateFilter(result, f.dateRange);

    if (f.type !== 'all') {
      result = result.filter((t) => t.type === f.type);
    }

    if (f.status !== 'all') {
      result = result.filter((t) => t.status === f.status);
    }

    if (f.searchQuery.trim()) {
      const q = f.searchQuery.toLowerCase();
      result = result.filter(
        (t) => t.description.toLowerCase().includes(q) || t.id.toLowerCase().includes(q)
      );
    }

    return result;
  });

  transactionCount = computed(() => this.transactions().length);
  totalTransactionCount = computed(() => this.allTransactions().length);

  // Filter options
  dateRangeOptions = [
    { label: 'All Time', value: 'all' as DateRangePreset },
    { label: 'Today', value: 'today' as DateRangePreset },
    { label: 'Last 7 Days', value: 'last7days' as DateRangePreset },
    { label: 'Last 30 Days', value: 'last30days' as DateRangePreset },
    { label: 'This Month', value: 'thisMonth' as DateRangePreset }
  ];

  typeOptions = [
    { label: 'All Types', value: 'all' },
    { label: 'Credit', value: 'Credit' as TransactionType },
    { label: 'Debit', value: 'Debit' as TransactionType }
  ];

  statusOptions = [
    { label: 'All Statuses', value: 'all' },
    { label: 'Completed', value: 'Completed' as TransactionStatus },
    { label: 'Pending', value: 'Pending' as TransactionStatus },
    { label: 'Failed', value: 'Failed' as TransactionStatus }
  ];

  // Check if any filter is active
  hasActiveFilters = computed(() => {
    const f = this.filters();
    return f.dateRange !== 'all' || 
           f.type !== 'all' || 
           f.status !== 'all' || 
           (f.searchQuery && f.searchQuery.length > 0);
  });

  ngOnInit(): void {
    this.loadInitialTransactions();
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchInput.set(value);
    this.filters.update((f) => ({ ...f, searchQuery: value }));
  }

  onDateRangeChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as DateRangePreset;
    this.filters.update((f) => ({ ...f, dateRange: value }));
  }

  onTypeChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.filters.update((f) => ({ ...f, type: value as TransactionType | 'all' }));
  }

  onStatusChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.filters.update((f) => ({ ...f, status: value as TransactionStatus | 'all' }));
  }

  onClearFilters(): void {
    this.searchInput.set('');
    this.filters.set({
      dateRange: 'all',
      type: 'all',
      status: 'all',
      searchQuery: ''
    });
  }

  exportCSV(): void {
    const headers = ['Date', 'Description', 'Type', 'Amount', 'Status'];
    const rows = this.transactions().map((tx) => [
      new Date(tx.date).toISOString(),
      tx.description,
      this.isCredit(tx) ? 'Credit' : 'Debit',
      this.formatTransactionAmount(tx),
      tx.status
    ]);

    const escape = (value: string) => {
      const v = String(value ?? '');
      if (v.includes(',') || v.includes('"') || v.includes('\n')) {
        return `"${v.replace(/"/g, '""')}"`;
      }
      return v;
    };

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => escape(String(cell))).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  loadMoreTransactions(): void {
    const cursor = this.nextCursor();
    if (!cursor || this.isLoading()) {
      return;
    }

    this.isLoading.set(true);
    this.dashboardService.getTransactions(20, cursor).subscribe({
      next: (res) => {
        const nextItems = res.items ?? [];
        this.allTransactions.update((items) => [...items, ...nextItems]);
        this.nextCursor.set(res.nextCursor ?? null);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  isCredit(transaction: DashboardTransaction): boolean {
    return transaction.type === 'Credit';
  }

  formatTransactionAmount(tx: DashboardTransaction): string {
    const sign = tx.type === 'Debit' ? '-' : '+';
    const sym = tx.currency === 'USD' ? '$' : '₦';
    const n = new Intl.NumberFormat('en-NG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(tx.amount);
    return `${sign}${sym}${n}`;
  }

  getTransactionStatusClass(status: TransactionStatus): string {
    if (status === 'Completed') return 'text-mlm-green-700 bg-mlm-green-50 border-mlm-green-200';
    if (status === 'Pending') return 'text-mlm-warning bg-mlm-warning/10 border-mlm-warning/30';
    return 'text-mlm-red-600 bg-mlm-red-50 border-mlm-red-200';
  }

  private loadInitialTransactions(): void {
    this.isLoading.set(true);
    this.dashboardService.getTransactions(20).subscribe({
      next: (res) => {
        this.allTransactions.set(res.items ?? []);
        this.nextCursor.set(res.nextCursor ?? null);
        this.isLoading.set(false);
      },
      error: () => {
        this.allTransactions.set([]);
        this.nextCursor.set(null);
        this.isLoading.set(false);
      }
    });
  }

  private applyDateFilter(transactions: DashboardTransaction[], dateRange: DateRangePreset): DashboardTransaction[] {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (dateRange) {
      case 'today':
        return transactions.filter((t) => new Date(t.date) >= startOfToday);
      case 'last7days': {
        const start = new Date(startOfToday);
        start.setDate(start.getDate() - 7);
        return transactions.filter((t) => new Date(t.date) >= start);
      }
      case 'last30days': {
        const start = new Date(startOfToday);
        start.setDate(start.getDate() - 30);
        return transactions.filter((t) => new Date(t.date) >= start);
      }
      case 'thisMonth': {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return transactions.filter((t) => new Date(t.date) >= start);
      }
      default:
        return transactions;
    }
  }
}

