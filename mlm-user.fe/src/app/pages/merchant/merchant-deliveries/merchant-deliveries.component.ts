import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MerchantService } from '../../../services/merchant.service';
import { StatusBadgeComponent } from '../../../components/status-badge/status-badge.component';

@Component({
  selector: 'app-merchant-deliveries',
  imports: [CommonModule, RouterLink, StatusBadgeComponent],
  templateUrl: './merchant-deliveries.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MerchantDeliveriesComponent {
  private merchantService = inject(MerchantService);

  deliveries = this.merchantService.deliveries;
}
