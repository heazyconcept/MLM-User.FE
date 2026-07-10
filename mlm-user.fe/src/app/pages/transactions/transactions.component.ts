import { Component, inject, signal, computed, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DashboardService, DashboardTransaction, DashboardTransactionsQuery } from '../../services/dashboard.service';
import { CommissionService } from '../../services/commission.service';
import { EarningsService } from '../../services/earnings.service';
import { UserService } from '../../services/user.service';
import { InvoiceService } from '../../services/invoice.service';
import { StatusBadgeComponent } from '../../components/status-badge/status-badge.component';
import { InvoiceModalComponent } from '../../components/invoice-modal/invoice-modal.component';
import { SkeletonModule } from 'primeng/skeleton';

type DateRangePreset = 'all' | 'today' | 'last7days' | 'last30days' | 'thisMonth';
type TransactionStatus = DashboardTransaction['status'];
type TransactionType = DashboardTransaction['type'];
type TransactionTab = 'all' | 'earnings' | 'breakdown' | 'wallet' | 'withdrawals' | 'payments' | 'autoship' | 'voucher';

type TransactionFilters = {
  dateRange: DateRangePreset;
  type: TransactionType | 'all';
  status: TransactionStatus | 'all';
  searchQuery: string;
};

type TabSummary = {
  count: number;
  netAmount: number;
  creditAmount: number;
  debitAmount: number;
  pendingCount: number;
  completedCount: number;
};

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DatePipe,
    StatusBadgeComponent,
    InvoiceModalComponent,
    SkeletonModule
  ],
  templateUrl: './transactions.component.html',
  
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TransactionsComponent implements OnInit {
  private dashboardService = inject(DashboardService);
  private commissionService = inject(CommissionService);
  private earningsService = inject(EarningsService);
  userService = inject(UserService);
  invoiceService = inject(InvoiceService);

  allCommissions = this.commissionService.getAllCommissions();
  earningsIsLoading = this.earningsService.isLoading;
  earningsError = this.earningsService.error;

  activeTab = signal<TransactionTab>('all');
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

  // Pagination state for transactions table (client-side slice)
  txPage = signal(1);
  txPageSize = signal(10);
  txPageSizeOptions = [10, 20, 50];
  displayedTransactions = computed(() => {
    const start = (this.txPage() - 1) * this.txPageSize();
    return this.transactions().slice(start, start + this.txPageSize());
  });
  txTotalPages = computed(() => Math.max(1, Math.ceil(this.transactions().length / this.txPageSize())));
  txCanGoPrevious = computed(() => this.txPage() > 1);
  txCanGoNext = computed(() => this.txPage() < this.txTotalPages() || !!this.nextCursor());

  // Pagination state for commissions (breakdown)
  commPage = signal(1);
  commPageSize = signal(10);
  displayedCommissions = computed(() => {
    const start = (this.commPage() - 1) * this.commPageSize();
    return this.allCommissions().slice(start, start + this.commPageSize());
  });
  commTotalPages = computed(() => Math.max(1, Math.ceil(this.allCommissions().length / this.commPageSize())));
  commCanGoPrevious = computed(() => this.commPage() > 1);
  commCanGoNext = computed(() => this.commPage() < this.commTotalPages());

  tabOptions: Array<{ label: string; value: TransactionTab }> = [
    { label: 'All', value: 'all' },
    { label: 'Earnings', value: 'earnings' },
    { label: 'Earning Breakdown', value: 'breakdown' },
    { label: 'Wallet', value: 'wallet' },
    { label: 'Withdrawals', value: 'withdrawals' },
    { label: 'Payments', value: 'payments' },
    { label: 'Autoship', value: 'autoship' },
    { label: 'Product Voucher', value: 'voucher' },
  ];

  transactions = computed(() => {
    let result = [...this.allTransactions()];
    const f = this.filters();
    const tab = this.activeTab();

    if (tab !== 'all' && tab !== 'breakdown') {
      result = result.filter((t) => this.matchesTabFilter(t, tab));
    }

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

    // If current tx page becomes invalid (e.g., filters reduced items), clamp it
    if (this.txPage() > Math.max(1, Math.ceil(result.length / this.txPageSize()))) {
      this.txPage.set(1);
    }

    return result;
  });

  transactionCount = computed(() => this.transactions().length);
  totalTransactionCount = computed(() => this.allTransactions().length);

  summary = computed<TabSummary>(() => {
    const items = this.transactions();
    return items.reduce<TabSummary>(
      (acc, tx) => {
        const amount = Math.abs(tx.amount);
        const isCredit = this.isCredit(tx);
        acc.count += 1;
        acc.netAmount += isCredit ? amount : -amount;
        if (isCredit) {
          acc.creditAmount += amount;
        } else {
          acc.debitAmount += amount;
        }
        if (tx.status === 'Pending') {
          acc.pendingCount += 1;
        }
        if (tx.status === 'Completed') {
          acc.completedCount += 1;
        }
        return acc;
      },
      {
        count: 0,
        netAmount: 0,
        creditAmount: 0,
        debitAmount: 0,
        pendingCount: 0,
        completedCount: 0,
      }
    );
  });

  emptyStateMessage = computed(() => {
    const tab = this.activeTab();
    if (tab === 'earnings') return 'No earnings transactions available yet.';
    if (tab === 'breakdown') return 'No commission breakdown available yet.';
    if (tab === 'wallet') return 'No wallet transactions available yet.';
    if (tab === 'withdrawals') return 'No withdrawal transactions available yet.';
    if (tab === 'payments') return 'No payment transactions available yet.';
    if (tab === 'autoship') return 'No autoship transactions available yet.';
    if (tab === 'voucher') {
      return 'No product voucher transactions available yet.';
    }
    return 'No transactions available.';
  });

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
    if (this.activeTab() !== 'breakdown') {
      this.loadInitialTransactions();
    }
    if (this.userService.isPaid()) {
      this.earningsService.fetchEarningsSectionData();
    }
  }

  onTabChange(tab: TransactionTab): void {
    if (tab === this.activeTab()) {
      return;
    }
    this.activeTab.set(tab);
    if (tab === 'breakdown') {
      return;
    }
    this.resetAndLoadTransactions();
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchInput.set(value);
    this.filters.update((f) => ({ ...f, searchQuery: value }));
    this.txPage.set(1);
    this.commPage.set(1);
  }

  onDateRangeChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as DateRangePreset;
    this.filters.update((f) => ({ ...f, dateRange: value }));
    this.txPage.set(1);
    this.commPage.set(1);
  }

  onTypeChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.filters.update((f) => ({ ...f, type: value as TransactionType | 'all' }));
    this.txPage.set(1);
    this.commPage.set(1);
  }

  onStatusChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.filters.update((f) => ({ ...f, status: value as TransactionStatus | 'all' }));
    this.txPage.set(1);
    this.commPage.set(1);
  }

  onTxPageSizeChange(event: Event): void {
    const size = Number((event.target as HTMLSelectElement).value);
    if (!Number.isFinite(size) || size <= 0 || size === this.txPageSize()) {
      return;
    }
    this.txPageSize.set(size);
    this.txPage.set(1);
    this.resetAndLoadTransactions();
  }

  onClearFilters(): void {
    this.searchInput.set('');
    this.filters.set({
      dateRange: 'all',
      type: 'all',
      status: 'all',
      searchQuery: ''
    });
    this.txPage.set(1);
    this.commPage.set(1);
  }

  exportCSV(): void {
    const headers = ['Date', 'Description', 'Category', 'Type', 'Amount', 'Status'];
    const rows = this.transactions().map((tx) => [
      new Date(tx.date).toISOString(),
      tx.description,
      this.formatTransactionCategory(tx),
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
    if (!cursor || this.isLoading() || this.activeTab() === 'breakdown') {
      return;
    }

    this.isLoading.set(true);
    this.dashboardService.getTransactions(this.txPageSize(), cursor, this.getTabQuery()).subscribe({
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

  // Transactions pagination controls
  txPreviousPage(): void {
    if (this.txPage() > 1) this.txPage.update((p) => p - 1);
  }
  txNextPage(): void {
    if (this.txPage() < this.txTotalPages()) {
      this.txPage.update((p) => p + 1);
      return;
    }

    const cursor = this.nextCursor();
    if (!cursor || this.isLoading()) {
      return;
    }

    this.isLoading.set(true);
    this.dashboardService.getTransactions(this.txPageSize(), cursor, this.getTabQuery()).subscribe({
      next: (res) => {
        const nextItems = res.items ?? [];
        this.allTransactions.update((items) => [...items, ...nextItems]);
        this.nextCursor.set(res.nextCursor ?? null);
        this.txPage.update((p) => p + 1);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }
  txShowingFrom(): number {
    const from = (this.txPage() - 1) * this.txPageSize() + 1;
    return this.transactions().length === 0 ? 0 : from;
  }
  txShowingTo(): number {
    return Math.min(this.transactions().length, this.txPage() * this.txPageSize());
  }
  txTotalRecords(): number {
    return this.transactions().length;
  }

  // Commissions pagination controls
  commPreviousPage(): void {
    if (this.commPage() > 1) this.commPage.update((p) => p - 1);
  }
  commNextPage(): void {
    if (this.commPage() < this.commTotalPages()) this.commPage.update((p) => p + 1);
  }
  commShowingFrom(): number {
    const from = (this.commPage() - 1) * this.commPageSize() + 1;
    return this.allCommissions().length === 0 ? 0 : from;
  }
  commShowingTo(): number {
    return Math.min(this.allCommissions().length, this.commPage() * this.commPageSize());
  }
  commTotalRecords(): number {
    return this.allCommissions().length;
  }

  isCredit(transaction: DashboardTransaction): boolean {
    return transaction.type === 'Credit';
  }

  isActiveTab(tab: TransactionTab): boolean {
    return this.activeTab() === tab;
  }

  getTransactionCategoryLabel(tx: DashboardTransaction): string {
    return this.formatTransactionCategory(tx);
  }

  formatTransactionCategory(tx: DashboardTransaction): string {
    const categoryCode = tx.category?.trim().toUpperCase();
    if (categoryCode) {
      const known = TransactionsComponent.CATEGORY_LABELS[categoryCode];
      if (known) {
        return known;
      }
      return this.formatSnakeCaseLabel(categoryCode);
    }

    const group = tx.categoryGroup?.trim();
    if (group) {
      return this.formatSnakeCaseLabel(group);
    }

    const source = tx.source?.trim();
    if (source) {
      return this.formatSnakeCaseLabel(source);
    }

    return this.getTabLabel(this.resolveTransactionTab(tx));
  }

  private static readonly CATEGORY_LABELS: Record<string, string> = {
    REGISTRATION_WALLET_FUNDING: 'Registration wallet funding',
    WALLET_FUNDING: 'Cash wallet funding',
    REFERRAL_CREATION: 'Referral creation',
    TRANSFER: 'Wallet transfer',
    ACTIVATION_IPV: 'Product voucher credit',
    REGISTRATION_ACTIVATION: 'Registration activation',
    PRODUCT_PURCHASE: 'Product purchase',
    ADMIN_FUNDING: 'Admin wallet funding',
    AUTOSHIP_TO_PV: 'Autoship to PV',
    AUTOSHIP_ADMIN_FEE: 'Autoship admin fee',
  };

  private formatSnakeCaseLabel(value: string): string {
    return value
      .split(/[_\s-]+/)
      .filter(Boolean)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
      .join(' ');
  }

  private matchesTabFilter(tx: DashboardTransaction, tab: TransactionTab): boolean {
    if (tab === 'wallet') {
      return (tx.categoryGroup ?? '').toUpperCase() === 'WALLET';
    }
    if (tab === 'voucher') {
      return this.isVoucherTransaction(tx);
    }
    return this.resolveTransactionTab(tx) === tab;
  }

  getTabDescription(): string {
    const tab = this.activeTab();
    if (tab === 'earnings') {
      return 'Track commissions and bonus drops from registration, product, and voucher activity.';
    }
    if (tab === 'wallet') {
      return 'Monitor wallet funding, transfers, and wallet adjustments.';
    }
    if (tab === 'withdrawals') {
      return 'Review withdrawal requests, approvals, and settlement progress.';
    }
    if (tab === 'payments') {
      return 'Inspect payment charges and processor-related transaction logs.';
    }
    if (tab === 'autoship') {
      return 'Track autoship subscriptions, renewals, and recurring product orders.';
    }
    if (tab === 'voucher') {
      return 'Track product voucher credits, purchases, transfers, and wallet activity.';
    }
    return 'View and filter all your financial activities across earnings, wallet, withdrawals, payments, and vouchers.';
  }

  getTabLabel(tab: TransactionTab): string {
    return this.tabOptions.find((option) => option.value === tab)?.label ?? 'All';
  }

  formatEarningType(type: string | undefined): string {
    if (!type) return '—';
    const normalized = type.toUpperCase().trim();
    const labels: Record<string, string> = {
      MERCHANT_PERSONAL_PRODUCT: 'Merchant product purchase commission',
      MERCHANT_DIRECT_REFERRAL_PRODUCT: 'Merchant direct referral product commission',
      MERCHANT_COMMUNITY_PRODUCT: 'Merchant community product commission',
      MERCHANT_DELIVERY_BONUS: 'Merchant delivery commission',
      PERSONAL_PRODUCT_PURCHASE: 'Personal product purchase commission',
      DIRECT_REFERRAL_PRODUCT_PURCHASE: 'Direct referral product purchase commission',
      COMMUNITY_PRODUCT_PURCHASE: 'Community product purchase commission',
    };
    if (labels[normalized]) {
      return labels[normalized];
    }
    return type
      .toLowerCase()
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  formatSummaryAmount(amount: number): string {
    const symbol = this.detectDisplayCurrencySymbol();
    const absAmount = Math.abs(amount);
    const formatted = new Intl.NumberFormat('en-NG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(absAmount);

    if (amount === 0) {
      return `${symbol}${formatted}`;
    }

    const sign = amount > 0 ? '+' : '-';
    return `${sign}${symbol}${formatted}`;
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

  /**
   * Whether a transaction row should show the receipt/invoice button.
   * Only rows with a linked payment ID have receipts.
   */
  hasReceipt(tx: DashboardTransaction): boolean {
    return !!tx.paymentId;
  }

  /** Open the invoice modal for a transaction. */
  onViewReceipt(tx: DashboardTransaction): void {
    if (!tx.paymentId) return;
    this.invoiceService.openInvoice(tx.paymentId);
  }

  getTransactionStatusClass(status: TransactionStatus): string {
    if (status === 'Completed') return 'text-mlm-green-700 bg-mlm-green-50 border-mlm-green-200';
    if (status === 'Pending') return 'text-mlm-warning bg-mlm-warning/10 border-mlm-warning/30';
    return 'text-mlm-red-600 bg-mlm-red-50 border-mlm-red-200';
  }

  private loadInitialTransactions(): void {
    if (this.activeTab() === 'breakdown') {
      return;
    }
    this.isLoading.set(true);
    this.dashboardService.getTransactions(this.txPageSize(), undefined, this.getTabQuery()).subscribe({
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

  private resetAndLoadTransactions(): void {
    this.allTransactions.set([]);
    this.nextCursor.set(null);
    this.loadInitialTransactions();
  }

  private getTabQuery(): DashboardTransactionsQuery {
    const tab = this.activeTab();
    if (tab === 'all' || tab === 'breakdown') {
      return {};
    }
    if (tab === 'voucher') {
      return { walletType: 'voucher' };
    }
    return { category: tab };
  }

  private resolveTransactionTab(tx: DashboardTransaction): TransactionTab {
    if (this.isVoucherTransaction(tx)) {
      return 'voucher';
    }

    const normalized = `${tx.categoryGroup ?? ''} ${tx.source ?? ''} ${tx.subType ?? ''} ${tx.description ?? ''}`.toLowerCase();

    if (this.matchesKeywords(normalized, ['withdrawal', 'cashout', 'payout'])) {
      return 'withdrawals';
    }

    if (this.matchesKeywords(normalized, ['autoship', 'auto-ship', 'auto ship', 'subscription', 'recurring'])) {
      return 'autoship';
    }

    if (this.matchesKeywords(normalized, ['wallet', 'funding', 'top up', 'topup', 'transfer'])) {
      return 'wallet';
    }

    if (this.matchesKeywords(normalized, ['payment', 'charge', 'processor', 'gateway', 'bank transfer'])) {
      return 'payments';
    }

    if (
      this.matchesKeywords(normalized, [
        'earning',
        'commission',
        'bonus',
        'referral',
        'registration',
        'product',
        'pv',
      ])
    ) {
      return 'earnings';
    }

    return 'all';
  }

  private isVoucherTransaction(tx: DashboardTransaction): boolean {
    const walletType = `${tx.walletType ?? tx.metadata?.['walletType'] ?? tx.metadata?.['wallet_type'] ?? ''}`.toUpperCase();
    if (walletType === 'VOUCHER') {
      return true;
    }

    const categoryCode = `${tx.category ?? ''}`.toUpperCase();
    if (categoryCode.includes('VOUCHER') || categoryCode === 'ACTIVATION_IPV') {
      return true;
    }

    const normalized = `${tx.categoryGroup ?? ''} ${tx.source ?? ''} ${tx.subType ?? ''} ${tx.description ?? ''}`.toLowerCase();
    return this.matchesKeywords(normalized, [
      'product voucher',
      'voucher wallet',
      'activation_ipv',
      'voucher',
    ]);
  }

  private matchesKeywords(value: string, keywords: string[]): boolean {
    return keywords.some((keyword) => value.includes(keyword));
  }

  private detectDisplayCurrencySymbol(): '$' | '₦' {
    const [first] = this.transactions();
    if (!first) {
      return '₦';
    }
    return first.currency === 'USD' ? '$' : '₦';
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

