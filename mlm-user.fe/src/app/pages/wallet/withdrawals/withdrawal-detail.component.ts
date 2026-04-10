import { Component, inject, signal, computed, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { WalletService, WithdrawalRequest } from '../../../services/wallet.service';
import { UserService } from '../../../services/user.service';
import { StatusBadgeComponent } from '../../../components/status-badge/status-badge.component';

@Component({
  selector: 'app-withdrawal-detail',
  standalone: true,
  imports: [CommonModule, DecimalPipe, DatePipe, RouterModule, StatusBadgeComponent],
  templateUrl: './withdrawal-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block bg-gray-50 min-h-screen'
  }
})
export class WithdrawalDetailComponent implements OnInit {
  private walletService = inject(WalletService);
  private userService = inject(UserService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  withdrawal = signal<WithdrawalRequest | null>(null);
  isLoading = signal(true);
  error = signal<string | null>(null);

  userProfileBank = computed(() => {
    const user = this.userService.currentUser();
    return {
      bankName: user?.bankName ?? '',
      accountNumber: user?.accountNumber ?? '',
      accountName: user?.accountName ?? ''
    };
  });

  bankDisplay = computed(() => {
    const w = this.withdrawal();
    if (!w) return { line1: '—', line2: '—' };
    const profile = this.userProfileBank();
    const bankName = w.bankName || profile.bankName;
    const accountNumber = w.accountNumber || profile.accountNumber;
    const accountName = w.accountName || profile.accountName;
    if (bankName || accountNumber || accountName) {
      return {
        line1: bankName || '—',
        line2: accountNumber && accountName ? `${accountNumber} • ${accountName}` : (accountNumber || accountName || '—')
      };
    }
    return { line1: 'On file', line2: '—' };
  });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/withdrawals']);
      return;
    }
    this.walletService.fetchWithdrawalById(id).subscribe({
      next: (w) => {
        this.withdrawal.set(w);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.error.set(err?.status === 404 ? 'Withdrawal not found.' : 'Failed to load withdrawal.');
      }
    });
  }

  getCurrencySymbol(): string {
    const w = this.withdrawal();
    return w?.currency === 'NGN' ? '₦' : '$';
  }

  backToList() {
    this.router.navigate(['/withdrawals']);
  }
}
