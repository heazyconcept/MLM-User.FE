import { Component, inject, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { CommissionService } from '../../services/commission.service';
import { EarningsService } from '../../services/earnings.service';
import { UserService } from '../../services/user.service';
import { EarningsTabsComponent } from './earnings-tabs.component';
import { RouterLink } from '@angular/router';
import { StatusBadgeComponent } from '../../components/status-badge/status-badge.component';
import { SkeletonModule } from 'primeng/skeleton';

@Component({
  selector: 'app-commission-breakdown',
  imports: [CommonModule, DecimalPipe, DatePipe, RouterLink, EarningsTabsComponent, StatusBadgeComponent, SkeletonModule],
  templateUrl: './commission-breakdown.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block bg-gray-50 min-h-screen'
  }
})
export class CommissionBreakdownComponent implements OnInit {
  private commissionService = inject(CommissionService);
  private earningsService = inject(EarningsService);
  userService = inject(UserService);

  allCommissions = this.commissionService.getAllCommissions();
  isLoading = this.earningsService.isLoading;
  error = this.earningsService.error;

  ngOnInit(): void {
    if (this.userService.isPaid()) {
      this.earningsService.fetchEarningsSectionData();
    }
  }
}
