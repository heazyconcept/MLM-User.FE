import { Component, ChangeDetectionStrategy, inject, OnInit, signal, computed } from '@angular/core';

import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { DialogService } from 'primeng/dynamicdialog';
import { UserService } from '../../services/user.service';
import { WalletService, Wallet } from '../../services/wallet.service';
import { SettingsService } from '../../services/settings.service';
import { WithdrawalComponent } from './withdrawal/withdrawal.component';
import { MessageService } from 'primeng/api';
import {
  CASHOUT_SPLIT, AUTOSHIP_SPLIT,
  MONTHLY_AUTOSHIP_USD, AUTOSHIP_ADMIN_FEE_USD, NGN_TO_USD_RATE
} from '../../core/constants/registration.constants';

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
  private settingsService = inject(SettingsService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private dialogService = inject(DialogService);
  private messageService = inject(MessageService);

  isPaid = this.userService.isPaid;
  wallets = this.walletService.allWallets;
  totalBalance = this.walletService.totalBalance;
  totalCashBalance = this.walletService.totalCashBalance;
  totalVoucherBalance = this.walletService.totalVoucherBalance;
  totalAutoshipBalance = this.walletService.totalAutoshipBalance;
  totalRegistrationBalance = this.walletService.totalRegistrationBalance;
  isLoading = signal(false);
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
      autoshipBalance: 0,
      registrationBalance: 0
    }];
  });

  ngOnInit() {
    if (this.isPaid()) {
      this.isLoading.set(true);
      this.settingsService.fetchCommissionRules().subscribe();
      this.walletService.fetchWallets().subscribe({
        next: () => this.isLoading.set(false),
        error: () => this.isLoading.set(false)
      });

      // Show success toast if redirected from wallet funding
      const funded = this.route.snapshot.queryParamMap.get('funded');
      if (funded === 'true') {
        this.messageService.add({
          severity: 'success',
          summary: 'Wallet Funded',
          detail: 'Your wallet has been credited successfully.',
          life: 4000
        });
        // Remove the query param without reloading
        this.router.navigate([], { queryParams: {}, replaceUrl: true });
      }
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

  /** Returns "--" when amount is 0 or undefined; otherwise formatted currency */
  formatAmountOrPlaceholder(amount: number | undefined | null, currency: 'NGN' | 'USD' = 'USD'): string {
    if (amount == null || amount === 0) return '--';
    return this.formatCurrency(amount, currency);
  }

  /** User's display currency for sidebar totals (from preferences, fallback to registration) */
  displayCurrency = this.userService.displayCurrency;

  earningsSplit = computed(() => {
    const pkg = this.userService.currentUser()?.package ?? 'NICKEL';
    const rules = this.settingsService.commissionRules();
    const apiCashout = rules?.cashoutSplit?.[pkg];
    const apiAutoship = rules?.autoshipSplit?.[pkg];
    return {
      cashPct: apiCashout ?? 0,
      autoshipPct: apiAutoship ?? 0
    };
  });

  monthlyAutoship = computed(() => {
    const pkg = this.userService.currentUser()?.package ?? 'NICKEL';
    const currency = this.userService.currentUser()?.currency ?? 'NGN';
    const usd = MONTHLY_AUTOSHIP_USD[pkg] ?? 10;
    const adminUsd = AUTOSHIP_ADMIN_FEE_USD[pkg] ?? 1;
    const sym = currency === 'NGN' ? '₦' : '$';
    const rate = currency === 'NGN' ? NGN_TO_USD_RATE : 1;
    const fmt = (v: number) => `${sym}${(v * rate).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    return {
      amount: fmt(usd),
      amountUsd: `$${usd}`,
      adminFee: fmt(adminUsd),
      adminFeeUsd: `$${adminUsd}`,
      currency
    };
  });

  toggleBalanceVisibility() {
    this.isBalanceHidden.update(v => !v);
  }

  getHiddenBalance(): string {
    return '••••••••';
  }
}
