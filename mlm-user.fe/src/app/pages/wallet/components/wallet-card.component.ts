import { Component, ChangeDetectionStrategy, input, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { DialogService } from 'primeng/dynamicdialog';
import { Wallet } from '../../../services/wallet.service';
import { WithdrawalComponent } from '../withdrawal/withdrawal.component';


@Component({
  selector: 'app-wallet-card',
  standalone: true,
  imports: [CommonModule, CardModule, ButtonModule, DecimalPipe],
  template: `
    <p-card class="hover:shadow-md transition-shadow duration-300">
      <div class="space-y-6">
        <div class="flex items-start justify-between">
          <div class="space-y-1">
            <span class="text-sm font-medium text-mlm-secondary uppercase tracking-wider">{{ wallet().currency }} Wallet</span>
            <div class="flex items-baseline gap-1">
              <span class="text-3xl font-bold text-mlm-text">
                {{ wallet().currency === 'NGN' ? '₦' : '$' }}{{ wallet().balance | number:'1.2-2' }}
              </span>
            </div>
          </div>
          <div [class]="'flex items-center justify-center rounded-xl p-3 ' + (wallet().currency === 'NGN' ? 'bg-mlm-blue-100' : 'bg-mlm-success/10')">
            <i [class]="'pi text-2xl ' + (wallet().currency === 'NGN' ? 'pi-wallet text-mlm-blue-500' : 'pi-money-bill text-mlm-success')"></i>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
          <p-button 
            label="Withdraw" 
            icon="pi pi-arrow-up-right" 
            [outlined]="true"
            severity="secondary"
            (onClick)="onWithdraw()"
            [style]="{ width: '100%', 'font-weight': '600' }">
          </p-button>
          <p-button 
            label="History" 
            icon="pi pi-list" 
            (onClick)="onViewHistory()"
            [style]="{ width: '100%', 'font-weight': '600' }">
          </p-button>
        </div>
      </div>
    </p-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WalletCardComponent {
  private router = inject(Router);
  private dialogService = inject(DialogService);
  wallet = input.required<Wallet>();

  onWithdraw() {
    this.dialogService.open(WithdrawalComponent, {
      header: `Withdraw ${this.wallet().currency} Funds`,
      width: '650px',
      contentStyle: { 'max-height': '750px', overflow: 'auto' },


      baseZIndex: 10000,
      data: {
        currency: this.wallet().currency
      }
    });
  }

  onViewHistory() {
    this.router.navigate(['/wallet/transactions', this.wallet().currency]);
  }
}

