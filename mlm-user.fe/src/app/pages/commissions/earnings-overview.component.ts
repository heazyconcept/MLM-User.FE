import { Component, inject, computed, ChangeDetectionStrategy, OnInit, effect } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ChartModule } from 'primeng/chart';
import { SkeletonModule } from 'primeng/skeleton';
import { UserService } from '../../services/user.service';
import { CommissionService } from '../../services/commission.service';
import { EarningsService } from '../../services/earnings.service';
import { EarningsTabsComponent } from './earnings-tabs.component';

@Component({
  selector: 'app-earnings-overview',
  imports: [CommonModule, RouterLink, DecimalPipe, DatePipe, EarningsTabsComponent, ChartModule, SkeletonModule],
  templateUrl: './earnings-overview.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block bg-gray-50 min-h-screen'
  }
})
export class EarningsOverviewComponent implements OnInit {
  userService = inject(UserService);
  commissionService = inject(CommissionService);
  earningsService = inject(EarningsService);

  ngnSummary = this.commissionService.getSummary('NGN');
  usdSummary = this.commissionService.getSummary('USD');
  displayCurrency = this.userService.displayCurrency;
  currencySymbol = computed(() => (this.displayCurrency() === 'NGN' ? '₦' : '$'));
  isLoading = this.earningsService.isLoading;
  error = this.earningsService.error;

  recentEntries = computed(() => this.commissionService.getAllCommissions()().slice(0, 5));

  chartData: any;
  chartOptions: any;

  ngOnInit(): void {
    if (this.userService.isPaid()) {
      this.earningsService.fetchEarningsSectionData();
    }
  }

  constructor() {
    // Rebuilds chart whenever the earnings list signal changes
    effect(() => {
      this.commissionService.getAllCommissions()();
      this.buildChartData();
    });
  }

  buildChartData() {
    const entries = this.commissionService.getAllCommissions()();
    const symbol = this.currencySymbol();
    const textColorSecondary = '#64748b';
    const surfaceBorder = '#e5e7eb';

    // Aggregate amounts by date (most recent 30 entries sorted by date)
    const sorted = [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const byDate = new Map<string, number>();
    for (const e of sorted) {
      const key = new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      byDate.set(key, (byDate.get(key) ?? 0) + e.amount);
    }

    const labels = Array.from(byDate.keys()).slice(-15);
    const data = labels.map((l) => byDate.get(l) ?? 0);

    this.chartData = {
      labels: labels.length > 0 ? labels : ['No data'],
      datasets: [
        {
          label: 'Earnings',
          data: labels.length > 0 ? data : [0],
          fill: true,
          borderColor: '#49A321',
          backgroundColor: 'rgba(73, 163, 33, 0.1)',
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: '#49A321',
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2
        }
      ]
    };

    this.chartOptions = {
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: (context: any) => `${symbol}${context.raw.toLocaleString()}`
          }
        }
      },
      scales: {
        x: {
          ticks: { 
            color: textColorSecondary, 
            font: { size: 11 } 
          },
          grid: { 
            display: false 
          },
          border: {
            display: false
          }
        },
        y: {
          ticks: { 
            color: textColorSecondary, 
            font: { size: 11 },
            callback: (value: number) => `${symbol}${value.toLocaleString()}`
          },
          grid: { 
            color: surfaceBorder,
            drawBorder: false
          },
          border: {
            display: false
          }
        }
      },
      interaction: {
        intersect: false,
        mode: 'index'
      }
    };
  }

  getTotalEarned(): number {
    return this.ngnSummary().totalEarnings + (this.usdSummary().totalEarnings * 1500);
  }

  getAvailable(): number {
    return this.ngnSummary().approvedCommissions + (this.usdSummary().approvedCommissions * 1500);
  }

  getPending(): number {
    return this.ngnSummary().pendingCommissions + (this.usdSummary().pendingCommissions * 1500);
  }

  getWithdrawn(): number {
    return this.ngnSummary().withdrawnAmount + (this.usdSummary().withdrawnAmount * 1500);
  }
}
