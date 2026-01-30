import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MerchantService } from '../../../services/merchant.service';

@Component({
  selector: 'app-merchant-earnings',
  imports: [CommonModule, RouterLink],
  templateUrl: './merchant-earnings.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MerchantEarningsComponent {
  private merchantService = inject(MerchantService);

  earnings = this.merchantService.earnings;

  formatCurrency(amount: number): string {
    return `₦${amount.toLocaleString('en-US')}`;
  }
}
