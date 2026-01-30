import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';

interface OrderData {
  orderId: string;
  productName: string;
  productImage: string;
  quantity: number;
  wallet: string;
  total: number;
  totalPV: number;
}

@Component({
  selector: 'app-order-success',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-success.component.html',
  styles: [`
    :host {
      display: block;
    }
    .line-clamp-1 {
      display: -webkit-box;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderSuccessComponent {
  private config = inject(DynamicDialogConfig);
  private dialogRef = inject(DynamicDialogRef);

  orderData: OrderData = this.config.data;

  onContinueShopping(): void {
    this.dialogRef.close({ action: 'continue' });
  }

  onChooseFulfilment(): void {
    this.dialogRef.close({ action: 'choose-fulfilment' });
  }

  onViewOrders(): void {
    this.dialogRef.close({ action: 'view-orders' });
  }

  formatCurrency(amount: number): string {
    return `₦${amount.toLocaleString('en-US')}`;
  }
}
