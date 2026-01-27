import { Component, inject, signal, computed, ViewChild, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TableModule, Table } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { 
  TransactionService, 
  Transaction, 
  TransactionType, 
  WalletType, 
  TransactionStatus,
  DateRangePreset,
  SortField,
  SortOrder
} from '../../services/transaction.service';
import { StatusBadgeComponent } from '../../components/status-badge/status-badge.component';
import { TransactionDetailComponent } from './components/transaction-detail.component';

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    SkeletonModule,
    DatePipe,
    DecimalPipe,
    StatusBadgeComponent
  ],
  providers: [DialogService],
  templateUrl: './transactions.component.html',
  styles: [`
    :host ::ng-deep .p-datatable .p-datatable-thead > tr > th {
      padding: 1rem 1.5rem;
      background-color: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
    }
    
    :host ::ng-deep .p-datatable .p-datatable-tbody > tr > td {
      padding: 1rem 1.5rem;
      border-bottom: 1px solid #f3f4f6;
    }
    
    :host ::ng-deep .p-datatable .p-datatable-tbody > tr:hover {
      background-color: #f9fafb;
      transition: background-color 0.2s ease;
      cursor: pointer;
    }

    :host ::ng-deep .transaction-detail-dialog {
      .p-dialog {
        border-radius: 1.5rem;
        overflow: hidden;
      }
      .p-dialog-header {
        padding: 1.25rem 1.5rem;
        border-bottom: 1px solid #f1f5f9;
      }
      .p-dialog-title {
        font-size: 1.125rem;
        font-weight: 700;
        color: #000;
      }
      .p-dialog-content {
        padding: 0 !important;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TransactionsComponent implements OnInit {
  @ViewChild('dt') table!: Table;

  private transactionService = inject(TransactionService);
  private dialogService = inject(DialogService);
  private route = inject(ActivatedRoute);
  private dialogRef: DynamicDialogRef | null = null;

  // Signals from service
  transactions = this.transactionService.filteredTransactions;
  filters = this.transactionService.filters;
  isLoading = this.transactionService.isLoading;
  transactionCount = this.transactionService.transactionCount;
  totalTransactionCount = this.transactionService.totalTransactionCount;

  // Local state
  searchInput = signal('');
  skeletonRows = Array(8).fill({});

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
    { label: 'Earnings', value: 'Earnings' as TransactionType },
    { label: 'Withdrawal', value: 'Withdrawal' as TransactionType },
    { label: 'Payment', value: 'Payment' as TransactionType }
  ];

  walletOptions = [
    { label: 'All Wallets', value: 'all' },
    { label: 'Cash', value: 'cash' as WalletType },
    { label: 'Voucher', value: 'voucher' as WalletType },
    { label: 'Autoship', value: 'autoship' as WalletType }
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
           f.wallet !== 'all' || 
           f.status !== 'all' || 
           (f.searchQuery && f.searchQuery.length > 0);
  });

  ngOnInit(): void {
    // Load transactions
    this.transactionService.loadTransactions().subscribe();

    // Handle query params (e.g., ?wallet=cash from Wallet page)
    this.route.queryParams.subscribe(params => {
      if (params['wallet']) {
        const wallet = params['wallet'] as WalletType;
        if (['cash', 'voucher', 'autoship'].includes(wallet)) {
          this.transactionService.setFilter('wallet', wallet);
        }
      }
    });
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchInput.set(value);
    this.transactionService.setFilter('searchQuery', value);
  }

  onDateRangeChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as DateRangePreset;
    this.transactionService.setFilter('dateRange', value);
  }

  onTypeChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.transactionService.setFilter('type', value as TransactionType | 'all');
  }

  onWalletChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.transactionService.setFilter('wallet', value as WalletType | 'all');
  }

  onStatusChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.transactionService.setFilter('status', value as TransactionStatus | 'all');
  }

  onClearFilters(): void {
    this.searchInput.set('');
    this.transactionService.clearFilters();
  }

  onRowClick(transaction: Transaction): void {
    this.dialogRef = this.dialogService.open(TransactionDetailComponent, {
      data: { transaction },
      header: 'Transaction Details',
      width: '90vw',
      style: { 'max-width': '600px' },
      contentStyle: { 'padding': '0' },
      baseZIndex: 10000,
      dismissableMask: true,
      closable: true,
      closeOnEscape: true,
      styleClass: 'transaction-detail-dialog'
    });
  }

  exportCSV(): void {
    this.table.exportCSV();
  }

  getTypeIcon(type: TransactionType): string {
    switch (type) {
      case 'Earnings': return 'pi pi-arrow-down-left text-mlm-success';
      case 'Withdrawal': return 'pi pi-arrow-up-right text-mlm-error';
      case 'Payment': return 'pi pi-shopping-cart text-mlm-warning';
      default: return 'pi pi-circle';
    }
  }

  getAmountClass(transaction: Transaction): string {
    // Earnings are credits (+), Withdrawal and Payment are debits (-)
    return transaction.type === 'Earnings' ? 'text-mlm-success' : 'text-mlm-error';
  }

  getAmountPrefix(transaction: Transaction): string {
    return transaction.type === 'Earnings' ? '+' : '-';
  }

  getWalletBadgeClass(wallet: WalletType): string {
    switch (wallet) {
      case 'cash': return 'bg-green-50 text-green-600';
      case 'voucher': return 'bg-blue-50 text-blue-600';
      case 'autoship': return 'bg-purple-50 text-purple-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  }

  formatCurrency(amount: number): string {
    return `₦${amount.toLocaleString('en-US')}`;
  }
}

