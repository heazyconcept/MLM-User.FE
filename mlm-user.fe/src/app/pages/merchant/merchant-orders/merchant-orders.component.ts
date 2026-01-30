import { Component, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MerchantService } from '../../../services/merchant.service';
import { OrderCardComponent } from '../../../components/order-card/order-card.component';

@Component({
  selector: 'app-merchant-orders',
  imports: [CommonModule, RouterLink, OrderCardComponent],
  templateUrl: './merchant-orders.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MerchantOrdersComponent {
  private merchantService = inject(MerchantService);

  orders = this.merchantService.orders;
  filteredOrders = computed(() => this.orders());
}
