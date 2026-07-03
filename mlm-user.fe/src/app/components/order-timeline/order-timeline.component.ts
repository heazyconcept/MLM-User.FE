import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderFulfilmentMethod, OrderStatus } from '../../services/order.service';

const PICKUP_STATUSES: OrderStatus[] = [
  'Pending',
  'Processing',
  'Ready for Pickup',
  'Picked Up',
  'Delivered',
  'Cancelled',
];

const DELIVERY_STATUSES: OrderStatus[] = [
  'Pending',
  'Processing',
  'Out for Delivery',
  'Delivered',
  'Cancelled',
];

@Component({
  selector: 'app-order-timeline',
  imports: [CommonModule],
  templateUrl: './order-timeline.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderTimelineComponent {
  currentStatus = input.required<OrderStatus>();
  fulfilmentMethod = input<OrderFulfilmentMethod>('delivery');

  steps = computed(() => {
    const list =
      this.fulfilmentMethod() === 'pickup' ? PICKUP_STATUSES : DELIVERY_STATUSES;
    const current = this.currentStatus();
    const currentIndex = list.indexOf(current);
    const resolvedIndex = currentIndex >= 0 ? currentIndex : list.length - 1;

    return list.map((status, index) => ({
      status,
      isCompleted: resolvedIndex > index || current === status,
      isCurrent: current === status,
      isCancelled: current === 'Cancelled' && status !== 'Cancelled' && index < list.indexOf('Cancelled'),
    }));
  });
}
