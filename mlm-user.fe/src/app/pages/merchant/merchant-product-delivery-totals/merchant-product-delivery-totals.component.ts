import { Component, computed, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MerchantService } from '../../../services/merchant.service';

@Component({
  selector: 'app-merchant-product-delivery-totals',
  imports: [CommonModule, RouterLink],
  templateUrl: './merchant-product-delivery-totals.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MerchantProductDeliveryTotalsComponent implements OnInit {
  private merchantService = inject(MerchantService);

  summary = this.merchantService.productDeliverySummary;
  loading = this.merchantService.loading;
  error = this.merchantService.error;

  products = computed(() => this.summary()?.products ?? []);
  totalProducts = computed(() => this.summary()?.totalProducts ?? 0);
  totalUnits = computed(() => this.summary()?.totalUnits ?? 0);

  ngOnInit(): void {
    this.merchantService.fetchProductDeliverySummary();
  }
}
