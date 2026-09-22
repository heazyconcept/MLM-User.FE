import {
  Component,
  ChangeDetectionStrategy,
  OnDestroy,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { LegacyClubService } from '../../../services/legacy-club.service';
import { LegacyPaymentService } from '../../../services/legacy-payment.service';
import { RegistrationService } from '../../../services/registration.service';
import {
  LegacyMe,
  LegacyPackageCode,
  LegacyPaymentMethod,
  LegacyPaymentPurpose,
  paymentAmountFromMe,
} from '../../../core/models/legacy-club.models';
import { legacyPaymentPurposeLabel } from '../../../core/utils/legacy-routing.util';
import { formatLegacyMoney } from '../../../core/utils/legacy-money.util';
import { legacyErrorMessage } from '../../../core/utils/legacy-error.util';
import { LegacyClubHttpError } from '../../../core/mocks/legacy-club.mock';
import {
  EVIDENCE_ACCEPT,
  validateEvidenceFile,
} from '../../../core/utils/evidence-file.util';
import { LegacyPageShellComponent } from '../components/legacy-page-shell.component';
import { LegacyPageHeaderComponent } from '../components/legacy-page-header.component';
import { LegacyPanelComponent } from '../components/legacy-panel.component';

type PayTab = 'wallet' | 'manual';

@Component({
  selector: 'app-legacy-pay',
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    LegacyPageShellComponent,
    LegacyPageHeaderComponent,
    LegacyPanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-legacy-page-shell>
      <app-legacy-page-header
        [title]="pageTitle()"
        [subtitle]="pageSubtitle()"
        backLink="/legacy"
        backLabel="Legacy Club"
      />

      <div class="flex max-w-2xl flex-col gap-8">
        @if (pendingManual()) {
          <app-legacy-panel title="Payment pending review">
            <p class="text-sm leading-relaxed text-mlm-text">
              Your manual payment is awaiting admin approval. We will activate your membership once
              approved.
            </p>
            <p class="text-sm text-mlm-secondary">Checking status every 15 seconds…</p>
          </app-legacy-panel>
        } @else {
          <app-legacy-panel>
            <p class="text-xs font-bold uppercase tracking-[.15em] text-mlm-secondary">Amount due</p>
            <p class="mt-3 text-4xl font-extrabold tracking-tight text-mlm-text">
              {{ money(amountDue()) }}
            </p>
            @if (instantLine(); as instant) {
              <p class="mt-4 text-sm leading-relaxed text-emerald-800">{{ instant }}</p>
            }
          </app-legacy-panel>

          <app-legacy-panel title="How would you like to pay?">
            <div class="flex flex-wrap gap-3">
              @if (hasWalletMethod()) {
                <button
                  type="button"
                  class="rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors"
                  [class]="
                    tab() === 'wallet'
                      ? 'bg-mlm-primary text-white'
                      : 'border border-gray-200 text-mlm-text hover:bg-gray-50'
                  "
                  (click)="tab.set('wallet')"
                >
                  Registration wallet
                </button>
              }
              @if (hasManualMethod()) {
                <button
                  type="button"
                  class="rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors"
                  [class]="
                    tab() === 'manual'
                      ? 'bg-mlm-primary text-white'
                      : 'border border-gray-200 text-mlm-text hover:bg-gray-50'
                  "
                  (click)="tab.set('manual')"
                >
                  Manual bank
                </button>
              }
            </div>

            @if (tab() === 'wallet' && hasWalletMethod()) {
              <div class="mt-8 space-y-6">
                <p class="text-sm text-mlm-secondary">
                  Balance:
                  <span class="font-semibold text-mlm-text">{{ money(walletBalance()) }}</span>
                </p>
                <div class="flex flex-col gap-2">
                  <label class="text-sm font-semibold text-gray-700" for="pay-pin">
                    Transaction PIN
                  </label>
                  <input
                    id="pay-pin"
                    pInputText
                    type="password"
                    class="w-full max-w-xs"
                    placeholder="4-digit PIN"
                    inputmode="numeric"
                    autocomplete="off"
                    maxlength="4"
                    [ngModel]="pin()"
                    (ngModelChange)="onPinChange($event)"
                  />
                </div>
                @if (error()) {
                  <p class="text-sm text-red-800">{{ error() }}</p>
                }
                @if (payHint(); as hint) {
                  <p class="text-sm text-amber-800">{{ hint }}</p>
                }
                <p-button
                  label="Pay from registration wallet"
                  [loading]="submitting()"
                  [disabled]="!canPayWallet()"
                  (onClick)="payWallet()"
                />
              </div>
            }

            @if (tab() === 'manual' && hasManualMethod()) {
              <div class="mt-8 space-y-6">
                @if (companyBank(); as bank) {
                  <div class="rounded-xl border border-gray-100 bg-gray-50/80 p-5 text-sm">
                    <p class="font-semibold text-mlm-text">{{ bank.bankName }}</p>
                    <p class="mt-2 text-mlm-text">{{ bank.accountNumber }}</p>
                    <p class="mt-1 text-mlm-secondary">{{ bank.accountName }}</p>
                  </div>
                } @else {
                  <p class="text-sm text-mlm-secondary">Bank details unavailable. Try again later.</p>
                }
                <div class="flex flex-col gap-2">
                  <label class="text-sm font-semibold text-gray-700" for="depositor">
                    Depositor name
                  </label>
                  <input
                    id="depositor"
                    pInputText
                    class="w-full max-w-md"
                    [(ngModel)]="depositorName"
                  />
                </div>
                <div class="flex flex-col gap-2">
                  <label class="text-sm font-semibold text-gray-700" for="evidence">
                    Payment proof
                  </label>
                  <input
                    id="evidence"
                    type="file"
                    [accept]="evidenceAccept"
                    (change)="onEvidence($event)"
                  />
                </div>
                @if (error()) {
                  <p class="text-sm text-red-800">{{ error() }}</p>
                }
                <p-button
                  label="Submit manual payment"
                  [loading]="submitting()"
                  [disabled]="!canSubmitManual()"
                  (onClick)="submitManual()"
                />
              </div>
            }
          </app-legacy-panel>
        }

        @if (rejectionReason()) {
          <app-legacy-panel title="Payment rejected">
            <p class="text-sm text-red-800">{{ rejectionReason() }}</p>
            <p class="text-sm text-mlm-secondary">You can submit again with new proof.</p>
          </app-legacy-panel>
        }
      </div>
    </app-legacy-page-shell>
  `,
})
export class LegacyPayComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private legacyClub = inject(LegacyClubService);
  private paymentService = inject(LegacyPaymentService);
  private registrationService = inject(RegistrationService);
  private messages = inject(MessageService);

  purpose = signal<LegacyPaymentPurpose>('JOIN');
  tab = signal<PayTab>('wallet');
  walletBalance = signal(0);
  companyBank = signal<{ bankName: string; accountNumber: string; accountName: string } | null>(
    null,
  );
  pin = signal('');
  packageAmount = signal(0);
  depositorName = '';
  evidenceFile = signal<File | null>(null);
  submitting = signal(false);
  error = signal<string | null>(null);
  pendingManual = signal(false);
  rejectionReason = signal<string | null>(null);
  requestKey = signal('');
  private pollSub: Subscription | null = null;

  readonly evidenceAccept = EVIDENCE_ACCEPT;

  me = this.legacyClub.me;

  amountDue = computed(() => {
    const fromMe = paymentAmountFromMe(this.me());
    return fromMe > 0 ? fromMe : this.packageAmount();
  });

  pageTitle = computed(() => legacyPaymentPurposeLabel(this.purpose()));

  pageSubtitle = computed(() => {
    const pkg = this.me()?.membership?.package ?? this.me()?.pendingJoin?.package;
    if (pkg && this.purpose() === 'JOIN') return `Complete payment for ${pkg} membership.`;
    if (this.purpose() === 'UPGRADE') return 'Pay the package difference to upgrade.';
    return 'Pay to reactivate your Legacy Club membership.';
  });

  instantLine = computed(() => {
    const me = this.me();
    if (!me || this.purpose() === 'JOIN') {
      const pkg = me?.pendingJoin?.package;
      if (pkg) return `Instant commission credited to your Legacy account after approval.`;
    }
    return null;
  });

  paymentMethods = computed((): LegacyPaymentMethod[] => {
    const methods = this.me()?.pendingPayment?.paymentMethods;
    if (methods?.length) return methods;
    return ['REGISTRATION_WALLET', 'MANUAL_BANK'];
  });

  hasWalletMethod = computed(() => this.paymentMethods().includes('REGISTRATION_WALLET'));
  hasManualMethod = computed(() => this.paymentMethods().includes('MANUAL_BANK'));

  ngOnInit(): void {
    const purpose = (this.route.snapshot.paramMap.get('purpose') ?? 'JOIN').toUpperCase();
    if (purpose === 'JOIN' || purpose === 'UPGRADE' || purpose === 'REACTIVATE') {
      this.purpose.set(purpose);
    }
    this.requestKey.set(this.paymentService.newRequestKey());

    this.legacyClub.loadMe().subscribe({
      next: (me) => {
        if (!me) return;
        this.rejectionReason.set(me.pendingPayment?.rejectionReason ?? null);
        if (me.pendingPayment && !this.hasWalletMethod()) {
          this.tab.set('manual');
        }
        this.resolvePackageAmount(me);
      },
    });

    this.registrationService.getRegistrationWallet().subscribe({
      next: (w) => this.walletBalance.set(w?.balance ?? 0),
    });
    this.legacyClub.getCompanyBankAccount().subscribe({
      next: (bank) => this.companyBank.set(bank),
    });
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
  }

  money(amount: number): string {
    return formatLegacyMoney(amount, this.me()?.currency ?? 'NGN');
  }

  canPayWallet = computed(() => {
    return (
      !this.submitting() &&
      /^\d{4}$/.test(this.pin()) &&
      this.amountDue() > 0 &&
      this.walletBalance() >= this.amountDue()
    );
  });

  payHint = computed(() => {
    if (this.canPayWallet() || this.submitting()) return null;
    if (this.amountDue() <= 0) return 'Loading the amount due for this package…';
    if (!/^\d{4}$/.test(this.pin())) return 'Enter your 4-digit transaction PIN.';
    if (this.walletBalance() < this.amountDue()) {
      return 'Your registration wallet balance is lower than the amount due.';
    }
    return null;
  });

  onPinChange(value: string): void {
    this.pin.set(value.replace(/\D/g, '').slice(0, 4));
  }

  canSubmitManual(): boolean {
    return (
      !this.submitting() &&
      !!this.companyBank() &&
      this.depositorName.trim().length >= 2 &&
      !!this.evidenceFile()
    );
  }

  payWallet(): void {
    if (!this.canPayWallet()) return;
    this.submitting.set(true);
    this.error.set(null);
    const purpose = this.purpose();
    const key = this.requestKey();

    const attempt = () => {
      this.paymentService.payWithWallet(purpose, this.pin(), key).subscribe({
        next: (me) => {
          this.submitting.set(false);
          if (me && me.status === 'ACTIVE') {
            this.messages.add({
              severity: 'success',
              summary: 'Payment complete',
              detail: 'Welcome to Legacy Club.',
            });
            void this.router.navigate(['/legacy/home']);
          } else {
            void this.router.navigateByUrl(this.legacyClub.legacyHomePath());
          }
        },
        error: (err: LegacyClubHttpError) => {
          if (err.status === 409) {
            this.requestKey.set(this.paymentService.newRequestKey());
            attempt();
            return;
          }
          this.submitting.set(false);
          this.error.set(legacyErrorMessage(err));
        },
      });
    };
    attempt();
  }

  onEvidence(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const err = validateEvidenceFile(file);
    if (err) {
      this.error.set(err);
      return;
    }
    this.error.set(null);
    this.evidenceFile.set(file);
  }

  submitManual(): void {
    if (!this.canSubmitManual()) return;
    const file = this.evidenceFile();
    if (!file) return;

    this.submitting.set(true);
    this.error.set(null);
    const fd = new FormData();
    fd.append('purpose', this.purpose());
    fd.append('requestKey', this.requestKey());
    fd.append('depositorName', this.depositorName.trim());
    fd.append('evidence', file);

    this.paymentService.submitManualPayment(fd).subscribe({
      next: () => {
        this.submitting.set(false);
        this.pendingManual.set(true);
        this.requestKey.set(this.paymentService.newRequestKey());
        this.startPolling();
        this.messages.add({
          severity: 'info',
          summary: 'Submitted',
          detail: 'Your payment is pending admin approval.',
        });
      },
      error: (err: LegacyClubHttpError) => {
        if (err.status === 409) {
          this.requestKey.set(this.paymentService.newRequestKey());
          this.submitManual();
          return;
        }
        this.submitting.set(false);
        this.error.set(legacyErrorMessage(err));
      },
    });
  }

  private resolvePackageAmount(me: LegacyMe): void {
    if (paymentAmountFromMe(me) > 0) return;
    const code = this.packageCodeFromMe(me);
    if (!code) return;

    if (this.purpose() === 'UPGRADE') {
      this.legacyClub.getUpgradeQuote(code).subscribe({
        next: (quote) => {
          if (quote.payAmount > 0) this.packageAmount.set(quote.payAmount);
        },
      });
      return;
    }

    this.legacyClub.getPackages().subscribe({
      next: (res) => {
        const pkg = res.packages.find((item) => item.code === code);
        const amount = pkg?.purchaseAmount ?? 0;
        if (amount > 0) this.packageAmount.set(amount);
      },
    });
  }

  private packageCodeFromMe(me: LegacyMe): LegacyPackageCode | null {
    return (
      me.pendingJoin?.package ??
      me.pendingUpgrade?.package ??
      me.intentPackage ??
      me.membership?.package ??
      null
    );
  }

  private startPolling(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = this.paymentService.pollUntilPaymentCleared(() => {
      const me = this.legacyClub.me();
      if (me && me.status === 'ACTIVE' && !me.pendingPayment) {
        this.pendingManual.set(false);
        void this.router.navigate(['/legacy/home']);
      }
    });
  }
}
