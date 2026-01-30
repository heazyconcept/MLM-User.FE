import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MerchantService } from '../../../services/merchant.service';
import { MerchantStatCardComponent } from '../../../components/merchant-stat-card/merchant-stat-card.component';

@Component({
  selector: 'app-merchant-dashboard',
  imports: [CommonModule, RouterLink, MerchantStatCardComponent],
  templateUrl: './merchant-dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MerchantDashboardComponent {
  private merchantService = inject(MerchantService);

  totalMerchantSales = this.merchantService.totalMerchantSales;
  pendingFulfilmentsCount = this.merchantService.pendingFulfilmentsCount;
  inventorySummary = this.merchantService.inventorySummary;
  earnings = this.merchantService.earnings;

  formatCurrency(amount: number): string {
    return `₦${amount.toLocaleString('en-US')}`;
  }
}
