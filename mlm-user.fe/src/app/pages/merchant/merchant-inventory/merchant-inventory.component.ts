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
import {
  MerchantService,
  INVENTORY_ADJUSTMENT_REASON_MIN_LENGTH,
  INVENTORY_MOVEMENT_TYPE_FILTER_OPTIONS,
  INVENTORY_MOVEMENT_DIRECTION_FILTER_OPTIONS,
  type MerchantInventoryItem,
  type MerchantAllocation,
  type MerchantInventoryMovement,
  type MerchantInventoryMovementDirection,
  type StockStatus,
  type InventoryAdjustmentType,
  type AllocationStatus,
} from '../../../services/merchant.service';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';

type InventoryTab = 'stock' | 'topups' | 'disputes' | 'movements';

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
    SelectModule,
    DatePickerModule,
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
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly MerchantService = MerchantService;
  readonly reasonMinLength = INVENTORY_ADJUSTMENT_REASON_MIN_LENGTH;
  readonly movementTypeOptions = INVENTORY_MOVEMENT_TYPE_FILTER_OPTIONS;
  readonly directionOptions = INVENTORY_MOVEMENT_DIRECTION_FILTER_OPTIONS;

  inventory = this.merchantService.inventory;
  inventoryDisputes = this.merchantService.inventoryAdjustmentDisputes;
  stockRequests = this.merchantService.stockRequests;
  pendingStockRequestProductIds = this.merchantService.pendingStockRequestProductIds;
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

  stockRequestModalVisible = signal(false);
  stockRequestItem = signal<MerchantInventoryItem | null>(null);
  stockRequestQuantity = signal(1);
  stockRequestNotes = signal('');
  stockRequestFormError = signal<string | null>(null);

  movements = signal<MerchantInventoryMovement[]>([]);
  movementsLoading = signal(false);
  movementsError = signal<string | null>(null);
  movementsNotAvailable = signal(false);
  movementsTotal = signal(0);
  movementsOffset = signal(0);
  movementsLoaded = signal(false);
  readonly movementsLimit = 50;

  filterProductId = signal('');
  filterMovementType = signal('');
  filterDirection = signal<MerchantInventoryMovementDirection | ''>('');
  filterDateRange = signal<Date[] | null>(null);
  filterSearch = signal('');
  expandedMovementIds = signal<Set<string>>(new Set());

  readonly sortedDisputes = computed(() =>
    [...this.inventoryDisputes()].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    }),
  );

  readonly sortedStockRequests = computed(() =>
    [...this.stockRequests()].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    }),
  );

  readonly pendingTopupsCount = computed(() => this.pendingStockRequestProductIds().size);

  readonly productFilterOptions = computed(() => [
    { label: 'All products', value: '' },
    ...this.inventory().map((item) => ({
      label: item.productName,
      value: item.productId,
    })),
  ]);

  readonly movementsHasMore = computed(
    () => this.movements().length < this.movementsTotal(),
  );

  readonly editAuthorizedQuantity = computed(() => this.editItem()?.authorizedQuantity ?? 0);

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

  readonly canSubmitStockRequest = computed(() => {
    const item = this.stockRequestItem();
    if (!item || this.actionLoading()) return false;
    if (this.hasPendingStockRequest(item.productId)) return false;
    const qty = this.stockRequestQuantity();
    return Number.isInteger(qty) && qty >= 1 && qty <= 10000;
  });

  ngOnInit(): void {
    this.merchantService.fetchInventory();
    this.merchantService.fetchInventoryAdjustmentDisputes();
    this.merchantService.fetchStockRequests();

    const tab = this.route.snapshot.queryParamMap.get('tab');
    const productId = this.route.snapshot.queryParamMap.get('productId');
    if (productId) this.filterProductId.set(productId);

    if (tab === 'movements') {
      this.activeTab.set('movements');
      this.loadMovements(true);
    } else if (tab === 'topups') {
      this.activeTab.set('topups');
    } else if (tab === 'disputes') {
      this.activeTab.set('disputes');
    }
  }

  setTab(tab: InventoryTab): void {
    this.activeTab.set(tab);
    if (tab === 'disputes') {
      this.merchantService.fetchInventoryAdjustmentDisputes();
    }
    if (tab === 'topups') {
      this.merchantService.fetchStockRequests();
    }
    if (tab === 'movements') {
      if (!this.movementsLoaded()) {
        this.loadMovements(true);
      }
    }

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        tab: tab === 'stock' ? null : tab,
        productId:
          tab === 'movements' && this.filterProductId() ? this.filterProductId() : null,
      },
      queryParamsHandling: 'merge',
    });
  }

  viewProductHistory(productId: string): void {
    this.filterProductId.set(productId);
    this.activeTab.set('movements');
    this.loadMovements(true);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: 'movements', productId },
      queryParamsHandling: 'merge',
    });
  }

  loadMovements(reset: boolean): void {
    if (reset) {
      this.movementsOffset.set(0);
      this.expandedMovementIds.set(new Set());
    }

    this.movementsLoading.set(true);
    this.movementsError.set(null);

    const range = this.filterDateRange();
    let from: string | undefined;
    let to: string | undefined;
    if (range && range.length >= 2 && range[0] && range[1]) {
      const start = new Date(range[0]);
      start.setHours(0, 0, 0, 0);
      const end = new Date(range[1]);
      end.setHours(23, 59, 59, 999);
      from = start.toISOString();
      to = end.toISOString();
    }

    this.merchantService
      .loadInventoryMovements({
        productId: this.filterProductId() || undefined,
        movementType: this.filterMovementType() || undefined,
        direction: this.filterDirection() || undefined,
        search: this.filterSearch().trim() || undefined,
        from,
        to,
        limit: this.movementsLimit,
        offset: this.movementsOffset(),
      })
      .subscribe({
        next: (res) => {
          this.movementsLoading.set(false);
          this.movementsNotAvailable.set(res.notAvailable ?? false);
          if (reset) {
            this.movements.set(res.items);
          } else {
            this.movements.update((prev) => [...prev, ...res.items]);
          }
          this.movementsTotal.set(res.total);
          this.movementsLoaded.set(true);
        },
        error: () => {
          this.movementsLoading.set(false);
          this.movementsError.set('Failed to load movement log.');
        },
      });
  }

  applyMovementFilters(): void {
    this.loadMovements(true);
  }

  clearMovementFilters(): void {
    this.filterProductId.set('');
    this.filterMovementType.set('');
    this.filterDirection.set('');
    this.filterDateRange.set(null);
    this.filterSearch.set('');
    this.loadMovements(true);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: 'movements', productId: null },
      queryParamsHandling: 'merge',
    });
  }

  loadMoreMovements(): void {
    this.movementsOffset.update((offset) => offset + this.movementsLimit);
    this.loadMovements(false);
  }

  toggleMovementExpanded(movement: MerchantInventoryMovement): void {
    if (!movement.id) return;
    this.expandedMovementIds.update((set) => {
      const next = new Set(set);
      if (next.has(movement.id)) next.delete(movement.id);
      else next.add(movement.id);
      return next;
    });
  }

  isMovementExpanded(movement: MerchantInventoryMovement): boolean {
    return movement.id ? this.expandedMovementIds().has(movement.id) : false;
  }

  getMovementTypeLabel(type: string): string {
    return MerchantService.getInventoryMovementTypeLabel(type);
  }

  getMovementBadgeClass(type: string): string {
    return MerchantService.getInventoryMovementBadgeClass(type);
  }

  formatMovementDelta(movement: MerchantInventoryMovement): string {
    return MerchantService.formatInventoryMovementDelta(movement);
  }

  getMovementDeltaClass(movement: MerchantInventoryMovement): string {
    if (movement.direction === 'IN' || movement.quantityDelta > 0) {
      return 'text-brand-green-dark';
    }
    if (movement.direction === 'OUT' || movement.quantityDelta < 0) {
      return 'text-mlm-red-700';
    }
    return 'text-mlm-secondary';
  }

  getMovementReferenceLink(movement: MerchantInventoryMovement) {
    return MerchantService.resolveMovementReferenceLink(movement);
  }

  getMovementMetadataEntries(
    movement: MerchantInventoryMovement,
  ): { label: string; value: string }[] {
    const meta = movement.metadata;
    if (!meta) return [];

    const entries: { label: string; value: string }[] = [];
    const add = (label: string, key: string) => {
      const value = meta[key];
      if (value == null || value === '') return;
      if (typeof value === 'object') {
        entries.push({ label, value: JSON.stringify(value) });
      } else {
        entries.push({ label, value: String(value) });
      }
    };

    add('Fulfilment method', 'fulfilmentMethod');
    add('Dispatched qty', 'dispatchedQuantity');
    add('Received qty', 'receivedQuantity');
    add('Reason', 'reason');
    add('Admin notes', 'adminNotes');
    add('Sender merchant', 'senderMerchantUsername');
    add('Line items', 'lineItems');

    return entries;
  }

  hasPendingStockRequest(productId: string): boolean {
    return this.pendingStockRequestProductIds().has(productId);
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

  onRequestStock(item: MerchantInventoryItem): void {
    if (!item.isActive || this.hasPendingStockRequest(item.productId)) return;

    this.stockRequestFormError.set(null);
    this.successMessage.set(null);
    this.merchantService.clearError();
    this.stockRequestItem.set(item);
    this.stockRequestQuantity.set(1);
    this.stockRequestNotes.set('');
    this.stockRequestModalVisible.set(true);
  }

  onSubmitStockRequest(): void {
    const item = this.stockRequestItem();
    if (!item || !this.canSubmitStockRequest()) return;

    this.stockRequestFormError.set(null);
    this.successMessage.set(null);

    const notes = this.stockRequestNotes().trim();
    this.merchantService
      .createStockRequest({
        productId: item.productId,
        quantity: Math.floor(this.stockRequestQuantity()),
        ...(notes ? { notes } : {}),
      })
      .subscribe((allocation) => {
        if (allocation) {
          this.successMessage.set('Stock request submitted. Admin will dispatch when available.');
          this.closeStockRequestModal();
          this.activeTab.set('topups');
          this.merchantService.fetchStockRequests();
        } else if (this.error()) {
          this.stockRequestFormError.set(this.error());
        }
      });
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

  closeStockRequestModal(): void {
    this.stockRequestModalVisible.set(false);
    this.stockRequestItem.set(null);
    this.stockRequestFormError.set(null);
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

  getAllocationStatusClass(status: AllocationStatus): string {
    switch (status) {
      case 'PENDING':
        return 'text-amber-700 bg-amber-50';
      case 'DISPATCHED':
      case 'IN_TRANSIT':
        return 'text-blue-700 bg-blue-50';
      case 'DELIVERED':
        return 'text-purple-700 bg-purple-50';
      case 'RECEIVED':
      case 'ACCEPTED':
        return 'text-green-700 bg-green-50';
      case 'CANCELLED':
        return 'text-red-700 bg-red-50';
      default: {
        const _exhaustive: never = status;
        return _exhaustive;
      }
    }
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

  allocationStatusLabel(status: AllocationStatus): string {
    switch (status) {
      case 'PENDING':
        return 'Pending';
      case 'DISPATCHED':
        return 'Dispatched';
      case 'IN_TRANSIT':
        return 'In transit';
      case 'DELIVERED':
        return 'Delivered';
      case 'RECEIVED':
        return 'Received';
      case 'ACCEPTED':
        return 'Accepted';
      case 'CANCELLED':
        return 'Cancelled';
      default: {
        const _exhaustive: never = status;
        return _exhaustive;
      }
    }
  }

  needsConfirmReceipt(request: MerchantAllocation): boolean {
    return request.status === 'DELIVERED';
  }
}
