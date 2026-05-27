import { Component, inject, ChangeDetectionStrategy, OnInit, computed } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CommissionService, MilestoneInfo } from '../../services/commission.service';
import { UserService } from '../../services/user.service';
import { EarningsService } from '../../services/earnings.service';
import { EarningsTabsComponent } from './earnings-tabs.component';
import { SkeletonModule } from 'primeng/skeleton';

@Component({
  selector: 'app-cpv-milestones',
  imports: [CommonModule, RouterLink, DecimalPipe, DatePipe, EarningsTabsComponent, SkeletonModule],
  templateUrl: './cpv-milestones.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block bg-gray-50 min-h-screen'
  }
})
export class CpvMilestonesComponent implements OnInit {
  userService = inject(UserService);
  private commissionService = inject(CommissionService);
  private earningsService = inject(EarningsService);

  cpvSummary = this.commissionService.getCpvSummary();
  cpvTotals = this.earningsService.cpvSummary;
  milestones = this.commissionService.getMilestones();
  cpvHistory = computed(() => this.earningsService.cpvSummary().history ?? []);

  registrationPv = computed(() => {
    const summary = this.earningsService.earningsSummary();
    const instant = summary.instantRegistrationPv ?? 0;
    const community = summary.communityRegistrationPv ?? 0;
    return { instant, community, total: instant + community };
  });

  displayCurrency = this.userService.displayCurrency;
  currencySymbol = computed(() => (this.displayCurrency() === 'NGN' ? '₦' : '$'));

  isLoading = this.earningsService.isLoading;
  error = this.earningsService.error;

  getSourceLabel(source?: string, pvType?: string): string {
    if (!source) return '—';
    const normalized = source.toUpperCase().trim();
    if (normalized === 'REGISTRATION') {
      if (pvType === 'INSTANT') return 'Registration (Instant PV)';
      if (pvType === 'COMMUNITY') return 'Registration (Community PV)';
      return 'Registration (Instant + Community PV)';
    }
    const labels: Record<string, string> = {
      PRODUCT_PURCHASE_PV: 'Personal product PV',
      DIRECT_REFERRAL_PRODUCT_PV: 'Direct referral product PV',
      COMMUNITY_PRODUCT_MATRIX: 'Community product CPV',
      DIRECT_REFERRAL_REGISTRATION: 'Direct referral registration PV',
      COMMUNITY_REGISTRATION_MATRIX: 'Community registration CPV',
    };
    if (labels[normalized]) {
      return labels[normalized];
    }
    return normalized.replace(/_/g, ' ');
  }

  ngOnInit(): void {
    if (this.userService.isPaid()) {
      this.earningsService.fetchEarningsSectionData();
    }
  }

  getMilestoneProgress(): number {
    const summary = this.cpvSummary();
    return Math.min(100, (summary.totalCpv / summary.nextMilestoneCpv) * 100);
  }

  isNextMilestone(milestone: MilestoneInfo): boolean {
    const summary = this.cpvSummary();
    return !milestone.achieved && milestone.cpvRequired === summary.nextMilestoneCpv;
  }

  getAchievedCount(): number {
    return this.milestones().filter((m: MilestoneInfo) => m.achieved).length;
  }

  /** Format reward in user's display currency instead of hardcoded USD */
  getRewardLabel(milestone: MilestoneInfo): string {
    const amount = milestone.rewardAmount ?? 0;
    const converted = this.displayCurrency() === 'NGN' ? amount * 1000 : amount;
    const symbol = this.currencySymbol();
    const formatted = converted.toLocaleString();
    const material = milestone.materialReward;
    return material ? `${symbol}${formatted} + ${material}` : `${symbol}${formatted}`;
  }
}
