import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { TextareaModule } from 'primeng/textarea';

import {
  MerchantService,
  type MerchantAllocation,
  type MerchantEligibleSupplier,
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
    InputNumberModule,
    TextareaModule,
    StatusBadgeComponent,
    UiTableComponent,
  ],
  templateUrl: './merchant-allocations.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host ::ng-deep .merchant-allocations-table .p-datatable-wrapper,
      :host ::ng-deep .merchant-allocations-table .p-datatable-table-container {
        border-radius: 0;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }

      /* Keep a real table on all viewports (never stack into cards). */
      :host ::ng-deep .merchant-allocations-table .p-datatable-table {
        display: table !important;
        width: 100%;
        border-collapse: collapse;
      }

      :host ::ng-deep .merchant-allocations-table .p-datatable-thead {
        display: table-header-group !important;
      }

      :host ::ng-deep .merchant-allocations-table .p-datatable-tbody {
        display: table-row-group !important;
      }

      :host ::ng-deep .merchant-allocations-table .p-datatable-thead > tr,
      :host ::ng-deep .merchant-allocations-table .p-datatable-tbody > tr {
        display: table-row !important;
      }

      :host ::ng-deep .merchant-allocations-table .p-datatable-thead > tr > th,
      :host ::ng-deep .merchant-allocations-table .p-datatable-tbody > tr > td {
        display: table-cell !important;
        vertical-align: middle;
      }

      :host ::ng-deep .merchant-allocations-table .p-datatable-tbody > tr > td::before {
        content: none !important;
      }

      :host ::ng-deep .merchant-allocations-table .p-datatable-tbody > tr > td.table-cell-center {
        text-align: center;
        vertical-align: middle;
      }

      :host ::ng-deep .merchant-allocations-table .table-cell-action {
        min-width: 10rem;
      }

      :host ::ng-deep .merchant-allocations-table .table-cell-action .p-button {
        white-space: nowrap;
      }
    `,
  ],
})
export class MerchantAllocationsComponent implements OnInit {
  private merchantService = inject(MerchantService);
  private actionWasLoading = false;

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

  supplierDialogVisible = signal(false);
  eligibleSuppliers = signal<MerchantEligibleSupplier[]>([]);
  suppliersLoading = signal(false);
  handoverFormError = signal<string | null>(null);
  confirmHandoverDialogVisible = signal(false);
  pendingActionKey = signal<string | null>(null);

  stockRequestModalVisible = signal(false);
  stockRequestQuantity = signal(1);
  stockRequestNotes = signal('');
  stockRequestFormError = signal<string | null>(null);
  stockRequestSuccessMessage = signal<string | null>(null);

  readonly tableHeaders = ['Product', 'Qty', 'Status', 'Tracking', 'Timeline', 'Action'];
  readonly maxEvidenceFiles = 10;
  readonly pendingStockRequestProductIds = this.merchantService.pendingStockRequestProductIds;

  constructor() {
    effect(() => {
      const loading = this.actionLoading();
      if (this.actionWasLoading && !loading) {
        this.pendingActionKey.set(null);
      }
      this.actionWasLoading = loading;
    });
  }

  readonly rejectedDisputes = computed(() =>
    this.stockDisputes().filter((d) => MerchantService.needsDisputeAcknowledgement(d)),
  );

  readonly filteredAllocations = computed(() => {
    const rows = this.allocations();
    if (this.filter() === 'needs_action') {
      return rows.filter(
        (row) =>
          MerchantService.canConfirmReceipt(row) ||
          MerchantService.canRequestHandover(row) ||
          MerchantService.canConfirmHandoverReceipt(row) ||
          (row.dispute != null && MerchantService.needsDisputeAcknowledgement(row.dispute)),
      );
    }
    return rows;
  });

  readonly hasActionableItems = computed(
    () => this.merchantService.actionableAllocationCount() > 0,
  );

  readonly canSubmitStockRequest = computed(() => {
    const alloc = this.selectedAllocation();
    if (!alloc?.productId) return false;
    if (this.hasPendingStockRequest(alloc.productId)) return false;
    const qty = this.stockRequestQuantity();
    return Number.isInteger(qty) && qty >= 1 && qty <= 10000;
  });

  ngOnInit(): void {
    this.merchantService.fetchAllocations();
    this.merchantService.fetchStockDisputes();
    this.merchantService.fetchStockRequests();
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

  allocationStatusForBadge(alloc: MerchantAllocation): string {
    return MerchantService.allocationStatusLabel(alloc.status);
  }

  actionKey(parts: string[]): string {
    return parts.join(':');
  }

  isPending(key: string): boolean {
    return this.pendingActionKey() === key && this.actionLoading();
  }

  beginAction(key: string): void {
    this.pendingActionKey.set(key);
  }

  timelineLabel(alloc: MerchantAllocation): string {
    if (alloc.handoverReadyAt) return `Ready ${this.formatDate(alloc.handoverReadyAt)}`;
    if (alloc.adminApprovedAt) return `Admin approved ${this.formatDate(alloc.adminApprovedAt)}`;
    if (alloc.supplierApprovedAt)
      return `Supplier approved ${this.formatDate(alloc.supplierApprovedAt)}`;
    if (alloc.handoverRejectedAt)
      return `Handover rejected ${this.formatDate(alloc.handoverRejectedAt)}`;
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

  supplierPickupLabel(alloc: MerchantAllocation): string {
    const supplier = alloc.sourceMerchant;
    if (!supplier) return '';
    const parts = [supplier.businessName, supplier.address, supplier.phoneNumber].filter(Boolean);
    return parts.join(' · ');
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

    this.beginAction(this.actionKey(['dialog', alloc.id, 'confirm-receipt']));
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

  openPickFromMerchant(alloc: MerchantAllocation): void {
    this.selectedAllocation.set(alloc);
    this.eligibleSuppliers.set([]);
    this.handoverFormError.set(null);
    this.stockRequestSuccessMessage.set(null);
    this.suppliersLoading.set(true);
    this.supplierDialogVisible.set(true);
    this.merchantService.fetchEligibleHandoverSuppliers(alloc.id).subscribe((suppliers) => {
      this.eligibleSuppliers.set(suppliers);
      this.suppliersLoading.set(false);
      if (suppliers.length === 0 && !this.error()) {
        this.handoverFormError.set(
          'No eligible higher-tier merchants with matching coverage and stock right now.',
        );
      }
    });
  }

  closeSupplierDialog(): void {
    this.supplierDialogVisible.set(false);
    this.selectedAllocation.set(null);
    this.eligibleSuppliers.set([]);
    this.handoverFormError.set(null);
    this.stockRequestSuccessMessage.set(null);
    this.closeStockRequestModal();
  }

  hasPendingStockRequest(productId: string): boolean {
    return this.pendingStockRequestProductIds().has(productId);
  }

  openStockRequestFromHandover(): void {
    const alloc = this.selectedAllocation();
    if (!alloc?.productId || this.hasPendingStockRequest(alloc.productId)) return;

    this.stockRequestFormError.set(null);
    this.stockRequestSuccessMessage.set(null);
    this.merchantService.clearError();
    this.stockRequestQuantity.set(Math.max(1, Math.min(10000, alloc.quantity || 1)));
    this.stockRequestNotes.set('');
    this.stockRequestModalVisible.set(true);
  }

  closeStockRequestModal(): void {
    this.stockRequestModalVisible.set(false);
    this.stockRequestFormError.set(null);
  }

  submitStockRequest(): void {
    const alloc = this.selectedAllocation();
    if (!alloc?.productId || !this.canSubmitStockRequest()) return;

    this.stockRequestFormError.set(null);
    this.merchantService.clearError();

    const notes = this.stockRequestNotes().trim();
    this.beginAction(this.actionKey(['dialog', alloc.id, 'stock-request']));
    this.merchantService
      .createStockRequest({
        productId: alloc.productId,
        quantity: Math.floor(this.stockRequestQuantity()),
        ...(notes ? { notes } : {}),
      })
      .subscribe((allocation) => {
        if (allocation) {
          this.stockRequestSuccessMessage.set(
            'Stock request submitted. Admin will dispatch when available.',
          );
          this.closeStockRequestModal();
          this.merchantService.fetchStockRequests();
          return;
        }
        this.stockRequestFormError.set(this.error() ?? 'Could not submit stock request.');
      });
  }

  requestHandoverFrom(supplier: MerchantEligibleSupplier): void {
    const alloc = this.selectedAllocation();
    if (!alloc) return;
    this.handoverFormError.set(null);
    this.beginAction(this.actionKey(['dialog', alloc.id, 'request', supplier.id]));
    this.merchantService.requestHandover(alloc.id, supplier.id).subscribe((res) => {
      if (res) {
        this.closeSupplierDialog();
        return;
      }
      this.handoverFormError.set(this.error() || 'Could not request handover.');
    });
  }

  openConfirmHandoverReceipt(alloc: MerchantAllocation): void {
    this.selectedAllocation.set(alloc);
    this.handoverFormError.set(null);
    this.confirmHandoverDialogVisible.set(true);
  }

  closeConfirmHandoverReceipt(): void {
    this.confirmHandoverDialogVisible.set(false);
    this.selectedAllocation.set(null);
    this.handoverFormError.set(null);
  }

  submitConfirmHandoverReceipt(): void {
    const alloc = this.selectedAllocation();
    if (!alloc) return;
    this.handoverFormError.set(null);
    this.beginAction(this.actionKey(['dialog', alloc.id, 'confirm-handover']));
    this.merchantService.confirmHandoverReceipt(alloc.id).subscribe((res) => {
      if (res) {
        this.closeConfirmHandoverReceipt();
        return;
      }
      this.handoverFormError.set(this.error() || 'Could not confirm handover receipt.');
    });
  }

  acknowledgeDispute(dispute: MerchantStockDispute | NonNullable<MerchantAllocation['dispute']>): void {
    this.beginAction(this.actionKey(['dispute', dispute.id, 'acknowledge']));
    this.merchantService.acknowledgeStockDispute(dispute.id);
  }

  disputeForAllocation(alloc: MerchantAllocation): MerchantStockDispute | null {
    if (alloc.dispute) return alloc.dispute;
    return this.stockDisputes().find((d) => d.allocationId === alloc.id) ?? null;
  }

  waitingMessage(alloc: MerchantAllocation): string {
    if (alloc.handoverStatus && alloc.handoverStatus !== 'NONE') {
      if (alloc.handoverStatus === 'REJECTED') {
        return alloc.handoverRejectReason
          ? `Handover rejected: ${alloc.handoverRejectReason}`
          : 'Handover rejected — you can request again';
      }
      if (MerchantService.isHandoverActive(alloc) || alloc.handoverStatus === 'COMPLETED') {
        return MerchantService.handoverStatusLabel(alloc.handoverStatus);
      }
    }

    switch (alloc.status) {
      case 'PENDING':
        return MerchantService.isHandoverActive(alloc)
          ? 'Warehouse dispatch paused — handover in progress'
          : 'Awaiting admin dispatch or pick from merchant';
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
