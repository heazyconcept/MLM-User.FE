import {
  Component,
  inject,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MerchantService } from '../../../services/merchant.service';
import { MerchantStatCardComponent } from '../../../components/merchant-stat-card/merchant-stat-card.component';
import { UserService } from '../../../services/user.service';

@Component({
  selector: 'app-merchant-dashboard',
  imports: [CommonModule, RouterLink, MerchantStatCardComponent],
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
  earnings = this.merchantService.earnings;
  inventory = this.merchantService.inventory;
  inventorySummary = this.merchantService.inventorySummary;
  orders = this.merchantService.orders;
  totalMerchantSales = this.merchantService.totalMerchantSales;
  pendingFulfilmentsCount = this.merchantService.pendingFulfilmentsCount;
  loading = this.merchantService.loading;
  error = this.merchantService.error;

  displayCurrency = this.userService.displayCurrency;

  // Chart Properties
  salesData: any;
  salesOptions: any;
  barsAnimated = false;
  cardsVisible = [false, false, false, false];

  get pendingOrders(): number {
    return this.pendingFulfilmentsCount() ?? 0;
  }

  get unreadAllocations(): number {
    return this.merchantService.allocations()?.filter((a) => a.status === 'PENDING').length ?? 0;
  }

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
    const fmt = (n: number) =>
      new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(n);
    const bgPrimary = 'linear-gradient(180deg,#49A321 0%,#3d8a1c 100%)';
    const bgMuted = 'linear-gradient(180deg,#64748b 0%,#475569 100%)';
    const sym = this.displayCurrency() === 'NGN' ? '₦' : '$';

    return [
      {
        label: 'Total Merchant Sales',
        value: this.formatCurrency(this.totalMerchantSales(), this.earnings()?.currency),
        icon: 'pi-shopping-cart',
        gradient: bgPrimary,
      },
      {
        label: 'Pending Fulfillments',
        value: String(this.pendingFulfilmentsCount() ?? 0),
        icon: 'pi-clock',
        gradient: bgMuted,
      },
      {
        label: 'Inventory Summary',
        value: `${this.inventorySummary().total} (${this.inventorySummary().lowOrOut} low/out)`,
        icon: 'pi-box',
        gradient: bgMuted,
      },
      {
        label: 'Merchant Earnings',
        value: this.formatCurrency(
          this.earnings()?.merchantEarnings?.totalEarnings ?? 0,
          this.earnings()?.currency,
        ),
        icon: 'pi-money-bill',
        gradient: bgPrimary,
      },
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
      .map(
        (v, i) =>
          `${(i / (vals.length - 1)) * W},${H - ((v - min) / (max - min || 1)) * H * 0.8 - H * 0.1}`,
      )
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
      .map(
        (v, i) =>
          `${(i / (vals.length - 1)) * W},${H - ((v - min) / (max - min || 1)) * H * 0.8 - H * 0.1}`,
      )
      .join(' ');
    return `0,${H} ${pts} ${W},${H}`;
  }

  earningsBreakdown = computed(() => {
    // using dummy data for breakdown since merchant API might not have this detailed breakdown
    const e = this.earnings()?.merchantEarnings?.totalEarnings || 0;
    const directSales = e * 0.7;
    const affiliateSales = e * 0.3;
    const total = e > 0 ? e : 1;

    return [
      {
        label: 'Direct Sales',
        value: directSales,
        color: '#49A321',
        pct: Math.round((directSales / total) * 100),
      },
      {
        label: 'Affiliate Sales',
        value: affiliateSales,
        color: '#64748b',
        pct: Math.round((affiliateSales / total) * 100),
      },
    ];
  });

  recentActivities = computed(() => {
    // Dummy recent activities for merchant dashboard
    return [
      {
        id: 1,
        type: 'Order Received',
        title: 'New order received',
        description: 'Order #ORD-8493',
        amount: 45000,
        currency: 'NGN',
        date: new Date().toISOString(),
        icon: 'pi-shopping-bag',
      },
      {
        id: 2,
        type: 'Product Approved',
        title: 'Product approved',
        description: 'Aloe Vera Gel',
        amount: null,
        currency: 'NGN',
        date: new Date(Date.now() - 3600000).toISOString(),
        icon: 'pi-check-circle',
      },
      {
        id: 3,
        type: 'Earnings Posted',
        title: 'Merchant commission',
        description: 'Weekly payout',
        amount: 12500,
        currency: 'NGN',
        date: new Date(Date.now() - 86400000).toISOString(),
        icon: 'pi-money-bill',
      },
    ];
  });

  activityBadge(activity: { amount?: number; currency?: string; type: string }): string {
    if (activity.amount == null) return '';
    const sym = activity.currency === 'USD' ? '$' : '₦';
    const n = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(
      Math.abs(activity.amount),
    );
    return `+${sym}${n}`; // simplified for merchant
  }

  isPositiveActivityBadge(activity: { type: string }): boolean {
    return true; // all merchant money interactions here are positive
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
      'Product Approved': '#f0fdf4',
    };
    return map[type] ?? '#f5f5f4';
  }

  getActivityBorder(type: string): string {
    const map: Record<string, string> = {
      'Earnings Posted': '#bbf7d0',
      'Order Received': '#e7e5e4',
      'Product Approved': '#bbf7d0',
    };
    return map[type] ?? '#e7e5e4';
  }

  ngOnInit(): void {
    this.merchantService.fetchProfile();
    this.merchantService.fetchEarningsSummary();
    this.merchantService.fetchOrders();
    this.merchantService.fetchInventory();
    this.merchantService.fetchAllocations();

    this.initCharts();

    // Entrance animation for stat cards and bar chart
    setTimeout(() => {
      this.barsAnimated = true;
      this.cdr.markForCheck();
    }, 400);
    [0, 80, 160, 240].forEach((delay, i) => {
      setTimeout(() => {
        this.cardsVisible[i] = true;
        this.cdr.markForCheck();
      }, delay + 100);
    });
  }

  private initCharts() {
    // Sales Overview (Line Chart)
    this.salesData = {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      datasets: [
        {
          label: 'Revenue',
          data: [5000, 12000, 18000, 15000, 28000, 35000, 32000, 42000, 45000, 41000, 58000, 65000],
          fill: true,
          borderColor: '#49A321',
          tension: 0.4,
          backgroundColor: 'rgba(73, 163, 33, 0.1)',
        },
      ],
    };
  }

  formatCurrency(amount: number, currency?: string): string {
    return this.merchantService.formatCurrency(amount, currency);
  }
}
