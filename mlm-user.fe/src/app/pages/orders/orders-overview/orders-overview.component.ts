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
import { OrderService, type OrderStatus, type ShopChannel } from '../../../services/order.service';
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
  channelFilter = this.orderService.channelFilter;
  orderStatuses = this.orderService.orderStatuses;

  readonly channelOptions: { label: string; value: ShopChannel | '' }[] = [
    { label: 'All sources', value: '' },
    { label: 'Network Marketplace', value: 'NETWORK' },
    { label: 'Legacy Marketplace', value: 'LEGACY' },
  ];

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const status = params.get('status') ?? '';
      const normalizedStatus =
        status && this.orderStatuses.includes(status as OrderStatus) ? status : '';
      this.orderService.setStatusFilter(normalizedStatus);

      const channel = params.get('channel') ?? '';
      const normalizedChannel: ShopChannel | '' =
        channel === 'LEGACY' || channel === 'NETWORK' ? channel : '';
      this.orderService.setChannelFilter(normalizedChannel);
      this.orderService.loadOrders();
    });
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.orderService.setSearchQuery(value);
  }

  onStatusChange(value: string): void {
    this.orderService.setStatusFilter(value);
    void this.syncQueryParams({ status: value });
  }

  onChannelChange(value: string): void {
    const channel: ShopChannel | '' =
      value === 'LEGACY' || value === 'NETWORK' ? value : '';
    this.orderService.setChannelFilter(channel);
    void this.syncQueryParams({ channel });
    this.orderService.loadOrders({ channel: channel || undefined });
  }

  onClearFilters(): void {
    this.orderService.clearFilters();
    void this.syncQueryParams({ status: '', channel: '' });
    this.orderService.loadOrders();
  }

  private syncQueryParams(updates: { status?: string; channel?: string }): void {
    const queryParams: Record<string, string | null> = {};
    if ('status' in updates) {
      queryParams['status'] = updates.status ? updates.status : null;
    }
    if ('channel' in updates) {
      queryParams['channel'] = updates.channel ? updates.channel : null;
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
