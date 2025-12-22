import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { UserService } from '../../services/user.service';
import { CommissionService, CommissionSummary } from '../../services/commission.service';

@Component({
  selector: 'app-earnings-overview',
  standalone: true,
  imports: [CommonModule, ButtonModule, CardModule, RouterLink, DecimalPipe],
  template: `
    <div class="p-6 lg:p-10 space-y-10 max-w-7xl mx-auto">
      <!-- Unpaid Access Control -->
      @if (!userService.isPaid()) {
        <div class="flex flex-col items-center justify-center py-20 text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
           <div class="relative">
              <div class="absolute -inset-4 bg-mlm-primary/10 rounded-full blur-xl animate-pulse"></div>
              <div class="relative w-24 h-24 bg-white rounded-3xl shadow-xl border border-gray-100 flex items-center justify-center">
                  <i class="pi pi-lock text-4xl text-mlm-primary"></i>
              </div>
           </div>
           <div class="max-w-md space-y-2">
              <h1 class="text-2xl font-black text-mlm-text">Unlock Your Earnings</h1>
              <p class="text-mlm-secondary font-medium leading-relaxed">
                You're currently on the free tier. Complete your registration payment to start earning and tracking your commissions.
              </p>
           </div>
           <p-button 
              label="Complete Registration" 
              icon="pi pi-credit-card"
              routerLink="/dashboard/registration-payment"
              styleClass="p-button-raised p-button-primary px-8 py-3 rounded-2xl font-bold">
           </p-button>
        </div>
      } @else {
        <!-- Paid Overview Header -->
        <div class="flex flex-col md:flex-row md:items-end justify-between gap-6 animate-in fade-in duration-700">
          <div class="space-y-2">
            <h1 class="text-3xl font-black text-mlm-text tracking-tight lg:text-2xl">Earnings Overview</h1>
            <p class="text-mlm-secondary font-medium">Manage and track your performance across all currencies.</p>
          </div>
          <p-button 
            label="Commission Breakdown" 
            icon="pi pi-list"
            routerLink="breakdown"
            styleClass="bg-white text-mlm-text border border-gray-100 hover:border-mlm-primary hover:text-mlm-primary transition-all px-6 py-3 rounded-2xl font-bold shadow-sm">
          </p-button>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-6 duration-1000">
          
          <!-- NGN Wallet Card -->
          <ng-container *ngTemplateOutlet="summaryCard; context: { $implicit: ngnSummary(), currency: 'NGN', symbol: '₦', icon: 'pi pi-money-bill', color: 'bg-green-500', bgImg: 'assets/images/naira.png' }"></ng-container>

          <!-- USD Wallet Card -->
          <ng-container *ngTemplateOutlet="summaryCard; context: { $implicit: usdSummary(), currency: 'USD', symbol: '$', icon: 'pi pi-dollar', color: 'bg-blue-600', bgImg: 'assets/images/dollar.png' }"></ng-container>

        </div>

        <ng-template #summaryCard let-data let-currency="currency" let-symbol="symbol" let-icon="icon" let-color="color" let-bgImg="bgImg">
          <div class="relative overflow-hidden bg-white rounded-[2.5rem] border border-gray-100/50 shadow-sm p-8 lg:p-10 transition-all duration-300 group">
            <!-- Background Currency Sign -->
            <img [src]="bgImg" 
                 class="absolute top-0 right-0 w-32 h-32 -mr-12 -mt-12 opacity-10 pointer-events-none" 
                 alt="decoration">
            
            <div class="relative flex flex-col h-full gap-8">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-4">
                  <!-- <div [class]="'w-12 h-12 rounded-2xl text-white flex items-center justify-center shadow-lg ' + color">
                    <i [class]="icon + ' text-xl'"></i>
                  </div> -->
                  <div class="flex flex-col">
                    <span class="text-[10px] font-black text-mlm-secondary uppercase tracking-widest">{{ currency }} Portfolio</span>
                    <span class="text-xs font-bold text-mlm-text">Active Commissions</span>
                  </div>
                </div>
              </div>

              <div>
                <span class="text-4xl lg:text-5xl font-black text-mlm-text tracking-tighter">
                  {{ symbol }}{{ data.totalEarnings | number:'1.2-2' }}
                </span>
              </div>

              <div class="grid grid-cols-3 gap-2">
                <div class="p-4 bg-gray-50 rounded-3xl border border-gray-100/50">
                  <span class="block text-[10px] font-bold text-mlm-secondary uppercase mb-1">Pending</span>
                  <span class="text-sm font-black text-orange-500">{{ symbol }}{{ data.pendingCommissions | number:'1.2-2' }}</span>
                </div>
                <div class="p-4 bg-green-50/50 rounded-3xl border border-green-100/50">
                  <span class="block text-[10px] font-bold text-mlm-secondary uppercase mb-1">Approved</span>
                  <span class="text-sm font-black text-mlm-primary">{{ symbol }}{{ data.approvedCommissions | number:'1.2-2' }}</span>
                </div>
                <div class="p-4 bg-blue-50/50 rounded-3xl border border-blue-100/50">
                  <span class="block text-[10px] font-bold text-mlm-secondary uppercase mb-1">Withdrawn</span>
                  <span class="text-sm font-black text-blue-600">{{ symbol }}{{ data.withdrawnAmount | number:'1.2-2' }}</span>
                </div>
              </div>
            </div>
          </div>
        </ng-template>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      background: #fcfcfc;
      min-height: 100vh;
    }
  `]
})
export class EarningsOverviewComponent {
  userService = inject(UserService);
  commissionService = inject(CommissionService);

  ngnSummary = this.commissionService.getSummary('NGN');
  usdSummary = this.commissionService.getSummary('USD');
}
