import { Component, computed, inject, ChangeDetectionStrategy, ChangeDetectorRef, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { BadgeModule } from 'primeng/badge';
import { MessageModule } from 'primeng/message';
import { ProgressBarModule } from 'primeng/progressbar';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { UserService } from '../../services/user.service';
import { PaymentService } from '../../services/payment.service';
import { CommissionService } from '../../services/commission.service';
import { EarningsService } from '../../services/earnings.service';
import { WalletService } from '../../services/wallet.service';
import { LoadingService } from '../../services/loading.service';
import { ModalService } from '../../services/modal.service';
import { ActivityService } from '../../services/activity.service';
import { OverlayOptions } from 'primeng/api';
import { signal } from '@angular/core';

@Component({
  selector: 'app-dashboard',
  imports: [
    CommonModule,
    CardModule,
    ButtonModule,
    BadgeModule,
    MessageModule,
    ProgressBarModule,
    DialogModule,
    ReactiveFormsModule,
    SelectModule,
    InputTextModule
  ],
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent implements OnInit {
  private router = inject(Router);
  private userService = inject(UserService);
  private paymentService = inject(PaymentService);
  private commissionService = inject(CommissionService);
  private earningsService = inject(EarningsService);
  private walletService = inject(WalletService);
  private loadingService = inject(LoadingService);
  private modalService = inject(ModalService);
  private activityService = inject(ActivityService);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);

  isPaid = this.userService.isPaid;
  currentUser = this.userService.currentUser;
  paymentStatus = this.userService.paymentStatus;
  displayCurrency = this.userService.displayCurrency;

  ngnSummary = this.commissionService.getSummary('NGN');
  usdSummary = this.commissionService.getSummary('USD');

  ngnWallet = this.walletService.getWallet('NGN');
  usdWallet = this.walletService.getWallet('USD');

  activeWallet = computed(() => {
    const currency = this.displayCurrency();
    return this.walletService.getWallet(currency)();
  });

  activeSummary = computed(() => {
    const currency = this.displayCurrency();
    return this.commissionService.getSummary(currency)();
  });

  earningsBreakdown = computed(() => {
    const summary = this.activeSummary();
    const total = summary.totalEarnings || 1;
    return [
      { label: 'Direct Referral', value: summary.directReferralBonus, color: '#49A321', pct: Math.round((summary.directReferralBonus / total) * 100) },
      { label: 'Community Bonus', value: summary.communityBonus, color: '#64748b', pct: Math.round((summary.communityBonus / total) * 100) },
      { label: 'Product Bonus', value: summary.productBonus, color: '#57534e', pct: Math.round((summary.productBonus / total) * 100) },
      { label: 'Matching Bonus', value: summary.matchingBonus, color: '#49A321', pct: Math.round((summary.matchingBonus / total) * 100) },
    ];
  });

  recentActivities = this.activityService.getRecentActivities(5);

  salesData: any;
  salesOptions: any;
  trafficData: any;
  trafficOptions: any;

  /** Bar chart (last 7 months) and entrance animation */
  barsAnimated = false;
  cardsVisible = [false, false, false, false];

  get salesMonths(): string[] {
    return this.salesData?.labels?.slice(-7) ?? [];
  }

  get salesValues(): number[] {
    const d = this.salesData?.datasets?.[0]?.data;
    return Array.isArray(d) ? d.slice(-7) : [];
  }

  get barItems(): { value: number; label: string; isLast: boolean }[] {
    return this.salesValues.map((v, i) => ({
      value: v,
      label: this.salesMonths[i] ?? '',
      isLast: i === this.salesValues.length - 1,
    }));
  }

  get statCardsData(): { label: string; value: string; icon: string; gradient: string }[] {
    const summary = this.activeSummary();
    const wallet = this.activeWallet();
    const ngn = this.ngnWallet();
    const usd = this.usdWallet();
    const cash = wallet?.cashBalance ?? 0;
    const sym = this.displayCurrency() === 'NGN' ? '₦' : '$';
    const symNgn = '₦';
    const symUsd = '$';
    const fmt = (n: number) => new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(n);
    const bgPrimary = 'linear-gradient(180deg,#49A321 0%,#3d8a1c 100%)';
    const bgMuted = 'linear-gradient(180deg,#64748b 0%,#475569 100%)';
    return [
      { label: 'Wallet Balance', value: sym + fmt(cash), icon: 'pi-wallet', gradient: bgPrimary },
      { label: 'Total Referrals', value: String(summary.directReferrals ?? 0), icon: 'pi-users', gradient: bgMuted },
      { label: 'Total Commissions', value: symNgn + fmt(summary.totalEarnings ?? 0), icon: 'pi-money-bill', gradient: bgPrimary },
      { label: 'Orders', value: '0', icon: 'pi-shopping-bag', gradient: bgMuted },
    ];
  }

  getBarHeight(val: number): string {
    const vals = this.salesValues;
    if (vals.length === 0) return '0%';
    const max = Math.max(...vals);
    return this.barsAnimated ? `${(val / max) * 100}%` : '0%';
  }

  getBarBackground(i: number, isLast: boolean): string {
    return isLast ? '#49A321' : '#e7e5e4';
  }

  getBarBorder(_i: number, isLast: boolean): string {
    return isLast ? 'none' : '1px solid var(--color-mlm-warm-200)';
  }

  getBarDelay(i: number): string {
    return `${i * 60}ms`;
  }

  get sparklinePoints(): string {
    const vals = this.salesValues;
    if (vals.length === 0) return '';
    const max = Math.max(...vals);
    const min = Math.min(...vals);
    const W = 200;
    const H = 48;
    return vals
      .map((v, i) => `${(i / (vals.length - 1)) * W},${H - ((v - min) / (max - min || 1)) * H * 0.8 - H * 0.1}`)
      .join(' ');
  }

  get sparklineArea(): string {
    const vals = this.salesValues;
    if (vals.length === 0) return '';
    const max = Math.max(...vals);
    const min = Math.min(...vals);
    const W = 200;
    const H = 48;
    const pts = vals
      .map((v, i) => `${(i / (vals.length - 1)) * W},${H - ((v - min) / (max - min || 1)) * H * 0.8 - H * 0.1}`)
      .join(' ');
    return `0,${H} ${pts} ${W},${H}`;
  }

  activityBadge(activity: { amount?: number; currency?: string; type: string }): string {
    if (activity.amount == null) return '';
    const sym = activity.currency === 'USD' ? '$' : '₦';
    const n = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(Math.abs(activity.amount));
    return activity.type === 'Withdrawal' ? `-${sym}${n}` : `+${sym}${n}`;
  }

  isPositiveActivityBadge(activity: { type: string }): boolean {
    return activity.type !== 'Withdrawal';
  }

  showPaymentModal = signal(false);
  
  paymentMethods = [
    { label: 'Credit Card', value: 'credit_card' },
    { label: 'Debit Card', value: 'debit_card' },
    { label: 'Bank Transfer', value: 'bank_transfer' },
    { label: 'Mobile Money', value: 'mobile_money' }
  ];

  paymentForm = this.fb.group({
    paymentMethod: ['', [Validators.required]],
    amount: [{ value: 5000, disabled: true }]
  });

  /** Prevents payment select dropdown from closing when dialog/content scrolls */
  paymentOverlayOptions: OverlayOptions = {
    listener: (_event: Event, options?: { type?: string; valid?: boolean }) => {
      if (options?.type === 'scroll') return false;
      return options?.valid;
    }
  };

  constructor() {
    // Effect to watch payment status changes and trigger change detection
    effect(() => {
      // Access the signal to create a dependency
      this.isPaid();
      this.paymentStatus();
      // Mark for check when payment status changes
      this.cdr.markForCheck();
    });
  }

  ngOnInit(): void {
    // Open payment modal when navigating to /dashboard/registration-payment
    if (this.router.url.includes('registration-payment') && this.paymentStatus() === 'UNPAID') {
      this.showPaymentModal.set(true);
    }

    // Fetch wallets and earnings when user is paid (for balance/earnings display)
    if (this.isPaid()) {
      this.walletService.fetchWallets().subscribe({
        next: () => this.cdr.markForCheck(),
        error: () => {
          this.cdr.markForCheck();
          this.modalService.open(
            'error',
            'Wallet Fetch Failed',
            'Could not load wallet balances. Please refresh the page or contact support if the problem persists.'
          );
        }
      });
      this.earningsService.fetchEarningsSectionData();
    }

    // Listen to navigation events to detect when returning to dashboard
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: unknown) => {
        const navEvent = event as NavigationEnd;
        // Mark for check when navigating to dashboard to ensure signal updates are detected
        if (navEvent.urlAfterRedirects === '/dashboard' || navEvent.urlAfterRedirects.startsWith('/dashboard')) {
          this.cdr.markForCheck();
        }
        // Open payment modal when navigating to /dashboard/registration-payment
        if (navEvent.urlAfterRedirects.includes('registration-payment') && this.paymentStatus() === 'UNPAID') {
          this.showPaymentModal.set(true);
        }
      });

    // Also mark for check on component init
    this.cdr.markForCheck();

    this.initCharts();

    // Entrance animation for stat cards and bar chart
    setTimeout(() => { this.barsAnimated = true; this.cdr.markForCheck(); }, 400);
    [0, 80, 160, 240].forEach((delay, i) => {
      setTimeout(() => { this.cardsVisible[i] = true; this.cdr.markForCheck(); }, delay + 100);
    });
  }

  private initCharts() {
    const documentStyle = getComputedStyle(document.documentElement);
    const textColor = documentStyle.getPropertyValue('--mlm-text') || '#000000';
    const textColorSecondary = documentStyle.getPropertyValue('--mlm-secondary') || '#64748b';
    const surfaceBorder = '#f1f5f9';

    // Sales Overview (Line Chart)
    this.salesData = {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      datasets: [
        {
          label: 'Revenue',
          data: [15000, 22000, 18000, 25000, 28000, 35000, 32000, 40000, 45000, 42000, 48000, 55000],
          fill: true,
          borderColor: '#49A321',
          tension: 0.4,
          backgroundColor: 'rgba(73, 163, 33, 0.1)'
        },
        {
          label: 'Sales',
          data: [10000, 15000, 12000, 18000, 20000, 25000, 23000, 28000, 32000, 30000, 35000, 40000],
          fill: false,
          borderColor: '#3b82f6',
          tension: 0.4
        }
      ]
    };

    this.salesOptions = {
      maintainAspectRatio: false,
      aspectRatio: 0.6,
      plugins: {
        legend: {
          labels: {
            color: textColor,
            usePointStyle: true,
            font: { weight: 'bold', size: 11 }
          },
          position: 'bottom'
        }
      },
      scales: {
        x: {
          ticks: { color: textColorSecondary, font: { size: 10 } },
          grid: { color: surfaceBorder, drawBorder: false }
        },
        y: {
          ticks: { color: textColorSecondary, font: { size: 10 } },
          grid: { color: surfaceBorder, drawBorder: false }
        }
      }
    };

    // Traffic Sources (Doughnut)
    this.trafficData = {
      labels: ['Direct', 'Social', 'Referral'],
      datasets: [
        {
          data: [540, 325, 702],
          backgroundColor: ['#49A321', '#3b82f6', '#f59e0b'],
          hoverBackgroundColor: ['#3e8a1c', '#2563eb', '#d97706'],
          borderWidth: 0
        }
      ]
    };

    this.trafficOptions = {
      cutout: '70%',
      plugins: {
        legend: {
          labels: {
            color: textColor,
            usePointStyle: true,
            font: { weight: 'bold', size: 11 }
          },
          position: 'bottom'
        }
      }
    };
  }

  profileCompletion = computed(() => {
    const user = this.currentUser();
    return user?.profileCompletionPercentage ?? 0;
  });

  isLoading = this.loadingService.isLoading;

  navigateToPayment(): void {
    this.showPaymentModal.set(true);
  }

  onPaymentSubmit(): void {
    if (this.paymentForm.valid) {
      this.loadingService.show();
      const user = this.currentUser();
      const packageName = user?.package ?? 'SILVER';
      const currency = user?.currency ?? 'NGN';
      const callbackUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/auth/payment/callback`
        : undefined;

      this.paymentService.initiateRegistrationPayment(packageName, currency, callbackUrl).subscribe({
        next: (res) => {
          this.loadingService.hide();
          this.showPaymentModal.set(false);
          this.cdr.markForCheck();
          const gatewayUrl = res.authorizationUrl ?? res.gatewayUrl;
          if (gatewayUrl) {
            window.location.href = gatewayUrl;
          } else if (res.reference) {
            this.router.navigate(['/auth/register/payment-pending'], {
              queryParams: { reference: res.reference },
              state: { reference: res.reference }
            });
          } else {
            this.modalService.open(
              'error',
              'Payment Initiation Failed',
              'No payment link was returned. Please try again or contact support.'
            );
          }
        },
        error: () => {
          this.loadingService.hide();
          this.cdr.markForCheck();
          this.modalService.open(
            'error',
            'Payment Failed',
            'Could not initiate payment. Please try again or contact support if the problem persists.'
          );
        }
      });
    } else {
      this.paymentForm.markAllAsTouched();
    }
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }

  getRankStyle(rank: string | undefined): { bgClass: string; icon: string } {
    if (!rank) {
      return { bgClass: 'bg-mlm-secondary', icon: 'pi-star' };
    }
    
    const rankLower = rank.toLowerCase();
    
    switch (rankLower) {
      case 'silver':
        return { bgClass: 'bg-gradient-to-r from-mlm-secondary to-mlm-secondary/80', icon: 'pi-star' };
      case 'gold':
        return { bgClass: 'bg-gradient-to-r from-brand-gold to-mlm-warning', icon: 'pi-star-fill' };
      case 'platinum':
        return { bgClass: 'bg-gradient-to-r from-mlm-secondary/60 to-mlm-secondary', icon: 'pi-star-fill' };
      case 'ruby':
        return { bgClass: 'bg-gradient-to-r from-mlm-red-500 to-mlm-red-400', icon: 'pi-star-fill' };
      case 'diamond':
        return { bgClass: 'bg-gradient-to-r from-mlm-blue-400 to-mlm-blue-500', icon: 'pi-gem' };
      default:
        return { bgClass: 'bg-gradient-to-r from-brand-gold to-mlm-warning', icon: 'pi-star-fill' };
    }
  }

  formatActivityDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  navigateToActivity(activity: any): void {
    if (activity.route) {
      this.router.navigate([activity.route]);
    }
  }

  getActivityIconClasses(type: string): string {
    switch (type) {
      case 'Earnings Posted':
        return 'bg-mlm-warning/10 text-mlm-warning';
      case 'Wallet Funding':
        return 'bg-mlm-success/10 text-mlm-success';
      case 'Withdrawal':
        return 'bg-mlm-error/10 text-mlm-error';
      case 'Order Placed':
        return 'bg-mlm-blue-50 text-mlm-blue-500';
      default:
        return 'bg-mlm-secondary/10 text-mlm-secondary';
    }
  }

  getActivityBg(type: string): string {
    const map: Record<string, string> = {
      'Earnings Posted': '#f0fdf4',
      'Wallet Funding': '#f0fdf4',
      'Withdrawal': '#fef2f2',
      'Order Placed': '#f5f5f4',
    };
    return map[type] ?? '#f5f5f4';
  }

  getActivityBorder(type: string): string {
    const map: Record<string, string> = {
      'Earnings Posted': '#bbf7d0',
      'Wallet Funding': '#bbf7d0',
      'Withdrawal': '#fecaca',
      'Order Placed': '#e7e5e4',
    };
    return map[type] ?? '#e7e5e4';
  }

  getStatusBadgeClasses(status: string): string {
    switch (status) {
      case 'Approved':
      case 'Completed':
        return 'bg-mlm-success/10 text-mlm-success';
      case 'Pending':
        return 'bg-mlm-warning/10 text-mlm-warning';
      case 'Rejected':
        return 'bg-mlm-error/10 text-mlm-error';
      default:
        return 'bg-mlm-secondary/10 text-mlm-secondary';
    }
  }
}

