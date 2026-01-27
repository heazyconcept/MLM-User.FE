import { Component, inject, signal, OnInit, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe, LowerCasePipe } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { WalletService, WithdrawalRequest } from '../../../services/wallet.service';
import { UserService } from '../../../services/user.service';
import { StatusBadgeComponent } from '../../../components/status-badge/status-badge.component';

@Component({
  selector: 'app-withdrawal-history',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, DecimalPipe, DatePipe, LowerCasePipe, TableModule, TooltipModule, StatusBadgeComponent],
  templateUrl: './withdrawal-history.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block bg-gray-50 min-h-screen'
  }
})
export class WithdrawalHistoryComponent implements OnInit {
  private walletService = inject(WalletService);
  private userService = inject(UserService);
  private router = inject(Router);
  
  withdrawals = this.walletService.allWithdrawals;
  isLoading = signal(true);

  // Filters
  statusFilter = signal<string | null>(null);
  statusOptions = [
    { label: 'All Status', value: null },
    { label: 'Pending', value: 'Pending' },
    { label: 'Approved', value: 'Approved' },
    { label: 'Rejected', value: 'Rejected' }
  ];

  // Get user's currency
  currency = computed(() => this.userService.currentUser()?.currency || 'NGN');
  
  // Get wallet for user's currency
  wallet = computed(() => {
    const cur = this.currency();
    return this.walletService.getWallet(cur as 'NGN' | 'USD')();
  });

  // Available balance (cash balance only - withdrawable)
  availableBalance = computed(() => this.wallet()?.cashBalance || 0);

  // Filtered withdrawals
  filteredWithdrawals = computed(() => {
    const status = this.statusFilter();
    if (!status) return this.withdrawals();
    return this.withdrawals().filter(w => w.status === status);
  });

  // Pending withdrawals
  pendingWithdrawals = computed(() => {
    return this.withdrawals().filter(w => w.status === 'Pending');
  });

  pendingAmount = computed(() => {
    return this.pendingWithdrawals().reduce((sum, w) => sum + w.amount, 0);
  });

  // Total withdrawn (approved)
  totalWithdrawn = computed(() => {
    return this.withdrawals()
      .filter(w => w.status === 'Approved')
      .reduce((sum, w) => sum + w.amount, 0);
  });

  ngOnInit() {
    this.walletService.fetchWithdrawals().subscribe({
      next: () => this.isLoading.set(false),
      error: () => this.isLoading.set(false)
    });
  }

  requestWithdrawal() {
    this.router.navigate(['/wallet'], { queryParams: { action: 'withdraw' } });
  }

  getCurrencySymbol(): string {
    return this.currency() === 'NGN' ? '₦' : '$';
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'Approved': return 'bg-green-100 text-green-700';
      case 'Pending': return 'bg-amber-100 text-amber-700';
      case 'Rejected': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  }

  onStatusFilterChange(event: any) {
    this.statusFilter.set(event.value);
  }
}
