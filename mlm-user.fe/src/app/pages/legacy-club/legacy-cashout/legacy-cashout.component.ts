import { Component, ChangeDetectionStrategy, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { MessageService } from 'primeng/api';
import { LegacyClubService } from '../../../services/legacy-club.service';
import { AuthService } from '../../../services/auth.service';
import { UserService } from '../../../services/user.service';
import { OnboardingService } from '../../../services/onboarding.service';
import {
  LegacyCashoutLedgerItem,
  LegacyCashoutTransferTarget,
} from '../../../core/models/legacy-club.models';
import { formatLegacyMoney } from '../../../core/utils/legacy-money.util';
import { legacyErrorMessage } from '../../../core/utils/legacy-error.util';
import { LegacyPageShellComponent } from '../components/legacy-page-shell.component';
import { LegacyPageHeaderComponent } from '../components/legacy-page-header.component';
import { LegacyPanelComponent } from '../components/legacy-panel.component';
import { LegacyBalanceBannerComponent } from '../components/legacy-balance-banner.component';

@Component({
  selector: 'app-legacy-cashout',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ButtonModule,
    InputNumberModule,
    InputTextModule,
    SelectModule,
    LegacyPageShellComponent,
    LegacyPageHeaderComponent,
    LegacyPanelComponent,
    LegacyBalanceBannerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-legacy-page-shell>
      <app-legacy-page-header
        title="Legacy account"
        subtitle="You can cash out or move this balance at any time."
        backLink="/legacy"
        backLabel="Legacy Club"
      />

      <app-legacy-panel>
        <app-legacy-balance-banner
          label="Available balance"
          [amount]="money(balance())"
          [hint]="successlineHint()"
        />

        @if (isImpersonating()) {
          <p class="text-sm text-mlm-secondary">
            Cash out and move are disabled during impersonation.
          </p>
        } @else if (!canCashout()) {
          <p class="text-sm text-mlm-secondary">Legacy account is not available yet.</p>
        } @else {
          <div class="grid gap-6 border-t border-gray-100 pt-6 lg:grid-cols-2">
            <div class="space-y-4">
              <h2 class="text-sm font-semibold text-mlm-text">Cash out</h2>
              @if (bankLabel()) {
                <p class="text-sm text-mlm-secondary">Payout to {{ bankLabel() }}</p>
              } @else {
                <div class="rounded-xl border border-amber-100 bg-amber-50/50 p-4 text-sm text-mlm-secondary">
                  Add bank details in Profile before cashing out.
                  <a routerLink="/profile" class="ml-1 font-semibold text-mlm-primary hover:underline"
                    >Open profile</a
                  >
                </div>
              }
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-semibold text-gray-700" for="withdraw-amount">Amount</label>
                <p-inputNumber
                  inputId="withdraw-amount"
                  [(ngModel)]="withdrawAmount"
                  [min]="1"
                  mode="decimal"
                  styleClass="w-full"
                  inputStyleClass="w-full"
                  placeholder="Enter amount"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-semibold text-gray-700" for="withdraw-pin">Transaction PIN</label>
                <input
                  id="withdraw-pin"
                  pInputText
                  type="password"
                  class="w-full"
                  placeholder="4-digit PIN"
                  [(ngModel)]="pin"
                />
              </div>
              <p-button
                label="Cash out"
                styleClass="w-full"
                [loading]="busy()"
                [disabled]="!hasBank()"
                (onClick)="withdraw()"
              />
            </div>

            <div class="space-y-4 lg:border-l lg:border-gray-100 lg:pl-6">
              <h2 class="text-sm font-semibold text-mlm-text">Move to another wallet</h2>
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-semibold text-gray-700" for="transfer-target">Destination</label>
                <p-select
                  inputId="transfer-target"
                  [options]="transferTargets"
                  [(ngModel)]="transferTarget"
                  optionLabel="label"
                  optionValue="value"
                  styleClass="w-full"
                  placeholder="Select wallet"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-semibold text-gray-700" for="transfer-amount">Amount</label>
                <p-inputNumber
                  inputId="transfer-amount"
                  [(ngModel)]="transferAmount"
                  [min]="1"
                  mode="decimal"
                  styleClass="w-full"
                  inputStyleClass="w-full"
                  placeholder="Enter amount"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-semibold text-gray-700" for="transfer-pin">Transaction PIN</label>
                <input
                  id="transfer-pin"
                  pInputText
                  type="password"
                  class="w-full"
                  placeholder="4-digit PIN"
                  [(ngModel)]="transferPin"
                />
              </div>
              <p-button
                label="Move funds"
                styleClass="w-full"
                [loading]="busy()"
                (onClick)="transfer()"
              />
            </div>
          </div>
        }
      </app-legacy-panel>

      <app-legacy-panel title="History" [padded]="false">
        @if (items().length === 0) {
          <p class="px-5 py-8 text-sm text-mlm-secondary sm:px-6">No activity yet.</p>
        } @else {
          <ul class="divide-y divide-gray-100">
            @for (item of items(); track item.id) {
              <li class="flex items-start justify-between gap-3 px-5 py-4 text-sm sm:px-6">
                <div>
                  <p class="font-medium text-mlm-text">{{ item.description }}</p>
                  <p class="text-xs text-mlm-secondary">{{ item.date | date: 'medium' }}</p>
                </div>
                <span
                  class="font-semibold tabular-nums"
                  [class]="item.type === 'Credit' ? 'text-emerald-700' : 'text-mlm-text'"
                >
                  {{ item.type === 'Credit' ? '+' : '−' }}{{ money(item.amount) }}
                </span>
              </li>
            }
          </ul>
        }
      </app-legacy-panel>
    </app-legacy-page-shell>
  `,
})
export class LegacyCashoutComponent implements OnInit {
  private legacyClub = inject(LegacyClubService);
  private auth = inject(AuthService);
  private userService = inject(UserService);
  private onboarding = inject(OnboardingService);
  private router = inject(Router);
  private messages = inject(MessageService);

  balance = signal(0);
  successlineCount = signal(0);
  canCashout = signal(false);
  items = signal<LegacyCashoutLedgerItem[]>([]);
  busy = signal(false);
  bank = signal<{ bankName: string; accountNumber: string; accountName: string } | null>(null);
  isImpersonating = computed(() => !!this.auth.impersonation());
  hasBank = computed(() => !!this.bank());
  bankLabel = computed(() => {
    const b = this.bank();
    if (!b) return '';
    return `${b.bankName} · ${b.accountNumber}`;
  });

  withdrawAmount: number | null = null;
  pin = '';
  transferAmount: number | null = null;
  transferPin = '';
  transferTarget: LegacyCashoutTransferTarget = 'CASH';

  transferTargets = [
    { label: 'Cash', value: 'CASH' as const },
    { label: 'Network Product Voucher', value: 'VOUCHER' as const },
    { label: 'Autoship', value: 'AUTOSHIP' as const },
    { label: 'Legacy product voucher', value: 'LEGACY_VOUCHER' as const },
  ];

  ngOnInit(): void {
    this.loadBank();
    this.legacyClub.loadMe().subscribe({
      next: (me) => {
        if (me?.status !== 'ACTIVE') {
          void this.router.navigate(['/legacy']);
          return;
        }
        this.canCashout.set(!!me.canCashoutLegacy && !!me.legacyCashout);
        this.reload();
      },
    });
  }

  money(amount: number): string {
    return formatLegacyMoney(amount, this.legacyClub.me()?.currency ?? 'NGN');
  }

  successlineHint(): string {
    const count = this.successlineCount();
    return `${count} Successline${count === 1 ? '' : 's'} · unlocked`;
  }

  reload(): void {
    this.legacyClub.getCashout().subscribe({
      next: (res) => {
        this.balance.set(res.balance);
        this.successlineCount.set(res.directSuccesslineCount);
        this.canCashout.set(res.canCashoutLegacy !== false);
        this.items.set(res.items);
      },
    });
  }

  withdraw(): void {
    if (!this.withdrawAmount || !this.pin || this.isImpersonating() || !this.canCashout()) return;
    const bank = this.bank();
    if (!bank) {
      this.messages.add({
        severity: 'warn',
        summary: 'Bank details',
        detail: 'Add bank details in Profile before cashing out.',
      });
      return;
    }
    this.busy.set(true);
    this.legacyClub
      .withdrawCashout({
        amount: this.withdrawAmount,
        currency: this.legacyClub.me()?.currency ?? 'NGN',
        pin: this.pin,
        bankName: bank.bankName,
        accountNumber: bank.accountNumber,
        accountName: bank.accountName,
      })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.withdrawAmount = null;
          this.pin = '';
          this.reload();
          this.messages.add({
            severity: 'success',
            summary: 'Submitted',
            detail: 'Legacy cash out submitted.',
          });
        },
        error: (err) => {
          this.busy.set(false);
          this.messages.add({
            severity: 'error',
            summary: 'Cash out failed',
            detail: legacyErrorMessage(err),
          });
        },
      });
  }

  transfer(): void {
    if (!this.transferAmount || !this.transferPin || this.isImpersonating() || !this.canCashout())
      return;
    this.busy.set(true);
    this.legacyClub
      .transferCashout({
        toWalletType: this.transferTarget,
        amount: this.transferAmount,
        currency: this.legacyClub.me()?.currency ?? 'NGN',
        pin: this.transferPin,
      })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.transferAmount = null;
          this.transferPin = '';
          this.reload();
          this.messages.add({
            severity: 'success',
            summary: 'Moved',
            detail: 'Funds moved from Legacy account.',
          });
        },
        error: (err) => {
          this.busy.set(false);
          this.messages.add({
            severity: 'error',
            summary: 'Transfer failed',
            detail: legacyErrorMessage(err),
          });
        },
      });
  }

  private loadBank(): void {
    const user = this.userService.currentUser();
    if (user?.bankName && user?.accountNumber && user?.accountName) {
      this.bank.set({
        bankName: user.bankName,
        accountNumber: user.accountNumber,
        accountName: user.accountName,
      });
    }
    this.onboarding.getBankDetails().subscribe({
      next: (data: Record<string, unknown>) => {
        const bankName = String(data['bankName'] ?? data['bank_name'] ?? '');
        const accountNumber = String(
          data['accountNumber'] ??
            data['account_number'] ??
            data['accountNumberMasked'] ??
            data['account_number_masked'] ??
            '',
        );
        const accountName = String(data['accountName'] ?? data['account_name'] ?? '');
        if (bankName && accountNumber && accountName) {
          this.bank.set({ bankName, accountNumber, accountName });
        }
      },
      error: () => undefined,
    });
  }
}
