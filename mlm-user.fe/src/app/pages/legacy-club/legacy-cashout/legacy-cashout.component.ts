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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-mlm-background">
      <main class="py-8">
        <div class="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
      <a routerLink="/legacy" class="text-sm font-medium text-mlm-primary hover:underline">← Legacy Club</a>
      <div>
        <h1 class="text-2xl font-bold text-mlm-text">Legacy account</h1>
        <p class="mt-1 text-sm text-mlm-secondary">You can cash out your Legacy account at any time.</p>
      </div>

      <div class="rounded-2xl bg-mlm-primary px-6 py-7 text-center sm:px-8">
        <p class="text-xs font-bold uppercase tracking-[.15em] text-white/60">Balance</p>
        <p class="mt-3 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">{{ money(balance()) }}</p>
        <p class="mt-2 text-sm text-white/70">
          {{ successlineCount() }} Successline{{ successlineCount() === 1 ? '' : 's' }} · unlocked
        </p>
      </div>

      @if (isImpersonating()) {
        <p class="rounded-xl border border-gray-100 bg-white px-5 py-4 text-sm text-mlm-secondary">
          Cash out and move are disabled during impersonation.
        </p>
      } @else if (!canCashout()) {
        <p class="rounded-xl border border-gray-100 bg-white px-5 py-4 text-sm text-mlm-secondary">
          Legacy account is not available yet.
        </p>
      } @else {
        <div class="grid gap-5 lg:grid-cols-2">
          <div class="rounded-2xl border border-gray-100 bg-white p-6 sm:p-7 space-y-4">
            <h2 class="font-semibold text-mlm-text">Cash out</h2>
            @if (bankLabel()) {
              <p class="text-sm text-mlm-secondary">Payout to {{ bankLabel() }}</p>
            } @else {
              <p class="text-sm text-amber-800">
                Add bank details in Profile before cashing out.
                <a routerLink="/profile" class="font-medium underline">Open profile</a>
              </p>
            }
            <p-inputNumber
              [(ngModel)]="withdrawAmount"
              [min]="1"
              mode="decimal"
              styleClass="w-full"
              inputStyleClass="w-full"
              placeholder="Amount"
            />
            <input pInputText type="password" class="w-full" placeholder="PIN" [(ngModel)]="pin" />
            <p-button
              label="Cash out"
              styleClass="w-full"
              [loading]="busy()"
              [disabled]="!hasBank()"
              (onClick)="withdraw()"
            />
          </div>

          <div class="rounded-2xl border border-gray-100 bg-white p-6 sm:p-7 space-y-4">
            <h2 class="font-semibold text-mlm-text">Move to another wallet</h2>
            <p-select
              [options]="transferTargets"
              [(ngModel)]="transferTarget"
              optionLabel="label"
              optionValue="value"
              styleClass="w-full"
              placeholder="Destination"
            />
            <p-inputNumber
              [(ngModel)]="transferAmount"
              [min]="1"
              mode="decimal"
              styleClass="w-full"
              inputStyleClass="w-full"
              placeholder="Amount"
            />
            <input
              pInputText
              type="password"
              class="w-full"
              placeholder="PIN"
              [(ngModel)]="transferPin"
            />
            <p-button
              label="Move"
              [outlined]="true"
              styleClass="w-full"
              [loading]="busy()"
              (onClick)="transfer()"
            />
          </div>
        </div>
      }

      <div class="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <div class="border-b border-gray-100 px-5 py-4 text-sm font-semibold text-mlm-text sm:px-6">
          History
        </div>
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
                  class="font-semibold"
                  [class]="item.type === 'Credit' ? 'text-emerald-700' : 'text-mlm-text'"
                >
                  {{ item.type === 'Credit' ? '+' : '−' }}{{ money(item.amount) }}
                </span>
              </li>
            }
          </ul>
        }
      </div>
        </div>
      </main>
    </div>
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
