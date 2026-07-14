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

import {
  MerchantService,
  type MerchantAllocation,
  type MerchantHandoverStatus,
} from '../../../services/merchant.service';
import { StatusBadgeComponent } from '../../../components/status-badge/status-badge.component';
import { UiTableComponent } from '../../../components/table/table-component';

@Component({
  selector: 'app-merchant-handovers',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ButtonModule,
    DialogModule,
    StatusBadgeComponent,
    UiTableComponent,
  ],
  templateUrl: './merchant-handovers.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host ::ng-deep .merchant-handovers-table .p-datatable-wrapper {
        border-radius: 0;
      }

      :host ::ng-deep .merchant-handovers-table .p-datatable-tbody > tr > td.table-cell-center {
        text-align: center;
        vertical-align: middle;
      }

      :host ::ng-deep .merchant-handovers-table .table-cell-center .cell-value {
        align-items: center;
        justify-content: center;
      }

      :host ::ng-deep .merchant-handovers-table .table-cell-action .cell-value {
        flex-direction: row;
        flex-wrap: wrap;
        gap: 0.5rem;
      }

      @media (max-width: 1023px) {
        :host ::ng-deep .merchant-handovers-table .table-cell-action .cell-value {
          align-items: stretch;
          width: 100%;
        }

        :host ::ng-deep .merchant-handovers-table .table-cell-action .p-button {
          width: 100%;
          justify-content: center;
        }
      }
    `,
  ],
})
export class MerchantHandoversComponent implements OnInit {
  private merchantService = inject(MerchantService);
  private actionWasLoading = false;

  readonly MerchantService = MerchantService;

  requests = this.merchantService.handoverRequests;
  loading = this.merchantService.loading;
  actionLoading = this.merchantService.actionLoading;
  error = this.merchantService.error;
  actionableCount = this.merchantService.actionableHandoverRequestCount;

  rejectDialogVisible = signal(false);
  selectedRequest = signal<MerchantAllocation | null>(null);
  rejectReason = signal('');
  formError = signal<string | null>(null);
  pendingActionKey = signal<string | null>(null);

  readonly tableHeaders = ['Product', 'Qty', 'Receiver', 'Status', 'Action'];

  constructor() {
    effect(() => {
      const loading = this.actionLoading();
      if (this.actionWasLoading && !loading) {
        this.pendingActionKey.set(null);
      }
      this.actionWasLoading = loading;
    });
  }

  readonly sortedRequests = computed(() => {
    const rank: Record<string, number> = {
      REQUESTED: 0,
      ADMIN_APPROVED: 1,
      SUPPLIER_APPROVED: 2,
      READY_FOR_PICKUP: 3,
      COMPLETED: 4,
      REJECTED: 5,
      NONE: 6,
    };
    return [...this.requests()].sort(
      (a, b) => (rank[a.handoverStatus] ?? 9) - (rank[b.handoverStatus] ?? 9),
    );
  });

  ngOnInit(): void {
    this.merchantService.fetchHandoverRequests();
  }

  productLabel(alloc: MerchantAllocation): string {
    return alloc.productName || alloc.product?.name || '—';
  }

  receiverLabel(alloc: MerchantAllocation): string {
    const receiver = alloc.receiverMerchant;
    if (!receiver) return '—';
    return receiver.businessName || receiver.phoneNumber || 'Merchant';
  }

  receiverDetail(alloc: MerchantAllocation): string {
    const receiver = alloc.receiverMerchant;
    if (!receiver) return '';
    const parts = [receiver.type, receiver.phoneNumber, receiver.address].filter(Boolean);
    return parts.join(' · ');
  }

  handoverStatusForBadge(status: MerchantHandoverStatus | undefined): string {
    return MerchantService.handoverStatusLabel(status ?? 'NONE');
  }

  actionKey(allocId: string, action: string): string {
    return `${allocId}:${action}`;
  }

  isPending(key: string): boolean {
    return this.pendingActionKey() === key && this.actionLoading();
  }

  beginAction(key: string): void {
    this.pendingActionKey.set(key);
  }

  approve(alloc: MerchantAllocation): void {
    this.formError.set(null);
    this.beginAction(this.actionKey(alloc.id, 'approve'));
    this.merchantService.approveHandoverRequest(alloc.id).subscribe((res) => {
      if (!res) {
        this.formError.set(this.error() || 'Could not approve request.');
      }
    });
  }

  openReject(alloc: MerchantAllocation): void {
    this.selectedRequest.set(alloc);
    this.rejectReason.set('');
    this.formError.set(null);
    this.rejectDialogVisible.set(true);
  }

  closeReject(): void {
    this.rejectDialogVisible.set(false);
    this.selectedRequest.set(null);
    this.rejectReason.set('');
    this.formError.set(null);
  }

  submitReject(): void {
    const alloc = this.selectedRequest();
    if (!alloc) return;
    this.beginAction(this.actionKey(alloc.id, 'reject'));
    this.merchantService.rejectHandoverRequest(alloc.id, this.rejectReason()).subscribe((res) => {
      if (res) {
        this.closeReject();
        return;
      }
      this.formError.set(this.error() || 'Could not reject request.');
    });
  }

  markReady(alloc: MerchantAllocation): void {
    this.formError.set(null);
    this.beginAction(this.actionKey(alloc.id, 'mark-ready'));
    this.merchantService.markHandoverReady(alloc.id).subscribe((res) => {
      if (!res) {
        this.formError.set(this.error() || 'Could not mark ready for pickup.');
      }
    });
  }
}
