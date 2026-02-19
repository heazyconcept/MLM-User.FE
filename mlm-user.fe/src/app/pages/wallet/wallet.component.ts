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
  
  // Get primary wallet (prefer user's registration currency)
  primaryWallet = computed(() => {
    const w = this.wallets();
    const userCurrency = this.userService.currentUser()?.currency ?? 'NGN';
    return w.find(wallet => wallet.currency === userCurrency) || w[0];
  });

  /** Wallets to display; when empty, returns a placeholder wallet so UI always shows */
  displayWallets = computed(() => {
    const w = this.wallets();
    if (w.length > 0) return w;
    const userCurrency = this.userService.currentUser()?.currency ?? 'NGN';
    return [{
      id: 'placeholder',
      currency: userCurrency as 'NGN' | 'USD',
      balance: 0,
      cashBalance: 0,
      voucherBalance: 0,
      autoshipBalance: 0
    }];
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

  /** Mock rate for secondary currency display only (no real conversion). */
  readonly MOCK_RATE_NGN_PER_USD = 1500;

  formatCurrency(amount: number, currency: 'NGN' | 'USD' = 'USD'): string {
    const symbol = currency === 'NGN' ? '₦' : '$';
    return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  /** Returns "--" when amount is 0 or undefined; otherwise formatted currency */
  formatAmountOrPlaceholder(amount: number | undefined | null, currency: 'NGN' | 'USD' = 'USD'): string {
    if (amount == null || amount === 0) return '--';
    return this.formatCurrency(amount, currency);
  }

  /** User's display currency for sidebar totals (from preferences, fallback to registration) */
  displayCurrency = this.userService.displayCurrency;

  /** Returns mock secondary currency equivalent, e.g. "≈ $1,250.00" or "≈ ₦1,875,000". */
  formatSecondaryEquivalent(amount: number, fromCurrency: 'NGN' | 'USD'): string {
    const toAmount = fromCurrency === 'USD'
      ? amount * this.MOCK_RATE_NGN_PER_USD
      : amount / this.MOCK_RATE_NGN_PER_USD;
    const toCurrency = fromCurrency === 'USD' ? 'NGN' : 'USD';
    const symbol = toCurrency === 'NGN' ? '₦' : '$';
    const formatted = toAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `≈ ${symbol}${formatted}`;
  }

  toggleBalanceVisibility() {
    this.isBalanceHidden.update(v => !v);
  }

  getHiddenBalance(): string {
    return '••••••••';
  }
}
