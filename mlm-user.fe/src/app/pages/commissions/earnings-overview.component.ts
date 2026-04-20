import { Component, inject, computed, ChangeDetectionStrategy, OnInit, effect, signal } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ChartModule } from 'primeng/chart';
import { SkeletonModule } from 'primeng/skeleton';
import { UserService } from '../../services/user.service';
import { CommissionService } from '../../services/commission.service';
import { EarningsService } from '../../services/earnings.service';
import { SettingsService } from '../../services/settings.service';
import { EarningsTabsComponent } from './earnings-tabs.component';

type EarningCardKey =
  | 'PDPA'
  | 'CDPA'
  | 'REGISTRATION_PV'
  | 'DIRECT_REFERRAL_PV'
  | 'PPPC'
  | 'DRPPC'
  | 'CPPC'
  | 'PERSONAL_CPV'
  | 'CPV_CASH_BONUS';

type HistoryRowStatus = 'POSTED' | 'PENDING' | 'FAILED';

interface CardHistoryRow {
  id: string;
  date: string;
  status: HistoryRowStatus;
  source: string;
  value: number;
  unit: 'MONEY' | 'PV';
}

interface HistoryCardConfig {
  key: EarningCardKey;
  label: string;
  unit: 'MONEY' | 'PV';
  value: number;
}

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
  private settingsService = inject(SettingsService);

  ngnSummary = this.commissionService.getSummary('NGN');
  usdSummary = this.commissionService.getSummary('USD');
  displayCurrency = this.userService.displayCurrency;
  currencySymbol = computed(() => (this.displayCurrency() === 'NGN' ? '₦' : '$'));
  isLoading = this.earningsService.isLoading;
  error = this.earningsService.error;

  allCommissionEntries = this.commissionService.getAllCommissions();
  recentEntries = computed(() => this.allCommissionEntries().slice(0, 5));
  selectedHistoryCardKey = signal<EarningCardKey>('PDPA');

  pdpaRate = computed(() => {
    // If backend returns rates directly, we could use them here if we map them.
    // Currently, settingsService returns them from commission rules.
    const pkg = this.userService.currentUser()?.package ?? 'NICKEL';
    const apiRates = this.settingsService.commissionRules()?.pdpaRates;
    return apiRates?.[pkg] ?? 0;
  });
  pdpaRatePercent = computed(() => this.pdpaRate() * 100);
  cdpaRate = computed(() => {
    const pkg = this.userService.currentUser()?.package ?? 'NICKEL';
    const apiRates = this.settingsService.commissionRules()?.cdpaRates;
    return apiRates?.[pkg] ?? 0;
  });
  pdpaEarned = computed(() => {
    const summary = this.earningsService.earningsSummary();
    return summary.pdpaEarnings ?? 0;
  });
  cdpaEarned = computed(() => {
    const summary = this.earningsService.earningsSummary();
    return summary.cdpaEarnings ?? 0;
  });
  pppcEarned = computed(() => {
    const summary = this.earningsService.earningsSummary();
    return summary.pppcEarnings ?? 0;
  });
  drppcEarned = computed(() => {
    const summary = this.earningsService.earningsSummary();
    return summary.drppcEarnings ?? 0;
  });
  cppcEarned = computed(() => {
    const summary = this.earningsService.earningsSummary();
    return summary.cppcEarnings ?? 0;
  });

  /** Autoship & Cashout */
  cashoutPercentage = computed(() => this.earningsService.earningsSummary().cashoutPercentage ?? 65);
  autoshipPercentage = computed(() => this.earningsService.earningsSummary().autoshipPercentage ?? 35);
  autoshipBalance = computed(() => this.earningsService.earningsSummary().autoshipBalance ?? 0);
  cashoutEligible = computed(() => this.earningsService.earningsSummary().cashoutEligible ?? 0);
  /** Monthly autoship amount in user's display currency */
  monthlyAutoshipAmount = computed(() => {
    const usdAmount = this.earningsService.earningsSummary().monthlyAutoshipAmountUsd ?? 10;
    return this.displayCurrency() === 'NGN' ? usdAmount * 1000 : usdAmount;
  });

  /** Community Bonus by Level (1-13) */
  communityBonusByLevel = computed(() => this.earningsService.earningsSummary().communityBonusByLevel ?? []);

  /** Leadership Bonus */
  leadershipBonus = computed(() => this.earningsService.earningsSummary().leadershipBonus ?? 0);

  cpvSummary = this.earningsService.cpvSummary;

  /** Registration PV from /earnings/summary (same source used by CPV tab). */
  registrationPv = computed(() => {
    const summary = this.earningsService.earningsSummary();
    const registration = summary.instantRegistrationPv ?? 0;
    const community = summary.communityRegistrationPv ?? 0;
    return {
      registration,
      community,
      total: registration + community
    };
  });

  /** Direct referral PV from sponsoring new activations. */
  directReferralPv = computed(() => {
    const history = this.cpvSummary().history ?? [];
    if (history.length === 0) {
      return 0;
    }

    return history.reduce((sum, entry) => {
      const source = (entry.source ?? '').toUpperCase().trim();
      return source === 'DIRECT_REFERRAL_REGISTRATION' ? sum + entry.totalCpv : sum;
    }, 0);
  });

  chartData: any;
  chartOptions: any;
  private selectedChartRange: 'Last 30 days' | 'Last 7 days' | 'This month' | 'Last 3 months' = 'Last 30 days';

  historyCards = computed<HistoryCardConfig[]>(() => [
    { key: 'PDPA', label: 'PDPA', unit: 'MONEY', value: this.pdpaEarned() },
    { key: 'CDPA', label: 'CDPA', unit: 'MONEY', value: this.cdpaEarned() },
    { key: 'REGISTRATION_PV', label: 'Registration PV', unit: 'PV', value: this.registrationPv().total },
    { key: 'DIRECT_REFERRAL_PV', label: 'Direct Referral PV', unit: 'PV', value: this.directReferralPv() },
    { key: 'PPPC', label: 'PPPC', unit: 'MONEY', value: this.pppcEarned() },
    { key: 'DRPPC', label: 'DRPPC', unit: 'MONEY', value: this.drppcEarned() },
    { key: 'CPPC', label: 'CPPC', unit: 'MONEY', value: this.cppcEarned() },
    { key: 'PERSONAL_CPV', label: 'Personal CPV', unit: 'PV', value: this.cpvSummary().personalCpv },
    { key: 'CPV_CASH_BONUS', label: 'CPV Cash Bonus', unit: 'MONEY', value: this.cpvSummary().cpvCashBonus },
  ]);

  selectedHistoryCard = computed(() =>
    this.historyCards().find(c => c.key === this.selectedHistoryCardKey()) ?? this.historyCards()[0]
  );

  historyRowsForSelectedCard = computed<CardHistoryRow[]>(() => {
    const key = this.selectedHistoryCardKey();
    const earningsRows = this.allCommissionEntries();
    const cpvRows = this.cpvSummary().history ?? [];

    const mapStatus = (s: string): HistoryRowStatus => {
      const status = s.toUpperCase();
      if (status === 'APPROVED') return 'POSTED';
      if (status === 'PENDING') return 'PENDING';
      return 'FAILED';
    };

    if (key === 'PERSONAL_CPV') {
      return cpvRows
        .filter(r => r.personalCpv > 0)
        .map((r, i) => ({
          id: `pcpv-${i}-${r.date}`,
          date: r.date,
          status: 'POSTED' as HistoryRowStatus,
          source: this.normalizeCpvSource(r.source, r.pvType),
          value: r.personalCpv,
          unit: 'PV' as 'PV',
        }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 20);
    }

    if (key === 'REGISTRATION_PV') {
      return cpvRows
        .filter(r => {
          const source = (r.source ?? '').toUpperCase();
          return source.includes('REGISTRATION');
        })
        .map((r, i) => ({
          id: `rpv-${i}-${r.date}`,
          date: r.date,
          status: 'POSTED' as HistoryRowStatus,
          source: this.normalizeCpvSource(r.source, r.pvType),
          value: r.totalCpv,
          unit: 'PV' as 'PV',
        }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 20);
    }

    if (key === 'DIRECT_REFERRAL_PV') {
      return cpvRows
        .filter(r => (r.source ?? '').toUpperCase().includes('DIRECT_REFERRAL'))
        .map((r, i) => ({
          id: `drpv-${i}-${r.date}`,
          date: r.date,
          status: 'POSTED' as HistoryRowStatus,
          source: this.normalizeCpvSource(r.source, r.pvType),
          value: r.totalCpv,
          unit: 'PV' as 'PV',
        }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 20);
    }

    const earningTypeMap: Record<EarningCardKey, string[]> = {
      PDPA: ['PDPA'],
      CDPA: ['CDPA'],
      PPPC: ['Personal Product Commission', 'Merchant Personal Product'],
      DRPPC: ['Direct Referral Product Commission', 'Merchant Direct Referral Product'],
      CPPC: ['Community Product Commission', 'Merchant Community Product'],
      CPV_CASH_BONUS: ['CPV Cash Bonus'],
      REGISTRATION_PV: [],
      DIRECT_REFERRAL_PV: [],
      PERSONAL_CPV: [],
    };

    const acceptedTypes = earningTypeMap[key] ?? [];
    return earningsRows
      .filter(e => acceptedTypes.includes(e.type))
      .map(e => ({
        id: e.id,
        date: e.date,
        status: mapStatus(e.status),
        source: e.source,
        value: e.amount,
        unit: 'MONEY' as 'MONEY',
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20);
  });

  ngOnInit(): void {
    if (this.userService.isPaid()) {
      this.earningsService.fetchEarningsSectionData();
    }
  }

  constructor() {
    // Rebuilds chart whenever the earnings list signal changes
    effect(() => {
      this.allCommissionEntries();
      this.buildChartData();
    });
  }

  selectHistoryCard(cardKey: EarningCardKey): void {
    this.selectedHistoryCardKey.set(cardKey);
  }

  getHistoryStatusClass(status: HistoryRowStatus): string {
    if (status === 'POSTED') return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (status === 'PENDING') return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-red-700 bg-red-50 border-red-200';
  }

  formatHistoryValue(row: CardHistoryRow): string {
    if (row.unit === 'PV') {
      return `${row.value.toLocaleString()} PV`;
    }
    return `${this.currencySymbol()}${row.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }

  private normalizeCpvSource(source?: string, pvType?: string): string {
    if (source && source.trim().length > 0) {
      return source.replace(/_/g, ' ');
    }
    if (pvType && pvType.trim().length > 0) {
      return pvType.replace(/_/g, ' ');
    }
    return 'CPV activity';
  }

  buildChartData() {
    const entries = this.allCommissionEntries();
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

    const allLabels = Array.from(byDate.keys());
    const labelCount = this.getChartLabelCount(this.selectedChartRange);
    const labels = allLabels.slice(-labelCount);
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

  onChartRangeChange(event: Event): void {
    const value = (event.target as HTMLSelectElement | null)?.value;
    const allowedRanges = ['Last 30 days', 'Last 7 days', 'This month', 'Last 3 months'] as const;
    if (value && (allowedRanges as readonly string[]).includes(value)) {
      this.selectedChartRange = value as (typeof allowedRanges)[number];
      this.buildChartData();
    }
  }

  private getChartLabelCount(range: 'Last 30 days' | 'Last 7 days' | 'This month' | 'Last 3 months'): number {
    switch (range) {
      case 'Last 7 days':
        return 7;
      case 'This month':
        return 31;
      case 'Last 3 months':
        return 90;
      case 'Last 30 days':
      default:
        return 30;
    }
  }
}
