import { Component, inject, signal, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CommissionService } from '../../services/commission.service';
import { UserService } from '../../services/user.service';
import { EarningsService } from '../../services/earnings.service';
import { EarningsTabsComponent } from './earnings-tabs.component';
import { StatusBadgeComponent } from '../../components/status-badge/status-badge.component';

@Component({
  selector: 'app-bonuses',
  imports: [CommonModule, RouterLink, DecimalPipe, EarningsTabsComponent, StatusBadgeComponent],
  templateUrl: './bonuses.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block bg-gray-50 min-h-screen'
  }
})
export class BonusesComponent implements OnInit {
  userService = inject(UserService);
  private commissionService = inject(CommissionService);
  private earningsService = inject(EarningsService);

  bonuses = this.commissionService.getBonuses();
  isLoading = this.earningsService.isLoading;
  expandedId = signal<string | null>(null);

  ngOnInit(): void {
    if (this.userService.isPaid()) {
      this.earningsService.fetchEarningsSectionData();
    }
  }

  toggleExpand(id: string): void {
    this.expandedId.update(current => current === id ? null : id);
  }
}
