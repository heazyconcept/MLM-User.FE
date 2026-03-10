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
import { MerchantService, type StockStatus } from '../../../services/merchant.service';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-merchant-inventory',
  imports: [CommonModule, RouterLink, FormsModule, DialogModule, InputNumberModule, ButtonModule],
  templateUrl: './merchant-inventory.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MerchantInventoryComponent implements OnInit {
  private merchantService = inject(MerchantService);

  inventory = this.merchantService.inventory;
  loading = this.merchantService.loading;
  actionLoading = this.merchantService.actionLoading;
  error = this.merchantService.error;

  editModalVisible = signal(false);
  editProductId = signal<string | null>(null);
  editProductName = signal('');
  editQuantity = signal(0);
  editStatus = signal<StockStatus | ''>('');

  readonly stockStatuses: StockStatus[] = ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'];

  ngOnInit(): void {
    this.merchantService.fetchInventory();
  }

  onEditStock(item: {
    productId: string;
    productName: string;
    stockQuantity: number;
    stockStatus: StockStatus | null;
  }): void {
    this.editProductId.set(item.productId);
    this.editProductName.set(item.productName);
    this.editQuantity.set(item.stockQuantity);
    this.editStatus.set(item.stockStatus ?? '');
    this.editModalVisible.set(true);
  }

  onSaveStock(): void {
    const id = this.editProductId();
    if (!id) return;

    const body: { stockQuantity?: number; stockStatus?: StockStatus } = {};
    body.stockQuantity = Math.max(0, Math.floor(this.editQuantity()));
    const status = this.editStatus();
    if (status) body.stockStatus = status as StockStatus;

    this.merchantService.updateStock(id, body);
    this.editModalVisible.set(false);
    this.editProductId.set(null);
  }

  onCloseModal(): void {
    this.editModalVisible.set(false);
    this.editProductId.set(null);
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
}
