import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MerchantService } from '../../../services/merchant.service';
import { StatusBadgeComponent } from '../../../components/status-badge/status-badge.component';

@Component({
  selector: 'app-merchant-deliveries',
  imports: [CommonModule, RouterLink, StatusBadgeComponent],
  templateUrl: './merchant-deliveries.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MerchantDeliveriesComponent implements OnInit {
  private merchantService = inject(MerchantService);

  deliveries = this.merchantService.deliveries;
  deliveriesTotal = this.merchantService.deliveriesTotal;
  loading = this.merchantService.loading;
  error = this.merchantService.error;

  ngOnInit(): void {
    this.merchantService.fetchDeliveries();
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
