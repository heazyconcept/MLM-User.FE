import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  MerchantService,
  INVENTORY_ADJUSTMENT_REASON_MIN_LENGTH,
  type MerchantInventoryItem,
  type StockStatus,
  type InventoryAdjustmentType,
} from '../../../services/merchant.service';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { TextareaModule } from 'primeng/textarea';

type InventoryTab = 'stock' | 'disputes';

@Component({
  selector: 'app-merchant-inventory',
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    DialogModule,
    InputNumberModule,
    ButtonModule,
    MessageModule,
    TextareaModule,
  ],
  templateUrl: './merchant-inventory.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host ::ng-deep .inventory-edit-dialog .p-dialog-content {
        padding: 1rem;
      }

      @media (min-width: 640px) {
        :host ::ng-deep .inventory-edit-dialog .p-dialog-content {
          padding: 1.25rem 1.5rem;
        }
      }

      :host ::ng-deep .inventory-qty-input,
      :host ::ng-deep .inventory-qty-input .p-inputnumber,
      :host ::ng-deep .inventory-qty-input .p-inputnumber-input {
        width: 100%;
      }

      :host ::ng-deep .inventory-qty-input .p-inputnumber-button {
        min-width: 2.75rem;
      }
    `,
  ],
})
export class MerchantInventoryComponent implements OnInit {
  private merchantService = inject(MerchantService);

  readonly MerchantService = MerchantService;
  readonly reasonMinLength = INVENTORY_ADJUSTMENT_REASON_MIN_LENGTH;

  inventory = this.merchantService.inventory;
  inventoryDisputes = this.merchantService.inventoryAdjustmentDisputes;
  loading = this.merchantService.loading;
  actionLoading = this.merchantService.actionLoading;
  error = this.merchantService.error;
  openDisputesCount = this.merchantService.openInventoryAdjustmentDisputesCount;

  activeTab = signal<InventoryTab>('stock');

  editModalVisible = signal(false);
  editItem = signal<MerchantInventoryItem | null>(null);
  editQuantity = signal(0);
  editReason = signal('');
  formError = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  readonly sortedDisputes = computed(() =>
    [...this.inventoryDisputes()].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    }),
  );

  readonly editAuthorizedQuantity = computed(
    () => this.editItem()?.authorizedQuantity ?? 0,
  );

  readonly editOriginalQuantity = computed(() => this.editItem()?.stockQuantity ?? 0);

  readonly requiresAdjustmentDispute = computed(() => {
    return this.editQuantity() !== this.editAuthorizedQuantity();
  });

  readonly adjustmentType = computed((): InventoryAdjustmentType | null => {
    if (!this.requiresAdjustmentDispute()) return null;
    return MerchantService.resolveAdjustmentType(
      this.editAuthorizedQuantity(),
      this.editQuantity(),
    );
  });

  readonly reasonValid = computed(
    () => this.editReason().trim().length >= INVENTORY_ADJUSTMENT_REASON_MIN_LENGTH,
  );

  readonly canSaveEdit = computed(() => {
    if (this.actionLoading() || !this.editItem()) return false;
    if (this.editItem()?.hasOpenAdjustmentDispute) return false;
    if (this.editQuantity() === this.editOriginalQuantity()) return false;

    if (this.requiresAdjustmentDispute()) {
      return this.reasonValid();
    }

    return true;
  });

  ngOnInit(): void {
    this.merchantService.fetchInventory();
    this.merchantService.fetchInventoryAdjustmentDisputes();
  }

  setTab(tab: InventoryTab): void {
    this.activeTab.set(tab);
    if (tab === 'disputes') {
      this.merchantService.fetchInventoryAdjustmentDisputes();
    }
  }

  onEditStock(item: MerchantInventoryItem): void {
    if (item.hasOpenAdjustmentDispute) return;

    this.formError.set(null);
    this.successMessage.set(null);
    this.editItem.set(item);
    this.editQuantity.set(item.stockQuantity);
    this.editReason.set('');
    this.editModalVisible.set(true);
  }

  onSaveStock(): void {
    const item = this.editItem();
    if (!item || !this.canSaveEdit()) return;

    this.formError.set(null);
    this.successMessage.set(null);

    const newQty = Math.max(0, Math.floor(this.editQuantity()));
    const originalQty = item.stockQuantity;
    const authorizedQty = item.authorizedQuantity;

    if (newQty !== authorizedQty) {
      const reason = this.editReason().trim();
      if (reason.length < INVENTORY_ADJUSTMENT_REASON_MIN_LENGTH) {
        this.formError.set(
          `Please write a short explanation (at least ${INVENTORY_ADJUSTMENT_REASON_MIN_LENGTH} characters).`,
        );
        return;
      }

      this.merchantService
        .submitInventoryAdjustmentRequest(item.productId, {
          requestedQuantity: newQty,
          adjustmentType: MerchantService.resolveAdjustmentType(authorizedQty, newQty),
          reason,
        })
        .subscribe((dispute) => {
          if (dispute) {
            this.successMessage.set(
              'Your request was sent. We will review it and update your stock if approved. Check Change requests for updates.',
            );
            this.closeModal();
            this.activeTab.set('disputes');
          }
        });
      return;
    }

    if (newQty === originalQty) {
      this.closeModal();
      return;
    }

    this.merchantService.updateStock(item.productId, { stockQuantity: newQty }).subscribe(() => {
      if (!this.error()) {
        this.successMessage.set('Stock updated successfully.');
        this.closeModal();
      }
    });
  }

  closeModal(): void {
    this.editModalVisible.set(false);
    this.editItem.set(null);
    this.formError.set(null);
  }

  getStockStatusLabel(status: StockStatus | null): string {
    return this.merchantService.getStockStatusLabel(status);
  }

  getStockStatusClass(status: StockStatus | null): string {
    if (status === 'IN_STOCK') return 'text-green-600 bg-green-50';
    if (status === 'LOW_STOCK') return 'text-amber-600 bg-amber-50';
    if (status === 'OUT_OF_STOCK') return 'text-red-600 bg-red-50';
    return 'text-gray-500 bg-gray-50';
  }

  getDisputeStatusClass(status: string): string {
    if (status === 'OPEN') return 'text-amber-700 bg-amber-50';
    if (status === 'ADMIN_APPROVED') return 'text-green-700 bg-green-50';
    if (status === 'ADMIN_REJECTED') return 'text-red-700 bg-red-50';
    return 'text-gray-600 bg-gray-50';
  }

  formatDate(value?: string | null): string {
    if (!value) return '—';
    return new Date(value).toLocaleString();
  }

  quantityMismatch(item: MerchantInventoryItem): boolean {
    return item.stockQuantity !== item.authorizedQuantity;
  }

  adjustmentTypeLabel(type: InventoryAdjustmentType): string {
    return type === 'INCREASE' ? 'Adding units' : 'Removing units';
  }
}
