import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderStatus } from '../../services/order.service';

@Component({
  selector: 'app-order-timeline',
  imports: [CommonModule],
  templateUrl: './order-timeline.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderTimelineComponent {
  currentStatus = input.required<OrderStatus>();
  statuses = input<OrderStatus[]>(['Pending', 'Processing', 'Ready for Pickup', 'Out for Delivery', 'Delivered', 'Cancelled']);

  steps = computed(() => {
    const list = this.statuses();
    const current = this.currentStatus();
    const currentIndex = list.indexOf(current);
    return list.map((status, index) => ({
      status,
      isCompleted: currentIndex > index || current === status,
      isCurrent: current === status,
      isCancelled: current === 'Cancelled' && status !== 'Cancelled' && index < list.indexOf('Cancelled')
    }));
  });
}
