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
  isLegacyMember,
  LEGACY_ERROR_CODES,
} from '../../../core/models/legacy-club.models';
import { formatLegacyMoney } from '../../../core/utils/legacy-money.util';
import { legacyErrorMessage } from '../../../core/utils/legacy-error.util';
import { LegacyPageShellComponent } from '../components/legacy-page-shell.component';
import { LegacyPageHeaderComponent } from '../components/legacy-page-header.component';
import { LegacyPanelComponent } from '../components/legacy-panel.component';
import { LegacyBalanceBannerComponent } from '../components/legacy-balance-banner.component';

type ActionStep = 'form' | 'pin';

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
        [subtitle]="restrictionHint()"
        backLink="/legacy/home"
        backLabel="Legacy Club"
      />

      <div class="flex max-w-4xl flex-col gap-8">
        <app-legacy-panel>
          <app-legacy-balance-banner
            label="Available balance"
            [amount]="money(balance())"
            [hint]="successlineHint()"
          />
        </app-legacy-panel>

        @if (isImpersonating()) {
          <app-legacy-panel>
            <p class="text-sm text-mlm-secondary">
              Cash out and move are disabled during impersonation.
            </p>
          </app-legacy-panel>
        } @else if (!canCashout()) {
          <app-legacy-panel>
            <p class="text-sm text-mlm-secondary">{{ lockMessage() }}</p>
          </app-legacy-panel>
        } @else {
          <div class="grid gap-8 lg:grid-cols-2">
            <!-- Cash out -->
            <app-legacy-panel title="Cash out">
              @if (!hasPin()) {
                <div
                  class="rounded-xl border border-amber-100 bg-amber-50/50 p-5"
                  data-testid="legacy-cashout-pin-setup"
                >
                  <div class="flex items-start gap-3">
                    <i class="pi pi-shield mt-0.5 shrink-0 text-lg text-amber-600"></i>
                    <div>
                      <p class="font-semibold text-mlm-text">Set your Transaction PIN</p>
                      <p class="mt-1 text-sm leading-relaxed text-mlm-secondary">
                        You need a 4-digit PIN before you can cash out Legacy earnings.
                      </p>
                    </div>
                  </div>
                  <a
                    routerLink="/profile"
                    [queryParams]="{ pinAction: 'setup' }"
                    fragment="transaction-pin"
                    class="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-mlm-primary px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  >
                    Set Transaction PIN
                  </a>
                </div>
              } @else if (withdrawStep() === 'pin') {
                <div class="space-y-6">
                  <div
                    class="rounded-xl border border-mlm-primary/10 bg-mlm-primary/5 p-5 text-center"
                  >
                    <div
                      class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-mlm-primary/10"
                    >
                      <i class="pi pi-shield text-xl text-mlm-primary"></i>
                    </div>
                    <h3 class="text-base font-bold text-mlm-text">Authorize cash out</h3>
                    <p class="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-mlm-secondary">
                      Enter your 4-digit Transaction PIN to confirm
                      <strong class="text-mlm-text">{{ money(withdrawAmountConfirm()!) }}</strong>
                      to
                      <strong class="text-mlm-text">{{ bankLabel() }}</strong>.
                    </p>
                    <input
                      id="withdraw-pin"
                      pInputText
                      type="password"
                      inputmode="numeric"
                      maxlength="4"
                      autocomplete="off"
                      class="mx-auto mt-5 block w-full max-w-xs px-4 py-3 text-center text-xl font-mono font-bold tracking-[1.2em]"
                      placeholder="••••"
                      [ngModel]="withdrawPin()"
                      (ngModelChange)="onWithdrawPinChange($event)"
                    />
                  </div>
                  <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <p-button
                      label="Back"
                      [outlined]="true"
                      severity="secondary"
                      styleClass="w-full sm:w-auto"
                      [disabled]="busy()"
                      (onClick)="backFromWithdrawPin()"
                    />
                    <p-button
                      label="Confirm cash out"
                      styleClass="w-full sm:w-auto"
                      [loading]="busy()"
                      [disabled]="!canConfirmWithdraw()"
                      (onClick)="confirmWithdraw()"
                    />
                  </div>
                </div>
              } @else {
                @if (bankLabel()) {
                  <p class="text-sm text-mlm-secondary">Payout to {{ bankLabel() }}</p>
                } @else {
                  <div
                    class="rounded-xl border border-amber-100 bg-amber-50/50 p-4 text-sm text-mlm-secondary"
                  >
                    Add bank details in Profile before cashing out.
                    <a
                      routerLink="/profile"
                      class="ml-1 font-semibold text-mlm-primary hover:underline"
                      >Open profile</a
                    >
                  </div>
                }

                <div class="mt-6 flex flex-col gap-1.5">
                  <label class="text-sm font-semibold text-gray-700" for="withdraw-amount"
                    >Amount</label
                  >
                  <p-inputNumber
                    inputId="withdraw-amount"
                    [(ngModel)]="withdrawAmount"
                    [min]="1"
                    [max]="balance()"
                    mode="decimal"
                    styleClass="w-full"
                    inputStyleClass="w-full"
                    placeholder="Enter amount"
                  />
                  @if (withdrawAmountError()) {
                    <p class="text-xs font-medium text-red-600">{{ withdrawAmountError() }}</p>
                  }
                </div>

                <p-button
                  label="Continue"
                  styleClass="mt-6 w-full"
                  [disabled]="!hasBank()"
                  (onClick)="beginWithdraw()"
                />
              }
            </app-legacy-panel>

            <!-- Move funds -->
            <app-legacy-panel title="Move to another wallet">
              @if (!hasPin()) {
                <div
                  class="rounded-xl border border-amber-100 bg-amber-50/50 p-5"
                  data-testid="legacy-transfer-pin-setup"
                >
                  <div class="flex items-start gap-3">
                    <i class="pi pi-shield mt-0.5 shrink-0 text-lg text-amber-600"></i>
                    <div>
                      <p class="font-semibold text-mlm-text">Set your Transaction PIN</p>
                      <p class="mt-1 text-sm leading-relaxed text-mlm-secondary">
                        You need a 4-digit PIN before you can move Legacy funds.
                      </p>
                    </div>
                  </div>
                  <a
                    routerLink="/profile"
                    [queryParams]="{ pinAction: 'setup' }"
                    fragment="transaction-pin"
                    class="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-mlm-primary px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  >
                    Set Transaction PIN
                  </a>
                </div>
              } @else if (transferStep() === 'pin') {
                <div class="space-y-6">
                  <div
                    class="rounded-xl border border-mlm-primary/10 bg-mlm-primary/5 p-5 text-center"
                  >
                    <div
                      class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-mlm-primary/10"
                    >
                      <i class="pi pi-shield text-xl text-mlm-primary"></i>
                    </div>
                    <h3 class="text-base font-bold text-mlm-text">Authorize transfer</h3>
                    <p class="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-mlm-secondary">
                      Enter your 4-digit Transaction PIN to move
                      <strong class="text-mlm-text">{{ money(transferAmountConfirm()!) }}</strong>
                      to
                      <strong class="text-mlm-text">{{ transferTargetLabel() }}</strong>.
                    </p>
                    <input
                      id="transfer-pin"
                      pInputText
                      type="password"
                      inputmode="numeric"
                      maxlength="4"
                      autocomplete="off"
                      class="mx-auto mt-5 block w-full max-w-xs px-4 py-3 text-center text-xl font-mono font-bold tracking-[1.2em]"
                      placeholder="••••"
                      [ngModel]="transferPin()"
                      (ngModelChange)="onTransferPinChange($event)"
                    />
                  </div>
                  <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <p-button
                      label="Back"
                      [outlined]="true"
                      severity="secondary"
                      styleClass="w-full sm:w-auto"
                      [disabled]="busy()"
                      (onClick)="backFromTransferPin()"
                    />
                    <p-button
                      label="Confirm move"
                      styleClass="w-full sm:w-auto"
                      [loading]="busy()"
                      [disabled]="!canConfirmTransfer()"
                      (onClick)="confirmTransfer()"
                    />
                  </div>
                </div>
              } @else {
                <div class="flex flex-col gap-1.5">
                  <label class="text-sm font-semibold text-gray-700" for="transfer-target"
                    >Destination</label
                  >
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

                <div class="mt-6 flex flex-col gap-1.5">
                  <label class="text-sm font-semibold text-gray-700" for="transfer-amount"
                    >Amount</label
                  >
                  <p-inputNumber
                    inputId="transfer-amount"
                    [(ngModel)]="transferAmount"
                    [min]="1"
                    [max]="balance()"
                    mode="decimal"
                    styleClass="w-full"
                    inputStyleClass="w-full"
                    placeholder="Enter amount"
                  />
                  @if (transferAmountError()) {
                    <p class="text-xs font-medium text-red-600">{{ transferAmountError() }}</p>
                  }
                </div>

                <p-button
                  label="Continue"
                  styleClass="mt-6 w-full"
                  (onClick)="beginTransfer()"
                />
              }
            </app-legacy-panel>
          </div>
        }

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
      </div>
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

  withdrawStep = signal<ActionStep>('form');
  transferStep = signal<ActionStep>('form');
  withdrawAmountConfirm = signal<number | null>(null);
  transferAmountConfirm = signal<number | null>(null);
  withdrawPin = signal('');
  transferPin = signal('');
  withdrawAmountError = signal('');
  transferAmountError = signal('');

  isImpersonating = computed(() => !!this.auth.impersonation());
  hasPin = computed(() => this.userService.currentUser()?.hasTransactionPin ?? false);
  hasBank = computed(() => !!this.bank());
  bankLabel = computed(() => {
    const b = this.bank();
    if (!b) return '';
    return `${b.bankName} · ${b.accountNumber}`;
  });

  withdrawAmount: number | null = null;
  transferAmount: number | null = null;
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
        if (!isLegacyMember(me)) {
          void this.router.navigate(['/legacy/home']);
          return;
        }
        const walletOk = me?.legacyCashout?.status !== 'LOCKED';
        this.canCashout.set(!!me?.canCashoutLegacy && !!me.legacyCashout && walletOk);
        this.reload();
      },
    });
  }

  restrictionHint(): string {
    if (this.canCashout()) return 'Cash out to your bank or move funds to another wallet.';
    return 'Legacy account ledger';
  }

  lockMessage(): string {
    return (
      this.legacyClub.me()?.cashoutRestrictionReason ??
      'Transfer and withdraw are locked until you reactivate or meet eligibility.'
    );
  }

  money(amount: number): string {
    return formatLegacyMoney(amount, this.legacyClub.me()?.currency ?? 'NGN');
  }

  successlineHint(): string {
    const count = this.successlineCount();
    return `${count} Successline${count === 1 ? '' : 's'} · unlocked`;
  }

  transferTargetLabel(): string {
    return (
      this.transferTargets.find((target) => target.value === this.transferTarget)?.label ??
      'selected wallet'
    );
  }

  onWithdrawPinChange(value: string): void {
    this.withdrawPin.set(value.replace(/\D/g, '').slice(0, 4));
  }

  onTransferPinChange(value: string): void {
    this.transferPin.set(value.replace(/\D/g, '').slice(0, 4));
  }

  canConfirmWithdraw(): boolean {
    return /^\d{4}$/.test(this.withdrawPin()) && !this.busy();
  }

  canConfirmTransfer(): boolean {
    return /^\d{4}$/.test(this.transferPin()) && !this.busy();
  }

  beginWithdraw(): void {
    this.withdrawAmountError.set('');
    if (this.isImpersonating() || !this.canCashout() || !this.hasPin()) return;

    const amount = this.withdrawAmount;
    if (!amount || amount <= 0) {
      this.withdrawAmountError.set('Enter a valid amount.');
      return;
    }
    if (amount > this.balance()) {
      this.withdrawAmountError.set('Amount exceeds your available Legacy balance.');
      return;
    }
    if (!this.hasBank()) {
      this.messages.add({
        severity: 'warn',
        summary: 'Bank details',
        detail: 'Add bank details in Profile before cashing out.',
      });
      return;
    }

    this.withdrawAmountConfirm.set(amount);
    this.withdrawPin.set('');
    this.withdrawStep.set('pin');
  }

  backFromWithdrawPin(): void {
    this.withdrawPin.set('');
    this.withdrawAmountConfirm.set(null);
    this.withdrawStep.set('form');
  }

  confirmWithdraw(): void {
    const amount = this.withdrawAmountConfirm();
    if (!amount || !this.canConfirmWithdraw() || this.isImpersonating() || !this.canCashout()) {
      return;
    }

    const bank = this.bank();
    if (!bank) {
      this.messages.add({
        severity: 'warn',
        summary: 'Bank details',
        detail: 'Add bank details in Profile before cashing out.',
      });
      this.backFromWithdrawPin();
      return;
    }

    this.busy.set(true);
    this.legacyClub
      .withdrawCashout({
        amount,
        currency: this.legacyClub.me()?.currency ?? 'NGN',
        pin: this.withdrawPin(),
      })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.withdrawAmount = null;
          this.backFromWithdrawPin();
          this.reload();
          this.messages.add({
            severity: 'success',
            summary: 'Submitted',
            detail: 'Legacy cash out submitted.',
          });
        },
        error: (err) => {
          this.busy.set(false);
          this.withdrawPin.set('');
          this.messages.add({
            severity: 'error',
            summary: 'Cash out failed',
            detail: legacyErrorMessage(err),
          });
          if ((err as { code?: string })?.code === LEGACY_ERROR_CODES.LEGACY_CASHOUT_LOCKED) {
            return;
          }
        },
      });
  }

  beginTransfer(): void {
    this.transferAmountError.set('');
    if (this.isImpersonating() || !this.canCashout() || !this.hasPin()) return;

    const amount = this.transferAmount;
    if (!amount || amount <= 0) {
      this.transferAmountError.set('Enter a valid amount.');
      return;
    }
    if (amount > this.balance()) {
      this.transferAmountError.set('Amount exceeds your available Legacy balance.');
      return;
    }

    this.transferAmountConfirm.set(amount);
    this.transferPin.set('');
    this.transferStep.set('pin');
  }

  backFromTransferPin(): void {
    this.transferPin.set('');
    this.transferAmountConfirm.set(null);
    this.transferStep.set('form');
  }

  confirmTransfer(): void {
    const amount = this.transferAmountConfirm();
    if (!amount || !this.canConfirmTransfer() || this.isImpersonating() || !this.canCashout()) {
      return;
    }

    this.busy.set(true);
    this.legacyClub
      .transferCashout({
        toWalletType: this.transferTarget,
        amount,
        currency: this.legacyClub.me()?.currency ?? 'NGN',
        pin: this.transferPin(),
      })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.transferAmount = null;
          this.backFromTransferPin();
          this.reload();
          this.messages.add({
            severity: 'success',
            summary: 'Moved',
            detail: 'Funds moved from Legacy account.',
          });
        },
        error: (err) => {
          this.busy.set(false);
          this.transferPin.set('');
          this.messages.add({
            severity: 'error',
            summary: 'Transfer failed',
            detail: legacyErrorMessage(err),
          });
        },
      });
  }

  reload(): void {
    this.legacyClub.getCashout().subscribe({
      next: (res) => {
        this.balance.set(res.balance);
        this.successlineCount.set(res.directSuccesslineCount);
        const me = this.legacyClub.me();
        const walletOk = res.walletStatus !== 'LOCKED';
        this.canCashout.set(res.canCashoutLegacy !== false && walletOk && !!me?.canCashoutLegacy);
        this.items.set(res.items);
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
