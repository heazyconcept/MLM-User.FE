import { Component, inject, ChangeDetectionStrategy, OnInit } from '@angular/core';
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
  milestones = this.commissionService.getMilestones();
  isLoading = this.earningsService.isLoading;
  error = this.earningsService.error;

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
}
