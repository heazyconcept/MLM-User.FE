import { Component, inject, signal, OnInit, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MerchantService } from '../../../services/merchant.service';
import type { Order } from '../../../services/order.service';
import { StatusBadgeComponent } from '../../../components/status-badge/status-badge.component';
import { OrderTimelineComponent } from '../../../components/order-timeline/order-timeline.component';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-merchant-order-detail',
  imports: [CommonModule, RouterLink, StatusBadgeComponent, OrderTimelineComponent, ButtonModule],
  templateUrl: './merchant-order-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MerchantOrderDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private merchantService = inject(MerchantService);

  order = signal<Order | null>(null);

  canMarkReady = computed(() => {
    const o = this.order();
    return o && (o.status === 'Pending' || o.status === 'Processing');
  });
  canMarkShipped = computed(() => {
    const o = this.order();
    return o && o.status === 'Ready for Pickup';
  });
  canMarkCompleted = computed(() => {
    const o = this.order();
    return o && (o.status === 'Out for Delivery' || o.status === 'Ready for Pickup');
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/merchant/orders']);
      return;
    }
    const o = this.merchantService.getOrderById(id);
    if (!o) {
      this.router.navigate(['/merchant/orders']);
      return;
    }
    this.order.set(o);
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('en-NG', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatCurrency(amount: number, currency: 'NGN' | 'USD'): string {
    return currency === 'NGN' ? `₦${amount.toLocaleString('en-US')}` : `$${amount.toLocaleString('en-US')}`;
  }

  getFulfilmentLabel(method: Order['fulfilmentMethod']): string {
    return method === 'pickup' ? 'Pickup' : 'Home Delivery';
  }

  markAsReady(): void {
    const o = this.order();
    if (o && (o.status === 'Pending' || o.status === 'Processing')) {
      this.merchantService.updateOrderStatus(o.id, 'Ready for Pickup');
      this.order.set({ ...o, status: 'Ready for Pickup' });
    }
  }

  markAsShipped(): void {
    const o = this.order();
    if (o && o.status === 'Ready for Pickup') {
      this.merchantService.updateOrderStatus(o.id, 'Out for Delivery');
      this.order.set({ ...o, status: 'Out for Delivery' });
    }
  }

  markAsCompleted(): void {
    const o = this.order();
    if (o && (o.status === 'Out for Delivery' || o.status === 'Ready for Pickup')) {
      this.merchantService.updateOrderStatus(o.id, 'Delivered');
      this.order.set({ ...o, status: 'Delivered' });
    }
  }
}
