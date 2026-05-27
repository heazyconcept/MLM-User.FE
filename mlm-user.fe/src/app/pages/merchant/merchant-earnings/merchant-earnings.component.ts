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
      personalProduct: 'Merchant product purchase commission',
      directReferralProduct: 'Merchant direct referral product commission',
      communityProduct: 'Merchant community product commission',
      deliveryBonus: 'Merchant delivery commission',
      MERCHANT_PERSONAL_PRODUCT: 'Merchant product purchase commission',
      MERCHANT_DIRECT_REFERRAL_PRODUCT: 'Merchant direct referral product commission',
      MERCHANT_COMMUNITY_PRODUCT: 'Merchant community product commission',
      MERCHANT_DELIVERY_BONUS: 'Merchant delivery commission',
      PERSONAL_PRODUCT_PURCHASE: 'Personal product purchase commission',
      DIRECT_REFERRAL_PRODUCT_PURCHASE: 'Direct referral product purchase commission',
      COMMUNITY_PRODUCT_PURCHASE: 'Community product purchase commission',
      PERSONAL_PV: 'Personal PV',
      TEAM_PV: 'Team PV',
    };
    return labels[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
