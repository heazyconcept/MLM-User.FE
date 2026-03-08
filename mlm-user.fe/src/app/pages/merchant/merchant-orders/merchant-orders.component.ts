import { Component, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  MerchantService,
  type MerchantOrder,
  type OrderStatus,
} from '../../../services/merchant.service';
import { StatusBadgeComponent } from '../../../components/status-badge/status-badge.component';

@Component({
  selector: 'app-merchant-orders',
  imports: [CommonModule, RouterLink, FormsModule, StatusBadgeComponent],
  templateUrl: './merchant-orders.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MerchantOrdersComponent implements OnInit {
  private merchantService = inject(MerchantService);

  orders = this.merchantService.orders;
  ordersTotal = this.merchantService.ordersTotal;
  loading = this.merchantService.loading;
  error = this.merchantService.error;

  statusFilter = signal('');
  currentPage = signal(1);
  readonly pageSize = 20;

  readonly orderStatuses: OrderStatus[] = [
    'ASSIGNED_TO_MERCHANT',
    'READY_FOR_PICKUP',
    'OFFLINE_DELIVERY_REQUESTED',
    'DELIVERED',
    'SENT',
    'PAID',
  ];

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    const offset = (this.currentPage() - 1) * this.pageSize;
    const status = this.statusFilter() as OrderStatus | '';
    this.merchantService.fetchOrders({
      status: status || undefined,
      limit: this.pageSize,
      offset,
    });
  }

  onStatusFilterChange(status: string): void {
    this.statusFilter.set(status);
    this.currentPage.set(1);
    this.loadOrders();
  }

  nextPage(): void {
    if (this.currentPage() * this.pageSize < this.ordersTotal()) {
      this.currentPage.update((p) => p + 1);
      this.loadOrders();
    }
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update((p) => p - 1);
      this.loadOrders();
    }
  }

  getStatusLabel(status: OrderStatus): string {
    return this.merchantService.getStatusLabel(status);
  }

  formatCurrency(amount: number, currency: string): string {
    return this.merchantService.formatCurrency(amount, currency);
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

  getFulfilmentLabel(mode: string): string {
    return mode === 'PICKUP' ? 'Pickup' : 'Delivery';
  }
}
