import { Component, inject, signal, computed, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { OrderService, Order, OrderDispute } from '../../../services/order.service';
import { InvoiceService } from '../../../services/invoice.service';
import { MessageService } from 'primeng/api';
import { StatusBadgeComponent } from '../../../components/status-badge/status-badge.component';
import { InvoiceModalComponent } from '../../../components/invoice-modal/invoice-modal.component';
import { OrderTimelineComponent } from '../../../components/order-timeline/order-timeline.component';

@Component({
  selector: 'app-order-detail',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    StatusBadgeComponent,
    InvoiceModalComponent,
    OrderTimelineComponent,
  ],
  templateUrl: './order-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private orderService = inject(OrderService);
  invoiceService = inject(InvoiceService);
  private messageService = inject(MessageService);

  order = signal<Order | null>(null);
  disputes = signal<OrderDispute[]>([]);
  isProcessing = signal(false);
  disputeDialogOpen = signal(false);
  disputeReason = signal('');
  disputeNotes = signal('');
  disputeEvidence = signal<File[]>([]);
  disputeError = signal<string | null>(null);
  disputesLoading = signal(true);
  disputesLoadError = signal<string | null>(null);

  canConfirmPickup = computed(() => {
    const o = this.order();
    if (!o || this.disputesLoading() || this.disputesLoadError()) return false;
    return OrderService.canConfirmPickupReceived(o, this.disputes());
  });

  canOpenDispute = computed(() => {
    const o = this.order();
    if (!o || this.disputesLoading() || this.disputesLoadError()) return false;
    return OrderService.canOpenPickupDispute(o, this.disputes());
  });

  hasOpenDispute = computed(
    () => this.order()?.hasOpenDispute === true || OrderService.hasOpenDispute(this.disputes()),
  );

  openDisputeRecord = computed(() => this.disputes().find((d) => d.status === 'OPEN') ?? null);
  disputeHistory = computed(() => this.disputes().filter((d) => d.status !== 'OPEN'));

  isAwaitingPickupCollection = computed(() => {
    const o = this.order();
    if (!o) return false;
    return OrderService.isAwaitingPickupCollection(o);
  });

  pickupHandoffMessage = computed(() => {
    const o = this.order();
    if (!o) return '';
    return OrderService.pickupHandoffMessage(o);
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/orders']);
      return;
    }
    this.loadOrder(id);
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
    if (!o || !this.canConfirmPickup()) return;
    this.isProcessing.set(true);
    this.orderService.confirmOrderReceived(o.id).subscribe({
      next: () => this.refreshOrder(o.id),
      error: (err) => {
        this.isProcessing.set(false);
        this.messageService.add({
          severity: 'warn',
          summary: 'Cannot confirm yet',
          detail:
            err?.error?.message ??
            'This order cannot be confirmed yet. Please wait until the merchant marks it as picked up.',
          life: 6000,
        });
      },
    });
  }

  openDisputeDialog(): void {
    this.disputeReason.set('');
    this.disputeNotes.set('');
    this.disputeEvidence.set([]);
    this.disputeError.set(null);
    this.disputeDialogOpen.set(true);
  }

  closeDisputeDialog(): void {
    this.disputeDialogOpen.set(false);
  }

  onEvidenceSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files).slice(0, 10) : [];
    this.disputeEvidence.set(files);
  }

  submitDispute(): void {
    const o = this.order();
    if (!o || !this.canOpenDispute()) return;

    const reason = this.disputeReason().trim();
    if (reason.length < 3) {
      this.disputeError.set('Reason must be at least 3 characters.');
      return;
    }

    const formData = new FormData();
    formData.append('reason', reason.slice(0, 200));
    const notes = this.disputeNotes().trim();
    if (notes) formData.append('customerNotes', notes);
    for (const file of this.disputeEvidence()) {
      formData.append('evidence', file);
    }

    this.isProcessing.set(true);
    this.disputeError.set(null);
    this.orderService.openOrderDispute(o.id, formData).subscribe({
      next: () => {
        this.disputeDialogOpen.set(false);
        this.loadDisputes(o.id);
        this.refreshOrder(o.id);
      },
      error: (err) => {
        this.isProcessing.set(false);
        this.disputeError.set(
          err?.error?.message ?? 'Could not open dispute. Please try again.',
        );
      },
    });
  }

  private loadOrder(id: string): void {
    this.orderService.getOrderById(id, true).subscribe((o) => {
      if (!o) {
        this.router.navigate(['/orders']);
        return;
      }
      this.order.set(o);
      this.orderService.selectOrder(o);
      this.loadDisputes(id);
    });
  }

  private loadDisputes(orderId: string): void {
    this.disputesLoading.set(true);
    this.disputesLoadError.set(null);
    this.orderService.getOrderDisputes(orderId).subscribe({
      next: (rows) => {
        this.disputes.set(rows);
        this.disputesLoading.set(false);
      },
      error: () => {
        this.disputes.set([]);
        this.disputesLoadError.set(
          'Could not verify this order’s dispute status. Actions remain disabled.',
        );
        this.disputesLoading.set(false);
      },
    });
  }

  retryDisputes(): void {
    const orderId = this.order()?.id;
    if (orderId) this.loadDisputes(orderId);
  }

  private refreshOrder(id: string): void {
    this.orderService.getOrderById(id, true).subscribe((newOrder) => {
      if (newOrder) {
        this.order.set(newOrder);
      }
      this.loadDisputes(id);
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

  getItemTotalPv(item: Order['items'][number]): number {
    return item.pv * item.quantity;
  }

  getItemTotalDirectReferralPv(item: Order['items'][number]): number {
    return item.directReferralPv * item.quantity;
  }

  getItemTotalCpv(item: Order['items'][number]): number {
    return item.cpv * item.quantity;
  }

  getOrderTotalPv(order: Order): number {
    return order.items.reduce((sum, item) => sum + this.getItemTotalPv(item), 0);
  }

  getOrderTotalDirectReferralPv(order: Order): number {
    return order.items.reduce((sum, item) => sum + this.getItemTotalDirectReferralPv(item), 0);
  }

  getOrderTotalCpv(order: Order): number {
    return order.items.reduce((sum, item) => sum + this.getItemTotalCpv(item), 0);
  }

  getFulfilmentLabel(method: Order['fulfilmentMethod']): string {
    return method === 'pickup' ? 'Pickup' : 'Home Delivery';
  }

  onViewReceipt(): void {
    const o = this.order();
    if (!o?.paymentId) return;
    this.invoiceService.openInvoice(o.paymentId);
  }
}
