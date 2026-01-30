import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MerchantService } from '../../../services/merchant.service';
import { InventoryRowComponent } from '../../../components/inventory-row/inventory-row.component';
import { DialogModule } from 'primeng/dialog';
import { FormsModule } from '@angular/forms';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-merchant-inventory',
  imports: [
    CommonModule,
    RouterLink,
    InventoryRowComponent,
    DialogModule,
    FormsModule,
    InputNumberModule,
    ButtonModule
  ],
  templateUrl: './merchant-inventory.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MerchantInventoryComponent {
  private merchantService = inject(MerchantService);

  inventory = this.merchantService.inventory;
  editModalVisible = signal(false);
  editProductId = signal<string | null>(null);
  editProductName = signal('');
  editQuantity = signal(0);

  editingItem = computed(() => {
    const id = this.editProductId();
    if (!id) return null;
    return this.inventory().find((i) => i.productId === id) ?? null;
  });

  onEditStock(payload: { productId: string; productName: string; currentQuantity: number }): void {
    this.editProductId.set(payload.productId);
    this.editProductName.set(payload.productName);
    this.editQuantity.set(payload.currentQuantity);
    this.editModalVisible.set(true);
  }

  onSaveStock(): void {
    const id = this.editProductId();
    const qty = this.editQuantity();
    if (id != null && qty >= 0) {
      this.merchantService.setStock(id, Math.floor(qty));
    }
    this.editModalVisible.set(false);
    this.editProductId.set(null);
  }

  onCloseModal(): void {
    this.editModalVisible.set(false);
    this.editProductId.set(null);
  }
}
