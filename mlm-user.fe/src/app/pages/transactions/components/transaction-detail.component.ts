import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Transaction, TransactionType, WalletType } from '../../../services/transaction.service';
import { StatusBadgeComponent } from '../../../components/status-badge/status-badge.component';

@Component({
  selector: 'app-transaction-detail',
  standalone: true,
  imports: [CommonModule, DatePipe, StatusBadgeComponent],
  templateUrl: './transaction-detail.component.html',
  styles: [`
    :host {
      display: block;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TransactionDetailComponent {
  private config = inject(DynamicDialogConfig);
  private dialogRef = inject(DynamicDialogRef);

  transaction: Transaction = this.config.data.transaction;

  getTypeIcon(): string {
    switch (this.transaction.type) {
      case 'Earnings': return 'pi pi-arrow-down-left';
      case 'Withdrawal': return 'pi pi-arrow-up-right';
      case 'Payment': return 'pi pi-shopping-cart';
      default: return 'pi pi-circle';
    }
  }

  getTypeColorClass(): string {
    switch (this.transaction.type) {
      case 'Earnings': return 'bg-green-50 text-green-600 border-green-100';
      case 'Withdrawal': return 'bg-red-50 text-red-600 border-red-100';
      case 'Payment': return 'bg-amber-50 text-amber-600 border-amber-100';
      default: return 'bg-gray-50 text-gray-600 border-gray-100';
    }
  }

  getAmountColorClass(): string {
    return this.transaction.type === 'Earnings' ? 'text-green-600' : 'text-red-600';
  }

  getAmountPrefix(): string {
    return this.transaction.type === 'Earnings' ? '+' : '-';
  }

  getWalletBadgeClass(): string {
    switch (this.transaction.wallet) {
      case 'cash': return 'bg-green-50 text-green-600';
      case 'voucher': return 'bg-blue-50 text-blue-600';
      case 'autoship': return 'bg-purple-50 text-purple-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  }

  getWalletIcon(): string {
    switch (this.transaction.wallet) {
      case 'cash': return 'pi pi-wallet';
      case 'voucher': return 'pi pi-ticket';
      case 'autoship': return 'pi pi-sync';
      default: return 'pi pi-wallet';
    }
  }

  formatCurrency(amount: number): string {
    return `₦${amount.toLocaleString('en-US')}`;
  }

  onClose(): void {
    this.dialogRef.close();
  }
}

