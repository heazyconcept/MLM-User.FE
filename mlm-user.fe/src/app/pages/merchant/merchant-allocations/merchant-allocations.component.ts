import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';

import {
  MerchantService,
  type MerchantAllocation,
  type MerchantStockDispute,
} from '../../../services/merchant.service';
import { StatusBadgeComponent } from '../../../components/status-badge/status-badge.component';
import { UiTableComponent } from '../../../components/table/table-component';

type AllocationFilter = 'all' | 'needs_action';

@Component({
  selector: 'app-merchant-allocations',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ButtonModule,
    DialogModule,
    StatusBadgeComponent,
    UiTableComponent,
  ],
  templateUrl: './merchant-allocations.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host ::ng-deep .merchant-allocations-table .p-datatable-wrapper {
        border-radius: 0;
      }
    `,
  ],
})
export class MerchantAllocationsComponent implements OnInit {
  private merchantService = inject(MerchantService);

  readonly MerchantService = MerchantService;
  readonly actionableCount = this.merchantService.actionableAllocationCount;

  allocations = this.merchantService.allocations;
  stockDisputes = this.merchantService.stockDisputes;
  loading = this.merchantService.loading;
  actionLoading = this.merchantService.actionLoading;
  error = this.merchantService.error;

  filter = signal<AllocationFilter>('all');
  confirmDialogVisible = signal(false);
  selectedAllocation = signal<MerchantAllocation | null>(null);
  quantityReceived = signal(0);
  merchantNotes = signal('');
  evidenceFiles = signal<File[]>([]);
  formError = signal<string | null>(null);

  readonly tableHeaders = ['Product', 'Qty', 'Status', 'Tracking', 'Timeline', 'Action'];
  readonly maxEvidenceFiles = 10;

  readonly rejectedDisputes = computed(() =>
    this.stockDisputes().filter((d) => MerchantService.needsDisputeAcknowledgement(d)),
  );

  readonly filteredAllocations = computed(() => {
    const rows = this.allocations();
    if (this.filter() === 'needs_action') {
      return rows.filter(
        (row) =>
          MerchantService.canConfirmReceipt(row) ||
          (row.dispute != null && MerchantService.needsDisputeAcknowledgement(row.dispute)),
      );
    }
    return rows;
  });

  readonly hasActionableItems = computed(
    () => this.merchantService.actionableAllocationCount() > 0,
  );

  ngOnInit(): void {
    this.merchantService.fetchAllocations();
    this.merchantService.fetchStockDisputes();
  }

  setFilter(value: AllocationFilter): void {
    this.filter.set(value);
  }

  productLabel(alloc: MerchantAllocation): string {
    return alloc.productName || alloc.product?.name || '—';
  }

  productSku(alloc: MerchantAllocation): string {
    return alloc.product?.sku ?? '—';
  }

  statusForBadge(status: string): string {
    return status.replace(/_/g, ' ');
  }

  timelineLabel(alloc: MerchantAllocation): string {
    if (alloc.receivedAt) return `Received ${this.formatDate(alloc.receivedAt)}`;
    if (alloc.deliveredAt) return `Delivered ${this.formatDate(alloc.deliveredAt)}`;
    if (alloc.inTransitAt) return `In transit ${this.formatDate(alloc.inTransitAt)}`;
    if (alloc.dispatchedAt) return `Dispatched ${this.formatDate(alloc.dispatchedAt)}`;
    if (alloc.createdAt) return `Created ${this.formatDate(alloc.createdAt)}`;
    return '—';
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  openConfirmReceipt(alloc: MerchantAllocation): void {
    this.selectedAllocation.set(alloc);
    this.quantityReceived.set(alloc.quantity);
    this.merchantNotes.set('');
    this.evidenceFiles.set([]);
    this.formError.set(null);
    this.confirmDialogVisible.set(true);
  }

  closeConfirmReceipt(): void {
    if (this.actionLoading()) return;
    this.confirmDialogVisible.set(false);
    this.selectedAllocation.set(null);
    this.formError.set(null);
  }

  onEvidenceSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []).slice(0, this.maxEvidenceFiles);
    this.evidenceFiles.set(files);
    this.formError.set(null);
  }

  requiresEvidence(): boolean {
    const alloc = this.selectedAllocation();
    if (!alloc) return false;
    return this.quantityReceived() < alloc.quantity;
  }

  submitConfirmReceipt(): void {
    const alloc = this.selectedAllocation();
    if (!alloc) return;

    const qty = this.quantityReceived();
    if (!Number.isFinite(qty) || qty < 0) {
      this.formError.set('Enter a valid quantity received.');
      return;
    }
    if (qty > alloc.quantity) {
      this.formError.set(`Quantity cannot exceed ${alloc.quantity} dispatched.`);
      return;
    }
    if (qty < alloc.quantity && this.evidenceFiles().length === 0) {
      this.formError.set('Upload evidence when reporting fewer items than dispatched.');
      return;
    }

    this.merchantService
      .confirmAllocationReceipt(alloc.id, {
        quantityReceived: qty,
        merchantNotes: this.merchantNotes(),
        evidenceFiles: this.evidenceFiles(),
      })
      .subscribe({
        next: () => this.closeConfirmReceipt(),
        error: () => {
          this.formError.set(this.error() ?? 'Could not confirm receipt.');
        },
      });
  }

  acknowledgeDispute(dispute: MerchantStockDispute | NonNullable<MerchantAllocation['dispute']>): void {
    this.merchantService.acknowledgeStockDispute(dispute.id);
  }

  disputeForAllocation(alloc: MerchantAllocation): MerchantStockDispute | null {
    if (alloc.dispute) return alloc.dispute;
    return (
      this.stockDisputes().find((d) => d.allocationId === alloc.id) ??
      null
    );
  }

  waitingMessage(alloc: MerchantAllocation): string {
    switch (alloc.status) {
      case 'PENDING':
        return 'Awaiting admin dispatch';
      case 'DISPATCHED':
      case 'IN_TRANSIT':
        return 'Awaiting delivery';
      case 'RECEIVED':
      case 'ACCEPTED':
        return 'Stock credited';
      case 'CANCELLED':
        return 'Cancelled';
      default:
        return '—';
    }
  }
}
