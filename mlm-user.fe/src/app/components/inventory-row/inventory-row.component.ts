import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatusBadgeComponent } from '../status-badge/status-badge.component';
import type { InventoryStockStatus } from '../../services/merchant.service';

@Component({
  selector: 'app-inventory-row',
  imports: [CommonModule, StatusBadgeComponent],
  templateUrl: './inventory-row.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InventoryRowComponent {
  productId = input.required<string>();
  productName = input.required<string>();
  stockQuantity = input.required<number>();
  status = input.required<InventoryStockStatus>();

  editStock = output<{ productId: string; productName: string; currentQuantity: number }>();

  onEdit(): void {
    this.editStock.emit({
      productId: this.productId(),
      productName: this.productName(),
      currentQuantity: this.stockQuantity()
    });
  }
}
