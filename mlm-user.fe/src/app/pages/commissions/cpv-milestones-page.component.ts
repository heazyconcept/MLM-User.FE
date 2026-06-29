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
    class: 'block bg-gray-50 min-h-screen',
  },
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

  pointsToGo = computed(() => {
    const summary = this.cpvSummary();
    return Math.max(0, summary.nextMilestoneCpv - summary.totalCpv);
  });

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

  /** Format cash reward in the user's account currency (USD base × 1000 for NGN). */
  getCashRewardLabel(rewardAmount?: number): string {
    if (rewardAmount == null || rewardAmount === 0) return '—';
    const amount =
      this.displayCurrency() === 'NGN' ? rewardAmount * 1000 : rewardAmount;
    return `${this.currencySymbol()}${amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  getNextMilestoneTargetLabel(): string {
    const next = this.milestones().find((m) => !m.achieved);
    if (!next) {
      return this.cpvSummary().nextMilestoneReward || '—';
    }

    const cash = this.getCashRewardLabel(next.rewardAmount);
    const material = this.getMaterialRewardLabel(next.materialReward);
    const rewardParts: string[] = [];
    if (cash !== '—') rewardParts.push(cash);
    if (material !== '—') rewardParts.push(material);

    if (rewardParts.length === 0) return next.name;
    return `${next.name} — ${rewardParts.join(' + ')}`;
  }

  /** Format material reward description */
  getMaterialRewardLabel(materialReward?: string): string {
    if (!materialReward || materialReward.toUpperCase() === 'NONE' || materialReward.trim() === '—') return '—';
    return materialReward;
  }
}
