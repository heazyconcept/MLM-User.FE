import {
  Component,
  inject,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  MerchantDashboardActivityType,
  MerchantProfileResponse,
  MerchantService,
} from '../../../services/merchant.service';
import { UserService } from '../../../services/user.service';

@Component({
  selector: 'app-merchant-dashboard',
  imports: [CommonModule, RouterLink],
  templateUrl: './merchant-dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MerchantDashboardComponent implements OnInit {
  private merchantService = inject(MerchantService);
  private userService = inject(UserService);
  private cdr = inject(ChangeDetectorRef);

  profile = this.merchantService.profile;
  isMerchant = this.merchantService.isMerchant;
  merchantStatus = this.merchantService.merchantStatus;
  isActiveMerchant = this.merchantService.isActiveMerchant;
  canUpgradeCategory = this.merchantService.canUpgradeCategory;
  needsPayment = this.merchantService.needsPayment;
  canReapplyAsMerchant = this.merchantService.canReapplyAsMerchant;
  isAwaitingAdminApproval = this.merchantService.isAwaitingAdminApproval;
  dashboardSummary = this.merchantService.dashboardSummary;
  dashboardLoading = this.merchantService.dashboardLoading;
  loading = this.merchantService.loading;
  error = this.merchantService.error;

  displayCurrency = this.userService.displayCurrency;

  barsAnimated = false;
  hasUpgradeOptions = signal(false);

  showUpgradeBanner = computed(
    () => this.canUpgradeCategory() && this.hasUpgradeOptions(),
  );

  summaryCurrency = computed(
    () => this.dashboardSummary()?.currency ?? this.displayCurrency(),
  );

  totalMerchantSales = computed(() => this.dashboardSummary()?.sales.totalSales ?? 0);

  pendingFulfilmentsCount = computed(
    () => this.dashboardSummary()?.orders.pendingFulfillments ?? 0,
  );

  totalProducts = computed(() => this.dashboardSummary()?.inventory.totalProducts ?? 0);

  totalStockQuantity = computed(() => {
    const inventory = this.dashboardSummary()?.inventory;
    if (!inventory) return 0;
    return inventory.totalStockQuantity ?? inventory.totalProducts;
  });

  inventoryByCategory = computed(
    () => this.dashboardSummary()?.inventory.byCategory ?? [],
  );

  lowOrOutCount = computed(() => this.dashboardSummary()?.inventory.lowOrOutCount ?? 0);

  salesChangePct = computed(() => this.dashboardSummary()?.sales.salesChangePct ?? null);

  trendChangePct = computed(
    () => this.dashboardSummary()?.sales.trend.changePctVsPreviousPeriod ?? null,
  );

  barItems = computed(() => {
    const months = this.dashboardSummary()?.sales.monthlyOverview ?? [];
    const slice = months.slice(-7);
    return slice.map((m, i) => ({
      value: m.amount,
      label: m.label,
      isLast: i === slice.length - 1,
    }));
  });

  maxBarValue = computed(() => {
    const items = this.barItems();
    if (items.length === 0) return 0;
    return Math.max(...items.map((b) => b.value));
  });

  trendAmounts = computed(
    () => this.dashboardSummary()?.sales.trend.points.map((p) => p.amount) ?? [],
  );

  sparklinePoints = computed(() => this.buildSparklinePoints(this.trendAmounts()));

  sparklineArea = computed(() => this.buildSparklineArea(this.trendAmounts()));

  private readonly inventoryBreakdownLimit = 3;

  statCardsData = computed(() => {
    const currency = this.summaryCurrency();
    const bgPrimary = 'linear-gradient(180deg,#49A321 0%,#3d8a1c 100%)';
    const bgMuted = 'linear-gradient(180deg,#64748b 0%,#475569 100%)';
    const productCount = this.totalProducts();
    const productLabel = productCount === 1 ? '1 product' : `${productCount} products`;
    const categories = this.inventoryByCategory();
    const visibleCategories = categories.slice(0, this.inventoryBreakdownLimit);
    const hiddenCategoryCount = Math.max(0, categories.length - visibleCategories.length);

    return [
      {
        label: 'Total Merchant Sales',
        value: this.formatCurrency(this.totalMerchantSales(), currency),
        icon: 'pi-shopping-cart',
        gradient: bgPrimary,
      },
      {
        label: 'Pending Fulfillments',
        value: String(this.pendingFulfilmentsCount()),
        icon: 'pi-clock',
        gradient: bgMuted,
      },
      {
        label: 'Inventory Summary',
        value: String(this.totalStockQuantity()),
        subtitle: productLabel,
        breakdown: visibleCategories.map((category) => ({
          label: category.categoryName,
          value: category.totalStockQuantity,
        })),
        breakdownOverflow: hiddenCategoryCount,
        detailLink: '/merchant/inventory',
        icon: 'pi-box',
        gradient: bgMuted,
      },
      {
        label: 'Merchant Earnings',
        value: this.formatCurrency(
          this.dashboardSummary()?.earnings.totalEarnings ?? 0,
          currency,
        ),
        icon: 'pi-money-bill',
        gradient: bgPrimary,
      },
    ];
  });

  earningsBreakdown = computed(() => {
    const e = this.dashboardSummary()?.earnings;
    if (!e) return [];

    const colors = ['#49A321', '#64748b', '#3b82f6', '#f59e0b', '#8b5cf6'];
    const total = e.totalEarnings || 1;

    return Object.entries(e.byType).map(([key, value], i) => ({
      label: this.formatTypeLabel(key),
      value: value,
      color: colors[i % colors.length],
      pct: Math.round((value / total) * 100),
    }));
  });

  recentActivities = computed(() => {
    const items = this.dashboardSummary()?.recentActivity ?? [];
    return items.map((a) => ({
      id: a.id,
      type: this.activityDisplayType(a.type),
      title: a.title,
      description: a.description,
      amount: a.amount,
      currency: a.currency,
      date: a.occurredAt,
      icon: this.activityIcon(a.type),
    }));
  });

  actionableAllocationsCount = computed(
    () => this.dashboardSummary()?.allocations.actionableCount ?? 0,
  );

  totalEarnings = computed(() => this.dashboardSummary()?.earnings.totalEarnings ?? 0);

  ngOnInit(): void {
    const cachedProfile = this.profile();
    if (cachedProfile) {
      this.loadDashboardForProfile(cachedProfile);
      return;
    }

    this.merchantService
      .fetchProfile$()
      .subscribe((profile) => this.loadDashboardForProfile(profile));
  }

  getBarHeight(val: number): string {
    const max = this.maxBarValue();
    if (max === 0) return '0%';
    return this.barsAnimated ? `${(val / max) * 100}%` : '0%';
  }

  getBarBackground(_i: number, isLast: boolean): string {
    return isLast ? '#49A321' : '#e7e5e4';
  }

  getBarBorder(_i: number, isLast: boolean): string {
    return isLast ? 'none' : '1px solid var(--color-mlm-warm-200)';
  }

  getBarDelay(i: number): string {
    return `${i * 60}ms`;
  }

  formatCurrency(amount: number, currency?: string): string {
    return this.merchantService.formatCurrency(amount, currency);
  }

  formatPct(value: number): string {
    return `${Math.abs(value)}%`;
  }

  activityBadge(activity: { amount?: number | null; currency?: string | null; type: string }): string {
    if (activity.amount == null) return '';
    const sym = activity.currency === 'USD' ? '$' : '₦';
    const n = new Intl.NumberFormat('en-NG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(activity.amount));
    return `+${sym}${n}`;
  }

  isPositiveActivityBadge(activity: { type: string }): boolean {
    return activity.type !== 'Stock Dispute';
  }

  formatActivityDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  getActivityBg(type: string): string {
    const map: Record<string, string> = {
      'Earnings Posted': '#f0fdf4',
      'Order Received': '#f5f5f4',
      'Delivery Confirmed': '#f0fdf4',
      'Allocation Delivered': '#f0fdf4',
      'Stock Dispute': '#fef2f2',
    };
    return map[type] ?? '#f5f5f4';
  }

  getActivityBorder(type: string): string {
    const map: Record<string, string> = {
      'Earnings Posted': '#bbf7d0',
      'Order Received': '#e7e5e4',
      'Delivery Confirmed': '#bbf7d0',
      'Allocation Delivered': '#bbf7d0',
      'Stock Dispute': '#fecaca',
    };
    return map[type] ?? '#e7e5e4';
  }

  private runEntranceAnimations(): void {
    setTimeout(() => {
      this.barsAnimated = true;
      this.cdr.markForCheck();
    }, 400);
  }

  private loadDashboardForProfile(profile: MerchantProfileResponse | null): void {
    if (profile?.status === 'ACTIVE') {
      this.merchantService.fetchDashboardSummary$().subscribe(() => {
        this.runEntranceAnimations();
        this.cdr.markForCheck();
      });
      if (this.canUpgradeCategory()) {
        this.merchantService.fetchUpgradeOptions({ silent: true }).subscribe((opts) => {
          this.hasUpgradeOptions.set(!!opts && opts.eligibleUpgrades.length > 0);
          this.cdr.markForCheck();
        });
      }
    } else {
      this.merchantService.clearError();
    }
  }

  private buildSparklinePoints(vals: number[]): string {
    if (vals.length === 0) return '';
    const max = Math.max(...vals);
    const min = Math.min(...vals);
    const W = 200;
    const H = 48;
    const denom = vals.length - 1 || 1;
    return vals
      .map(
        (v, i) =>
          `${(i / denom) * W},${H - ((v - min) / (max - min || 1)) * H * 0.8 - H * 0.1}`,
      )
      .join(' ');
  }

  private buildSparklineArea(vals: number[]): string {
    if (vals.length === 0) return '';
    const max = Math.max(...vals);
    const min = Math.min(...vals);
    const W = 200;
    const H = 48;
    const denom = vals.length - 1 || 1;
    const pts = vals
      .map(
        (v, i) =>
          `${(i / denom) * W},${H - ((v - min) / (max - min || 1)) * H * 0.8 - H * 0.1}`,
      )
      .join(' ');
    return `0,${H} ${pts} ${W},${H}`;
  }

  private formatTypeLabel(key: string): string {
    const labels: Record<string, string> = {
      personalProduct: 'Merchant product purchase commission',
      directReferralProduct: 'Merchant direct referral product commission',
      communityProduct: 'Merchant community product commission',
      deliveryBonus: 'Merchant delivery commission',
      MERCHANT_PERSONAL_PRODUCT: 'Merchant product purchase commission',
      MERCHANT_DIRECT_REFERRAL_PRODUCT: 'Merchant direct referral product commission',
      MERCHANT_COMMUNITY_PRODUCT: 'Merchant community product commission',
      MERCHANT_DELIVERY_BONUS: 'Merchant delivery commission',
    };
    return labels[key] ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
  }

  private activityDisplayType(type: MerchantDashboardActivityType): string {
    switch (type) {
      case 'ORDER_RECEIVED':
        return 'Order Received';
      case 'DELIVERY_CONFIRMED':
        return 'Delivery Confirmed';
      case 'EARNING_CREDITED':
        return 'Earnings Posted';
      case 'ALLOCATION_DELIVERED':
        return 'Allocation Delivered';
      case 'STOCK_DISPUTE_OPENED':
        return 'Stock Dispute';
      default: {
        const _exhaustive: never = type;
        return _exhaustive;
      }
    }
  }

  private activityIcon(type: MerchantDashboardActivityType): string {
    switch (type) {
      case 'ORDER_RECEIVED':
        return 'pi-shopping-bag';
      case 'DELIVERY_CONFIRMED':
        return 'pi-check-circle';
      case 'EARNING_CREDITED':
        return 'pi-money-bill';
      case 'ALLOCATION_DELIVERED':
        return 'pi-inbox';
      case 'STOCK_DISPUTE_OPENED':
        return 'pi-exclamation-triangle';
      default: {
        const _exhaustive: never = type;
        return _exhaustive;
      }
    }
  }
}
