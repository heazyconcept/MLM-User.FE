import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { CommissionService } from '../../services/commission.service';
import { EarningsTabsComponent } from './earnings-tabs.component';
import { StatusBadgeComponent } from '../../components/status-badge/status-badge.component';

@Component({
  selector: 'app-commission-breakdown',
  imports: [CommonModule, DecimalPipe, DatePipe, EarningsTabsComponent, StatusBadgeComponent],
  templateUrl: './commission-breakdown.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block bg-gray-50 min-h-screen'
  }
})
export class CommissionBreakdownComponent {
  private commissionService = inject(CommissionService);

  allCommissions = this.commissionService.getAllCommissions();
}
