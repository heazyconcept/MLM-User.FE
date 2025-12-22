import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TabsModule } from 'primeng/tabs';
import { TagModule } from 'primeng/tag';
import { CommissionService, CommissionEntry, CommissionType } from '../../services/commission.service';

@Component({
  selector: 'app-commission-breakdown',
  standalone: true,
  imports: [
    CommonModule, 
    ButtonModule, 
    TableModule, 
    TabsModule, 
    TagModule, 
    RouterLink, 
    DecimalPipe, 
    DatePipe
  ],
  template: `
    <div class="p-6 lg:p-10 space-y-8 max-w-7xl mx-auto">
      <!-- Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 animate-in fade-in duration-700">
        <div class="flex items-center gap-4">
          <button routerLink=".." class="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center hover:bg-gray-50 transition-colors">
            <i class="pi pi-chevron-left text-mlm-text"></i>
          </button>
          <div class="space-y-1">
            <h1 class="text-2xl font-black text-mlm-text tracking-tight">Commission Breakdown</h1>
            <p class="text-[10px] font-bold text-mlm-secondary uppercase tracking-widest">Detailed Earnings Log</p>
          </div>
        </div>
      </div>

      <!-- Tabs & Table -->
      <div class="bg-white rounded-[2.5rem] border border-gray-50 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-1000">
        <p-tabs value="0">
          <p-tablist styleClass="px-6 py-2 border-b border-gray-50">
             <p-tab value="0" styleClass="text-xs font-bold py-4">Direct Referral</p-tab>
             <p-tab value="1" styleClass="text-xs font-bold py-4">Team Commissions</p-tab>
             <p-tab value="2" styleClass="text-xs font-bold py-4">Bonuses</p-tab>
          </p-tablist>
          <p-tabpanels>
            <p-tabpanel value="0">
               <ng-container *ngTemplateOutlet="commTable; context: { $implicit: directReferrals() }"></ng-container>
            </p-tabpanel>
            <p-tabpanel value="1">
               <ng-container *ngTemplateOutlet="commTable; context: { $implicit: teamCommissions() }"></ng-container>
            </p-tabpanel>
            <p-tabpanel value="2">
               <ng-container *ngTemplateOutlet="commTable; context: { $implicit: bonuses() }"></ng-container>
            </p-tabpanel>
          </p-tabpanels>
        </p-tabs>
      </div>

      <!-- Table Template -->
      <ng-template #commTable let-data>
        <p-table [value]="data" [paginator]="true" [rows]="10" styleClass="p-datatable-lg border-0" [responsiveLayout]="'stack'" [breakpoint]="'960px'">
          <ng-template pTemplate="header">
            <tr>
              <th class="bg-gray-50/50 text-[10px] font-bold uppercase tracking-wider text-mlm-secondary px-8 py-5">Date</th>
              <th class="bg-gray-50/50 text-[10px] font-bold uppercase tracking-wider text-mlm-secondary px-8 py-5">Source</th>
              <th class="bg-gray-50/50 text-[10px] font-bold uppercase tracking-wider text-mlm-secondary px-8 py-5">Amount</th>
              <th class="bg-gray-50/50 text-[10px] font-bold uppercase tracking-wider text-mlm-secondary px-8 py-5 text-center">Status</th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-entry>
            <tr class="hover:bg-gray-50/30 transition-colors border-b border-gray-50">
              <td class="px-8 py-6">
                <div class="flex flex-col">
                  <span class="text-xs font-bold text-mlm-text">{{ entry.date | date:'MMM dd, yyyy' }}</span>
                  <span class="text-[10px] text-mlm-secondary">{{ entry.date | date:'hh:mm a' }}</span>
                </div>
              </td>
              <td class="px-8 py-6">
                <span class="text-xs font-semibold text-mlm-text">{{ entry.source }}</span>
              </td>
              <td class="px-8 py-6">
                <div class="flex items-center gap-2">
                   <span class="w-8 h-8 rounded-lg bg-gray-100 text-[10px] font-black flex items-center justify-center">{{ entry.currency }}</span>
                   <span class="text-sm font-black text-mlm-text">{{ entry.amount | number:'1.2-2' }}</span>
                </div>
              </td>
              <td class="px-8 py-6 text-center">
                <p-tag [value]="entry.status" [severity]="getSeverity(entry.status)" styleClass="rounded-lg px-3 py-1 text-[10px] font-bold"></p-tag>
              </td>
            </tr>
          </ng-template>
          <ng-template pTemplate="emptymessage">
            <tr>
              <td colspan="4" class="py-20 text-center">
                <div class="flex flex-col items-center gap-4">
                  <div class="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center">
                    <i class="pi pi-inbox text-2xl text-gray-300"></i>
                  </div>
                  <p class="text-xs font-bold text-mlm-text">No commissions found in this category.</p>
                </div>
              </td>
            </tr>
          </ng-template>
        </p-table>
      </ng-template>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      background: #fcfcfc;
      min-height: 100vh;
    }
    :host ::ng-deep {
      .p-tablist-tab-list {
        border-bottom: 1px solid #f9fafb;
      }
      .p-tablist-tab {
        color: var(--mlm-secondary);
        transition: all 0.3s ease;
      }
      .p-tablist-tab.p-tab-active {
        color: var(--mlm-primary);
      }
      .p-tabpanel {
        padding: 0;
      }
    }
  `]
})
export class CommissionBreakdownComponent {
  private commissionService = inject(CommissionService);

  directReferrals = this.commissionService.getEntriesByType('Direct Referral');
  teamCommissions = this.commissionService.getEntriesByType('Level Commission');
  bonuses = this.commissionService.getEntriesByType('Bonus');

  getSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (status) {
      case 'Approved': return 'success';
      case 'Pending': return 'warn';
      case 'Locked': return 'secondary';
      default: return 'info';
    }
  }

  onTabChange(event: any) {
    // Analytics or specific logic if needed
  }
}
