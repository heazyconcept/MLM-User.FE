import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CommissionService } from '../../services/commission.service';
import { UserService } from '../../services/user.service';
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
export class BonusesComponent {
  userService = inject(UserService);
  private commissionService = inject(CommissionService);

  bonuses = this.commissionService.getBonuses();
  expandedId = signal<string | null>(null);

  toggleExpand(id: string): void {
    this.expandedId.update(current => current === id ? null : id);
  }
}
