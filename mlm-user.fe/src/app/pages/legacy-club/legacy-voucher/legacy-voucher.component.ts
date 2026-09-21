import { Component, ChangeDetectionStrategy, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageService } from 'primeng/api';
import { LegacyClubService } from '../../../services/legacy-club.service';
import { AuthService } from '../../../services/auth.service';
import { WalletService } from '../../../services/wallet.service';
import { formatLegacyMoney } from '../../../core/utils/legacy-money.util';
import { legacyErrorMessage } from '../../../core/utils/legacy-error.util';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-legacy-voucher',
  imports: [CommonModule, FormsModule, RouterLink, ButtonModule, InputNumberModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-mlm-background">
      <main class="py-8">
        <div class="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
      <a routerLink="/legacy" class="text-sm font-medium text-mlm-primary hover:underline">← Legacy Club</a>
      <div>
        <h1 class="text-2xl font-bold text-mlm-text">Legacy product voucher</h1>
        <p class="mt-1 text-sm text-mlm-secondary">
          This is not your network Product Voucher. It is only for the Legacy Club marketplace.
        </p>
      </div>

      <div class="grid gap-5 lg:grid-cols-2">
      <div class="rounded-2xl bg-mlm-primary px-6 py-7 sm:px-8">
        <p class="text-xs font-bold uppercase tracking-[.15em] text-white/60">Balance</p>
        <p class="mt-3 text-4xl font-extrabold tracking-tight text-white">{{ money(balance()) }}</p>
      </div>

      @if (isImpersonating()) {
        <p class="rounded-2xl border border-gray-100 bg-white px-6 py-5 text-sm text-mlm-secondary">
          Funding is disabled during impersonation.
        </p>
      } @else {
        <div class="rounded-2xl border border-gray-100 bg-white p-6 sm:p-7 space-y-4">
          <p class="text-sm font-semibold text-mlm-text">Fund from CASH</p>
          <p class="text-sm text-mlm-secondary">Available CASH: {{ money(cashBalance()) }}</p>
          <p-inputNumber
            [(ngModel)]="amount"
            [min]="1"
            mode="decimal"
            [useGrouping]="true"
            styleClass="w-full"
            inputStyleClass="w-full"
            placeholder="Amount"
          />
          <p-button
            label="Transfer from CASH"
            styleClass="w-full"
            [loading]="submitting()"
            [disabled]="!amount || amount <= 0"
            (onClick)="fund()"
          />
          <a routerLink="/wallet" class="block text-center text-xs text-mlm-secondary hover:underline">
            Network voucher is under Wallet
          </a>
        </div>
      }
      </div>

      @if (me()?.status === 'PENDING_JOIN' || shopMode() === 'AUTOSHIP' || shopMode() === 'UPGRADE' || shopMode() === 'REACTIVATE') {
        <a routerLink="/legacy/shop">
          <p-button label="Back to Legacy marketplace" [outlined]="true" />
        </a>
      }
        </div>
      </main>
    </div>
  `,
})
export class LegacyVoucherComponent implements OnInit {
  private legacyClub = inject(LegacyClubService);
  private walletService = inject(WalletService);
  private auth = inject(AuthService);
  private messages = inject(MessageService);

  me = this.legacyClub.me;
  balance = signal(0);
  cashBalance = signal(0);
  submitting = signal(false);
  amount: number | null = null;
  isImpersonating = computed(() => !!this.auth.impersonation());
  shopMode = computed(() => this.me()?.shopMode ?? this.me()?.autoship?.shopMode ?? 'NONE');

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.legacyClub.loadMe().subscribe();
    this.legacyClub.getVoucher().subscribe({
      next: (v) => this.balance.set(v.balance),
    });
    if (environment.useLegacyClubMocks) {
      this.cashBalance.set(this.legacyClub.getMockCashBalance());
      return;
    }
    this.walletService.fetchWallets().subscribe({
      next: (wallets) => {
        const currency = this.me()?.currency ?? 'NGN';
        const wallet = wallets.find((w) => w.currency === currency);
        this.cashBalance.set(wallet?.cashBalance ?? 0);
      },
      error: () => this.cashBalance.set(0),
    });
  }

  money(amount: number): string {
    return formatLegacyMoney(amount, this.me()?.currency ?? 'NGN');
  }

  fund(): void {
    if (!this.amount || this.amount <= 0 || this.isImpersonating()) return;
    this.submitting.set(true);
    this.legacyClub.fundVoucherFromCash(this.amount, this.me()?.currency ?? 'NGN').subscribe({
      next: () => {
        this.submitting.set(false);
        this.amount = null;
        this.refresh();
        this.messages.add({
          severity: 'success',
          summary: 'Funded',
          detail: 'Legacy product voucher updated.',
        });
      },
      error: (err) => {
        this.submitting.set(false);
        this.messages.add({
          severity: 'error',
          summary: 'Transfer failed',
          detail: legacyErrorMessage(err),
        });
      },
    });
  }
}
