import { Component, inject, ChangeDetectionStrategy, OnInit, computed } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CommissionService, MilestoneInfo } from '../../services/commission.service';
import { UserService } from '../../services/user.service';
import { EarningsService } from '../../services/earnings.service';
import { SkeletonModule } from 'primeng/skeleton';

@Component({
  selector: 'app-cpv-milestones-page',
  imports: [CommonModule, RouterLink, DecimalPipe, DatePipe, SkeletonModule],
  templateUrl: './cpv-milestones-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block bg-gray-50 min-h-screen'
  }
})
export class CpvMilestonesPageComponent implements OnInit {
  userService = inject(UserService);
  private commissionService = inject(CommissionService);
  private earningsService = inject(EarningsService);

  cpvSummary = this.commissionService.getCpvSummary();
  milestones = this.commissionService.getMilestones();
  isLoading = this.earningsService.isLoading;
  error = this.earningsService.error;

  displayCurrency = this.userService.displayCurrency;
  currencySymbol = computed(() => (this.displayCurrency() === 'NGN' ? '₦' : '$'));

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

  isMilestoneLocked(milestone: MilestoneInfo): boolean {
    return !milestone.achieved && !this.isNextMilestone(milestone);
  }

  getAchievedCount(): number {
    return this.milestones().filter((m: MilestoneInfo) => m.achieved).length;
  }

  /** Format cash reward with both USD and NGN based on the 1:1000 exchange rate */
  getCashRewardLabel(rewardAmount?: number): string {
    if (rewardAmount == null || rewardAmount === 0) return '—';
    const ngnAmount = rewardAmount * 1000;
    return `$${rewardAmount.toLocaleString()} (₦${ngnAmount.toLocaleString()})`;
  }

  /** Format material reward description */
  getMaterialRewardLabel(materialReward?: string): string {
    if (!materialReward || materialReward.toUpperCase() === 'NONE' || materialReward.trim() === '—') return '—';
    return materialReward;
  }
}
