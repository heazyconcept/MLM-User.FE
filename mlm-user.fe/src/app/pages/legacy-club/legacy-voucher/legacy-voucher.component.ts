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
import { LegacyPageShellComponent } from '../components/legacy-page-shell.component';
import { LegacyPageHeaderComponent } from '../components/legacy-page-header.component';
import { LegacyPanelComponent } from '../components/legacy-panel.component';
import { LegacyBalanceBannerComponent } from '../components/legacy-balance-banner.component';

@Component({
  selector: 'app-legacy-voucher',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ButtonModule,
    InputNumberModule,
    LegacyPageShellComponent,
    LegacyPageHeaderComponent,
    LegacyPanelComponent,
    LegacyBalanceBannerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-legacy-page-shell>
      <div class="flex flex-col gap-8">
        <app-legacy-page-header
          title="Legacy product voucher"
          subtitle="This is not your network Product Voucher. It is only for the Legacy Club marketplace."
          backLink="/legacy"
          backLabel="Legacy Club"
        />

        <div class="grid gap-6 lg:grid-cols-2 lg:gap-8">
          <app-legacy-panel title="Voucher balance">
            <app-legacy-balance-banner
              label="Legacy product voucher"
              [amount]="money(balance())"
              hint="Use this balance when paying in the Legacy marketplace."
            />
          </app-legacy-panel>

          <app-legacy-panel title="Fund from CASH">
            @if (isImpersonating()) {
              <p class="text-sm text-mlm-secondary">Funding is disabled during impersonation.</p>
            } @else {
              <div class="flex flex-col gap-5">
                <app-legacy-balance-banner
                  label="Available CASH"
                  [amount]="money(cashBalance())"
                  hint="Transfers move funds from your cash wallet."
                />
                <div class="flex flex-col gap-2">
                  <label class="text-sm font-semibold text-gray-700" for="fund-amount">Amount</label>
                  <p-inputNumber
                    inputId="fund-amount"
                    [(ngModel)]="amount"
                    [min]="1"
                    mode="decimal"
                    [useGrouping]="true"
                    styleClass="w-full"
                    inputStyleClass="w-full"
                    placeholder="Enter amount"
                  />
                </div>
                <p-button
                  label="Transfer from CASH"
                  styleClass="w-full"
                  [loading]="submitting()"
                  [disabled]="!amount || amount <= 0"
                  (onClick)="fund()"
                />
                <a
                  routerLink="/wallet"
                  class="block text-center text-xs text-mlm-secondary transition-colors hover:text-mlm-primary"
                >
                  Network voucher is under Wallet
                </a>
              </div>
            }
          </app-legacy-panel>
        </div>

        @if (shopMode() === 'SHOP') {
          <div class="pt-2">
            <a routerLink="/legacy/shop">
              <p-button
                label="Back to Legacy marketplace"
                [outlined]="true"
                severity="secondary"
              />
            </a>
          </div>
        }
      </div>
    </app-legacy-page-shell>
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
      next: (res) => this.balance.set(res.balance),
    });
    if (environment.useLegacyClubMocks) {
      this.cashBalance.set(this.legacyClub.getMockCashBalance());
    } else {
      this.walletService.fetchWallets().subscribe({
        next: () => {
          const currency = this.me()?.currency ?? 'NGN';
          const wallet = this.walletService.allWallets().find((w) => w.currency === currency);
          this.cashBalance.set(wallet?.cashBalance ?? 0);
        },
        error: () => this.cashBalance.set(0),
      });
    }
  }

  money(amount: number): string {
    return formatLegacyMoney(amount, this.me()?.currency ?? 'NGN');
  }

  fund(): void {
    if (!this.amount || this.amount <= 0 || this.isImpersonating()) return;
    this.submitting.set(true);
    const currency = this.me()?.currency ?? 'NGN';
    this.legacyClub.fundVoucherFromCash(this.amount, currency).subscribe({
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
