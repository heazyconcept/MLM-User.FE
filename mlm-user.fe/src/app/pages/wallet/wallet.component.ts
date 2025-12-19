import { Component, ChangeDetectionStrategy, inject, OnInit, signal } from '@angular/core';

import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { UserService } from '../../services/user.service';
import { WalletService } from '../../services/wallet.service';
import { WalletCardComponent } from './components/wallet-card.component';

@Component({
  selector: 'app-wallet',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    CardModule,
    ButtonModule,
    MessageModule,
    SkeletonModule,
    WalletCardComponent
  ],
  templateUrl: './wallet.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WalletComponent implements OnInit {
  private userService = inject(UserService);
  private walletService = inject(WalletService);
  private router = inject(Router);

  isPaid = this.userService.isPaid;
  wallets = this.walletService.allWallets;
  isLoading = signal(true);

  ngOnInit() {
    if (this.isPaid()) {
      this.walletService.fetchWallets().subscribe({
        next: () => this.isLoading.set(false),
        error: () => this.isLoading.set(false)
      });
    } else {
      this.isLoading.set(false);
    }
  }


  navigateToPayment() {
    this.router.navigate(['/dashboard/registration-payment']);
  }
}
