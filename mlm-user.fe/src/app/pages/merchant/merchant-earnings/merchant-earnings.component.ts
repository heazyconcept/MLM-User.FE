import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MerchantService } from '../../../services/merchant.service';

@Component({
  selector: 'app-merchant-earnings',
  imports: [CommonModule],
  templateUrl: './merchant-earnings.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MerchantEarningsComponent implements OnInit {
  private merchantService = inject(MerchantService);

  earnings = this.merchantService.earnings;
  loading = this.merchantService.loading;
  error = this.merchantService.error;

  ngOnInit(): void {
    this.merchantService.fetchEarningsSummary();
  }

  formatCurrency(amount: number): string {
    const currency = this.earnings()?.currency;
    return this.merchantService.formatCurrency(amount, currency);
  }

  formatTypeLabel(key: string): string {
    const labels: Record<string, string> = {
      personalProduct: 'Personal Product Sales',
      directReferralProduct: 'Direct Referral Product Sales',
      communityProduct: 'Community Product Sales',
      deliveryBonus: 'Delivery Bonus',
      PERSONAL_PV: 'Personal PV',
      TEAM_PV: 'Team PV',
    };
    return labels[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
