import { Component, ChangeDetectionStrategy, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { PaymentService, PaymentRecord } from '../../../services/payment.service';
import { AuditService, AuditLogItem } from '../../../services/audit.service';
import { StatusBadgeComponent } from '../../../components/status-badge/status-badge.component';

@Component({
  selector: 'app-transaction-history',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    TableModule, 
    ButtonModule, 
    SkeletonModule,
    DecimalPipe, 
    DatePipe,
    StatusBadgeComponent
  ],
  templateUrl: './transaction-history.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TransactionHistoryComponent implements OnInit {
  private router = inject(Router);
  private paymentService = inject(PaymentService);
  private auditService = inject(AuditService);

  activeTab = signal<'payments' | 'audit'>('payments');
  
  payments = signal<PaymentRecord[]>([]);
  auditLogs = signal<AuditLogItem[]>([]);
  
  isLoading = signal(true);
  skeletonRows = Array(10).fill(0);

  ngOnInit() {
    this.loadData();
  }

  setTab(tab: 'payments' | 'audit') {
    this.activeTab.set(tab);
    this.loadData();
  }

  loadData() {
    this.isLoading.set(true);
    if (this.activeTab() === 'payments') {
      this.paymentService.getPayments(50, 0).subscribe({
        next: (res) => {
          this.payments.set(res.items);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false)
      });
    } else {
      this.auditService.getAuditLogs(50, 0).subscribe({
        next: (res) => {
          this.auditLogs.set(res.items);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false)
      });
    }
  }

  getPaymentIcon(type: string): string {
    const t = type.toUpperCase();
    if (t.includes('FUND') || t.includes('DEPOSIT')) return 'pi pi-arrow-down-left text-mlm-success';
    if (t.includes('REGISTRATION') || t.includes('UPGRADE')) return 'pi pi-shopping-bag text-blue-500';
    return 'pi pi-credit-card text-gray-500';
  }

  getAuditIcon(action: string): string {
    const a = action.toUpperCase();
    if (a.includes('PAYMENT')) return 'pi pi-wallet text-amber-500';
    if (a.includes('REGISTRATION')) return 'pi pi-user-plus text-mlm-primary';
    if (a.includes('WALLET_FUNDED') || a.includes('DEPOSIT')) return 'pi pi-arrow-down-left text-mlm-success';
    if (a.includes('WITHDRAWAL')) return 'pi pi-arrow-up-right text-mlm-error';
    if (a.includes('TRANSFER')) return 'pi pi-arrow-right-arrow-left text-indigo-500';
    return 'pi pi-info-circle text-gray-400';
  }

  formatActionName(action: string): string {
    return action.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
  }

  goBack() {
    this.router.navigate(['/wallet']);
  }
}
