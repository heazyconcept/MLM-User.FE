import { Component, ChangeDetectionStrategy, inject, OnInit, signal, computed } from '@angular/core';

import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { DialogService } from 'primeng/dynamicdialog';
import { UserService } from '../../services/user.service';
import { WalletService, Wallet } from '../../services/wallet.service';
import { WithdrawalComponent } from './withdrawal/withdrawal.component';

@Component({
  selector: 'app-wallet',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    CardModule,
    ButtonModule,
    MessageModule,
    SkeletonModule,
    TooltipModule
  ],
  templateUrl: './wallet.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WalletComponent implements OnInit {
  private userService = inject(UserService);
  private walletService = inject(WalletService);
  private router = inject(Router);
  private dialogService = inject(DialogService);

  isPaid = this.userService.isPaid;
  wallets = this.walletService.allWallets;
  totalBalance = this.walletService.totalBalance;
  totalCashBalance = this.walletService.totalCashBalance;
  totalVoucherBalance = this.walletService.totalVoucherBalance;
  totalAutoshipBalance = this.walletService.totalAutoshipBalance;
  isLoading = signal(true);
  isBalanceHidden = signal(false);
  
  // Get primary wallet (USD preferred for display)
  primaryWallet = computed(() => {
    const w = this.wallets();
    return w.find(wallet => wallet.currency === 'USD') || w[0];
  });

  // Check if any wallet has zero balance (for empty state)
  hasZeroBalance = computed(() => {
    const w = this.wallets();
    return w.length === 0 || w.every(wallet => wallet.balance === 0);
  });

  ngOnInit() {
    if (this.isPaid()) {
      this.walletService.fetchWallets().subscribe({
        next: () => this.isLoading.set(false),
        error: () => this.isLoading.set(false)
      });
    } else {
      this.isLoading.set(false);
    }
  }

  navigateToPayment() {
    this.router.navigate(['/dashboard/registration-payment']);
  }

  navigateToWithdrawals() {
    this.router.navigate(['/withdrawals']);
  }

  navigateToFunding() {
    this.router.navigate(['/payments/fund']);
  }

  navigateToMarketplace() {
    this.router.navigate(['/marketplace']);
  }

  navigateToTransactions(walletType?: 'cash' | 'voucher' | 'autoship') {
    if (walletType) {
      this.router.navigate(['/transactions'], { queryParams: { wallet: walletType } });
    } else {
      this.router.navigate(['/transactions']);
    }
  }

  openWithdrawDialog(wallet: Wallet) {
    this.dialogService.open(WithdrawalComponent, {
      header: `Withdraw ${wallet.currency} Funds`,
      width: '650px',
      contentStyle: { 'max-height': '750px', overflow: 'auto' },
      baseZIndex: 10000,
      data: {
        currency: wallet.currency
      }
    });
  }

  formatCurrency(amount: number, currency: 'NGN' | 'USD' = 'USD'): string {
    const symbol = currency === 'NGN' ? '₦' : '$';
    return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  toggleBalanceVisibility() {
    this.isBalanceHidden.update(v => !v);
  }

  getHiddenBalance(): string {
    return '••••••••';
  }
}
