import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MerchantService, type MerchantOrder } from '../../../services/merchant.service';
import { StatusBadgeComponent } from '../../../components/status-badge/status-badge.component';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-merchant-order-detail',
  imports: [CommonModule, RouterLink, FormsModule, StatusBadgeComponent, ButtonModule],
  templateUrl: './merchant-order-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MerchantOrderDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private merchantService = inject(MerchantService);

  order = this.merchantService.orderDetail;
  loading = this.merchantService.loading;
  actionLoading = this.merchantService.actionLoading;
  error = this.merchantService.error;

  // Confirm delivery form
  proofUrl = signal('');
  deliveryNotes = signal('');
  showConfirmForm = signal(false);

  // Action visibility computed from order state
  canMarkReadyForPickup = computed(() => {
    const o = this.order();
    return o && o.fulfilmentMode === 'PICKUP' && o.status === 'ASSIGNED_TO_MERCHANT';
  });

  canMarkDeliveryRequested = computed(() => {
    const o = this.order();
    return o && o.fulfilmentMode === 'OFFLINE_DELIVERY' && o.status === 'ASSIGNED_TO_MERCHANT';
  });

  canMarkSent = computed(() => {
    const o = this.order();
    return o && (o.status === 'READY_FOR_PICKUP' || o.status === 'OFFLINE_DELIVERY_REQUESTED');
  });

  canConfirmDelivery = computed(() => {
    const o = this.order();
    return (
      o &&
      (o.status === 'READY_FOR_PICKUP' ||
        o.status === 'OFFLINE_DELIVERY_REQUESTED' ||
        o.status === 'PAID' ||
        o.status === 'SENT')
    );
  });

  isDelivered = computed(() => {
    const o = this.order();
    return o?.status === 'DELIVERED';
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/merchant/orders']);
      return;
    }
    this.merchantService.fetchOrderById(id);
  }

  markReadyForPickup(): void {
    const o = this.order();
    if (o) this.merchantService.markReadyForPickup(o.id);
  }

  markDeliveryRequested(): void {
    const o = this.order();
    if (o) this.merchantService.markDeliveryRequested(o.id);
  }

  markSent(): void {
    const o = this.order();
    if (o) this.merchantService.markSent(o.id);
  }

  toggleConfirmForm(): void {
    this.showConfirmForm.update((v) => !v);
  }

  submitConfirmDelivery(): void {
    const o = this.order();
    if (!o) return;
    const body: { proof?: string; notes?: string } = {};
    const proof = this.proofUrl().trim();
    const notes = this.deliveryNotes().trim();
    if (proof) body.proof = proof;
    if (notes) body.notes = notes;
    this.merchantService.confirmDelivery(o.id, body);
    this.showConfirmForm.set(false);
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-NG', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatCurrency(amount: number, currency: string): string {
    return this.merchantService.formatCurrency(amount, currency);
  }

  getStatusLabel(status: string): string {
    return this.merchantService.getStatusLabel(status as any);
  }

  getFulfilmentLabel(mode: string): string {
    return mode === 'PICKUP' ? 'Pickup' : 'Delivery';
  }
}
