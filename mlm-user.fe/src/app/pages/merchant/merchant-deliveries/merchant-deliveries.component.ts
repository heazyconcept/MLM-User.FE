import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  MerchantService,
  type DeliveryConfirmation,
  type FulfilmentMode,
  type OrderStatus,
} from '../../../services/merchant.service';
import { StatusBadgeComponent } from '../../../components/status-badge/status-badge.component';
import { UiTableComponent } from '../../../components/table/table-component';

@Component({
  selector: 'app-merchant-deliveries',
  imports: [CommonModule, RouterLink, StatusBadgeComponent, UiTableComponent],
  templateUrl: './merchant-deliveries.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host ::ng-deep .merchant-deliveries-table .p-datatable-wrapper {
        border-radius: 0;
      }

      :host ::ng-deep .merchant-deliveries-table .p-datatable-tbody > tr {
        cursor: pointer;
      }
    `,
  ],
})
export class MerchantDeliveriesComponent implements OnInit {
  private merchantService = inject(MerchantService);
  private router = inject(Router);

  deliveries = this.merchantService.deliveries;
  deliveriesTotal = this.merchantService.deliveriesTotal;
  loading = this.merchantService.loading;
  error = this.merchantService.error;

  readonly tableHeaders = ['Product', 'Buyer', 'Type', 'Status', 'Completed', 'Amount'];

  ngOnInit(): void {
    this.merchantService.fetchDeliveries();
  }

  openOrder(row: DeliveryConfirmation): void {
    void this.router.navigate(['/merchant/orders', row.orderId]);
  }

  getProductSummary(row: DeliveryConfirmation): string {
    const items = row.order?.items ?? [];
    if (!items.length) return this.getOrderReference(row);
    return items.map((item) => `${item.productName} × ${item.quantity}`).join(', ');
  }

  getOrderReference(row: DeliveryConfirmation): string {
    return row.orderReference ?? row.order?.orderReference ?? row.orderId;
  }

  getBuyerUsername(row: DeliveryConfirmation): string {
    return (
      row.order?.buyerUsername ??
      row.order?.user?.username ??
      row.customerEmail ??
      '—'
    );
  }

  getBuyerPhone(row: DeliveryConfirmation): string | null {
    return row.order?.buyerPhone ?? row.order?.user?.phone ?? null;
  }

  getFulfilmentLabel(row: DeliveryConfirmation): string {
    const mode = (row.fulfilmentMode ?? row.order?.fulfilmentMode) as FulfilmentMode | undefined;
    if (mode === 'PICKUP') return 'Pickup';
    if (mode === 'OFFLINE_DELIVERY') return 'Delivery';
    return mode ?? '—';
  }

  getStatusLabel(row: DeliveryConfirmation): string {
    const status = (row.orderStatus ?? row.order?.status) as OrderStatus | string | undefined;
    if (!status) return '—';
    return this.merchantService.getStatusLabel(status as OrderStatus);
  }

  getAmount(row: DeliveryConfirmation): number {
    return row.totalAmount ?? row.order?.totalAmount ?? 0;
  }

  getCurrency(row: DeliveryConfirmation): string {
    return row.currency ?? row.order?.currency ?? 'NGN';
  }

  formatCurrency(amount: number, currency: string): string {
    return this.merchantService.formatCurrency(amount, currency);
  }

  formatDate(row: DeliveryConfirmation): string {
    const iso = row.completedAt ?? row.createdAt;
    return new Date(iso).toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
