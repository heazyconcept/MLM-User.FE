import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { WalletService, WithdrawalRequest } from '../../../services/wallet.service';
import { SkeletonModule } from 'primeng/skeleton';

@Component({
  selector: 'app-withdrawal-history',
  standalone: true,
  imports: [CommonModule, TableModule, TagModule, SkeletonModule],
  template: `
    <div class="p-6 space-y-6">
      <div class="flex justify-between items-center">
        <div>
          <h1 class="text-2xl font-bold text-mlm-text">Withdrawal History</h1>
          <p class="text-sm text-mlm-secondary">Track your withdrawal requests and their statuses.</p>
        </div>
      </div>

      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <p-table 
          [value]="isLoading() ? skeletonRows : withdrawals()" 
          [paginator]="true" 
          [rows]="10" 
          styleClass="p-datatable-lg"
          [responsiveLayout]="'stack'"
          [breakpoint]="'960px'">
          
          <ng-template pTemplate="header">
            <tr>
              <th class="bg-gray-50/50 text-[10px] font-bold uppercase tracking-wider text-mlm-secondary px-6 py-4">ID</th>
              <th class="bg-gray-50/50 text-[10px] font-bold uppercase tracking-wider text-mlm-secondary px-6 py-4">Date</th>
              <th class="bg-gray-50/50 text-[10px] font-bold uppercase tracking-wider text-mlm-secondary px-6 py-4">Amount</th>
              <th class="bg-gray-50/50 text-[10px] font-bold uppercase tracking-wider text-mlm-secondary px-6 py-4">Bank</th>
              <th class="bg-gray-50/50 text-[10px] font-bold uppercase tracking-wider text-mlm-secondary px-6 py-4 text-center">Status</th>
            </tr>
          </ng-template>

          <ng-template pTemplate="body" let-w>
            @if (isLoading()) {
              <tr>
                <td class="px-6 py-4"><p-skeleton width="80px"></p-skeleton></td>
                <td class="px-6 py-4"><p-skeleton width="100px"></p-skeleton></td>
                <td class="px-6 py-4"><p-skeleton width="70px"></p-skeleton></td>
                <td class="px-6 py-4"><p-skeleton width="120px"></p-skeleton></td>
                <td class="px-6 py-4"><p-skeleton width="60px" class="mx-auto"></p-skeleton></td>
              </tr>
            } @else {
              <tr class="hover:bg-gray-50/50 transition-colors cursor-default">
                <td class="px-6 py-4">
                  <span class="text-xs font-bold text-mlm-text">{{ w.id }}</span>
                </td>
                <td class="px-6 py-4">
                  <div class="flex flex-col">
                    <span class="text-xs font-bold text-mlm-text">{{ w.date | date:'MMM dd, yyyy' }}</span>
                    <span class="text-[10px] text-mlm-secondary">{{ w.date | date:'hh:mm a' }}</span>
                  </div>
                </td>
                <td class="px-6 py-4">
                  <span class="text-xs font-black text-mlm-text">
                    {{ w.currency === 'NGN' ? '₦' : '$' }}{{ w.amount | number:'1.2-2' }}
                  </span>
                </td>
                <td class="px-6 py-4">
                  <div class="flex flex-col max-w-[200px]">
                    <span class="text-xs font-bold text-mlm-text truncate">{{ w.bankName }}</span>
                    <span class="text-[10px] text-mlm-secondary">{{ w.accountNumber }}</span>
                  </div>
                </td>
                <td class="px-6 py-4 text-center">
                  <p-tag 
                    [value]="w.status" 
                    [severity]="getSeverity(w.status)"
                    [style]="{ 'font-size': '10px', 'font-weight': '700', 'border-radius': '6px', 'padding': '2px 8px' }">
                  </p-tag>
                </td>
              </tr>
            }
          </ng-template>

          <ng-template pTemplate="emptymessage">
            <tr>
              <td colspan="5" class="py-20 text-center">
                <div class="flex flex-col items-center gap-4">
                  <div class="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center">
                    <i class="pi pi-history text-3xl text-gray-300"></i>
                  </div>
                  <div class="space-y-1">
                    <p class="text-sm font-bold text-mlm-text">No withdrawals yet</p>
                    <p class="text-xs text-mlm-secondary">When you make a withdrawal, it will appear here.</p>
                  </div>
                </div>
              </td>
            </tr>
          </ng-template>
        </p-table>
      </div>
    </div>
  `,
  styles: [`
    :host ::ng-deep .p-datatable .p-datatable-thead > tr > th {
      border-bottom: 1px solid #f1f5f9;
    }
    :host ::ng-deep .p-datatable .p-datatable-tbody > tr > td {
      border-bottom: 1px solid #f1f5f9;
    }
  `]
})
export class WithdrawalHistoryComponent implements OnInit {
  private walletService = inject(WalletService);
  
  withdrawals = this.walletService.allWithdrawals;
  isLoading = signal(true);
  skeletonRows = Array(5).fill({});

  ngOnInit() {
    // We still call fetch to trigger the initial load if needed, 
    // although initialLoad in constructor handles it now.
    // However, fetchWithdrawals in WalletService currently just returns an observable of the signal.
    this.walletService.fetchWithdrawals().subscribe({
      next: () => this.isLoading.set(false),
      error: () => this.isLoading.set(false)
    });
  }


  getSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (status) {
      case 'Approved': return 'success';
      case 'Pending': return 'info';
      case 'Rejected': return 'danger';
      default: return 'secondary';
    }
  }
}
