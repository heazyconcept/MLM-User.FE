import {
  Component,
  DestroyRef,
  inject,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { OrderService, type OrderStatus } from '../../../services/order.service';
import { OrderCardComponent } from '../../../components/order-card/order-card.component';

@Component({
  selector: 'app-orders-overview',
  imports: [CommonModule, RouterLink, OrderCardComponent],
  templateUrl: './orders-overview.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdersOverviewComponent implements OnInit {
  private orderService = inject(OrderService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  filteredOrders = this.orderService.filteredOrders;
  searchQuery = this.orderService.searchQuery;
  statusFilter = this.orderService.statusFilter;
  orderStatuses = this.orderService.orderStatuses;

  ngOnInit(): void {
    this.orderService.loadOrders();

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const status = params.get('status') ?? '';
      const normalized =
        status && this.orderStatuses.includes(status as OrderStatus) ? status : '';
      if (this.orderService.statusFilter() !== normalized) {
        this.orderService.setStatusFilter(normalized);
      }
    });
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.orderService.setSearchQuery(value);
  }

  onStatusChange(value: string): void {
    this.orderService.setStatusFilter(value);
    void this.syncStatusQueryParam(value);
  }

  onClearFilters(): void {
    this.orderService.clearFilters();
    void this.syncStatusQueryParam('');
  }

  private syncStatusQueryParam(status: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: status ? { status } : { status: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
