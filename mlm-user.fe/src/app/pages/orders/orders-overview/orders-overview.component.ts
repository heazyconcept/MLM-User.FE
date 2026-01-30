import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { OrderService } from '../../../services/order.service';
import { OrderCardComponent } from '../../../components/order-card/order-card.component';

@Component({
  selector: 'app-orders-overview',
  imports: [CommonModule, RouterLink, OrderCardComponent],
  templateUrl: './orders-overview.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrdersOverviewComponent implements OnInit {
  private orderService = inject(OrderService);

  filteredOrders = this.orderService.filteredOrders;
  searchQuery = this.orderService.searchQuery;
  statusFilter = this.orderService.statusFilter;
  orderStatuses = this.orderService.orderStatuses;

  ngOnInit(): void {
    this.orderService.loadOrders();
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.orderService.setSearchQuery(value);
  }

  onStatusChange(value: string): void {
    this.orderService.setStatusFilter(value);
  }

  onClearFilters(): void {
    this.orderService.clearFilters();
  }
}
