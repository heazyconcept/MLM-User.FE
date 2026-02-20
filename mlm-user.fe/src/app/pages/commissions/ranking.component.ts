import { Component, inject, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CommissionService } from '../../services/commission.service';
import { UserService } from '../../services/user.service';
import { EarningsService } from '../../services/earnings.service';
import { EarningsTabsComponent } from './earnings-tabs.component';
import { SkeletonModule } from 'primeng/skeleton';

@Component({
  selector: 'app-ranking',
  imports: [CommonModule, RouterLink, DecimalPipe, DatePipe, EarningsTabsComponent, SkeletonModule],
  templateUrl: './ranking.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block bg-gray-50 min-h-screen'
  }
})
export class RankingComponent implements OnInit {
  userService = inject(UserService);
  private commissionService = inject(CommissionService);
  private earningsService = inject(EarningsService);

  rankInfo = this.commissionService.getRankInfo();
  isLoading = this.earningsService.isLoading;
  error = this.earningsService.error;

  ngOnInit(): void {
    if (this.userService.isPaid()) {
      this.earningsService.fetchEarningsSectionData();
    }
  }

  // Segmented progress bar (10 segments)
  get progressSegments(): { filled: boolean }[] {
    const percentage = this.rankInfo().progressPercentage;
    const totalSegments = 10;
    const filledCount = Math.floor((percentage / 100) * totalSegments);
    
    return Array.from({ length: totalSegments }, (_, i) => ({
      filled: i < filledCount
    }));
  }

  getReqPercentage(req: { current: number; required: number }): number {
    return Math.min(100, (req.current / req.required) * 100);
  }

  getPointsToGo(): number {
    const info = this.rankInfo();
    // Calculate total points needed vs current
    const totalRequired = info.requirements.reduce((sum, r) => sum + r.required, 0);
    const totalCurrent = info.requirements.reduce((sum, r) => sum + Math.min(r.current, r.required), 0);
    return Math.max(0, totalRequired - totalCurrent);
  }

  getCompletedReqs(): number {
    return this.rankInfo().requirements.filter(r => r.completed).length;
  }
}
