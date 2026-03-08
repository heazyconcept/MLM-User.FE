import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { OrderService, Order } from '../../../services/order.service';
import { StatusBadgeComponent } from '../../../components/status-badge/status-badge.component';
import { OrderTimelineComponent } from '../../../components/order-timeline/order-timeline.component';

@Component({
  selector: 'app-order-detail',
  imports: [CommonModule, RouterLink, StatusBadgeComponent, OrderTimelineComponent],
  templateUrl: './order-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private orderService = inject(OrderService);

  order = signal<Order | null>(null);
  isProcessing = signal(false);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/orders']);
      return;
    }
    this.orderService.getOrderById(id).subscribe((o) => {
      if (!o) {
        this.router.navigate(['/orders']);
        return;
      }
      this.order.set(o);
      this.orderService.selectOrder(o);
    });
  }

  onPay(): void {
    const o = this.order();
    if (!o) return;
    this.isProcessing.set(true);
    this.orderService.payOrderWithWallet(o.id).subscribe({
      next: () => this.refreshOrder(o.id),
      error: () => this.isProcessing.set(false),
    });
  }

  onCancel(): void {
    const o = this.order();
    if (!o) return;
    this.isProcessing.set(true);
    this.orderService.cancelOrder(o.id).subscribe({
      next: () => this.refreshOrder(o.id),
      error: () => this.isProcessing.set(false),
    });
  }

  onConfirmReceived(): void {
    const o = this.order();
    if (!o) return;
    this.isProcessing.set(true);
    this.orderService.confirmOrderReceived(o.id).subscribe({
      next: () => this.refreshOrder(o.id),
      error: () => this.isProcessing.set(false),
    });
  }

  private refreshOrder(id: string): void {
    this.orderService.getOrderById(id, true).subscribe((newOrder) => {
      if (newOrder) {
        this.order.set(newOrder);
      }
      this.isProcessing.set(false);
    });
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('en-NG', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatCurrency(amount: number, currency: 'NGN' | 'USD'): string {
    return currency === 'NGN'
      ? `₦${amount.toLocaleString('en-US')}`
      : `$${amount.toLocaleString('en-US')}`;
  }

  getFulfilmentLabel(method: Order['fulfilmentMethod']): string {
    return method === 'pickup' ? 'Pickup' : 'Home Delivery';
  }
}
