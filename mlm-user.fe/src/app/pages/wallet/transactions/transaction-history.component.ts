import { Component, ChangeDetectionStrategy, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { WalletService } from '../../../services/wallet.service';
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
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private walletService = inject(WalletService);

  currency = signal<'NGN' | 'USD' | null>(null);
  transactions = this.walletService.allTransactions;
  isLoading = signal(true);
  skeletonRows = Array(10).fill(0);


  ngOnInit() {
    this.route.params.subscribe(params => {
      const curr = params['currency'] as 'NGN' | 'USD';
      this.currency.set(curr);
      this.loadTransactions(curr);
    });
  }

  loadTransactions(currency: 'NGN' | 'USD') {
    this.isLoading.set(true);
    this.walletService.fetchTransactions(currency).subscribe({
      next: () => this.isLoading.set(false),
      error: () => this.isLoading.set(false)
    });
  }


  getTypeIcon(type: string): string {
    switch (type) {
      case 'Deposit': return 'pi pi-arrow-down-left text-mlm-success';
      case 'Commission': return 'pi pi-bolt text-mlm-warning';
      case 'Withdrawal': return 'pi pi-arrow-up-right text-mlm-error';
      default: return 'pi pi-circle';
    }
  }

  goBack() {
    this.router.navigate(['/wallet']);
  }
}
