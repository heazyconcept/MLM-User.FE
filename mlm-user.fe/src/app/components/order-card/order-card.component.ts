import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Order } from '../../services/order.service';
import { StatusBadgeComponent } from '../status-badge/status-badge.component';

@Component({
  selector: 'app-order-card',
  imports: [CommonModule, RouterLink, StatusBadgeComponent],
  templateUrl: './order-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderCardComponent {
  order = input.required<Order>();

  formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  formatCurrency(amount: number, currency: 'NGN' | 'USD'): string {
    return currency === 'NGN' ? `₦${amount.toLocaleString('en-US')}` : `$${amount.toLocaleString('en-US')}`;
  }

  getItemsSummary(items: Order['items']): string {
    if (items.length === 0) return '—';
    if (items.length === 1) return items[0].name;
    return `${items[0].name} +${items.length - 1} more`;
  }

  getFulfilmentLabel(method: Order['fulfilmentMethod']): string {
    return method === 'pickup' ? 'Pickup' : 'Home Delivery';
  }
}
