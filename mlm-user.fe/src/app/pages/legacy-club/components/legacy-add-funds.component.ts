import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { AuthService } from '../../../services/auth.service';
import { UserService } from '../../../services/user.service';
import { WalletService, type TransferToWalletType } from '../../../services/wallet.service';
import { LegacyPanelComponent } from './legacy-panel.component';

type SourceWallet = 'CASH' | 'REGISTRATION';

const SOURCE_OPTIONS: { value: SourceWallet; label: string }[] = [
  { value: 'CASH', label: 'Cash wallet' },
  { value: 'REGISTRATION', label: 'Registration wallet' },
];

@Component({
  selector: 'app-legacy-add-funds',
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    ButtonModule,
    InputNumberModule,
    SelectModule,
    LegacyPanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isImpersonating()) {
      <app-legacy-panel title="Add money">
        <p class="text-sm text-mlm-secondary">
          Funding and transfers are disabled during impersonation.
        </p>
      </app-legacy-panel>
    } @else {
      <div class="grid gap-6 lg:grid-cols-2">
        <app-legacy-panel title="Fund" description="Pay in new money">
          <p class="text-sm leading-relaxed text-mlm-secondary">
            Add money with an online payment or a bank transfer. Bank transfers are credited after
            admin approval.
          </p>
          <div class="mt-6">
            <p-button label="Fund" icon="pi pi-plus" styleClass="w-full" (onClick)="fund()" />
          </div>
        </app-legacy-panel>

        <app-legacy-panel title="Transfer" description="Move money you already have">
          <p class="text-sm leading-relaxed text-mlm-secondary">
            Move money from your Cash wallet or Registration wallet into your {{ destinationLabel() }}.
          </p>

          <form class="mt-6 space-y-4" [formGroup]="transferForm" (ngSubmit)="transfer()">
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-semibold text-gray-700" for="legacy-transfer-source">
                Transfer from
              </label>
              <p-select
                inputId="legacy-transfer-source"
                formControlName="fromWalletType"
                [options]="sourceOptions"
                optionLabel="label"
                optionValue="value"
                styleClass="w-full"
                appendTo="body"
              />
              <p class="text-xs text-mlm-secondary">
                Available {{ currencySymbol() }}{{ sourceBalance() | number: '1.2-2' }}
              </p>
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-semibold text-gray-700" for="legacy-transfer-amount">
                Amount
              </label>
              <p-inputNumber
                inputId="legacy-transfer-amount"
                formControlName="amount"
                mode="currency"
                [currency]="currency()"
                currencyDisplay="symbol"
                [min]="1"
                [max]="sourceBalance()"
                fluid="true"
                placeholder="0.00"
              />
              @if (amountInvalid()) {
                <p class="text-xs font-medium text-red-600">
                  Enter an amount from {{ currencySymbol() }}1 up to your available balance.
                </p>
              }
            </div>

            <p-button
              type="submit"
              label="Transfer"
              icon="pi pi-arrow-right"
              styleClass="w-full"
              [loading]="submitting()"
              [disabled]="transferForm.invalid || submitting() || sourceBalance() < 1"
            />
          </form>
        </app-legacy-panel>
      </div>
    }
  `,
})
export class LegacyAddFundsComponent implements OnInit {
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private userService = inject(UserService);
  private walletService = inject(WalletService);
  private destroyRef = inject(DestroyRef);

  destination = input.required<Extract<TransferToWalletType, 'LEGACY_VOUCHER' | 'LEGACY_CASHOUT'>>();
  transferred = output<void>();

  sourceOptions = SOURCE_OPTIONS;
  submitting = signal(false);
  private source = signal<SourceWallet>('CASH');

  isImpersonating = computed(() => !!this.auth.impersonation());
  currency = computed(() => this.userService.displayCurrency());
  currencySymbol = computed(() => (this.currency() === 'NGN' ? '₦' : '$'));
  destinationLabel = computed(() =>
    this.destination() === 'LEGACY_VOUCHER' ? 'Legacy product voucher' : 'Legacy cashout',
  );

  transferForm = this.fb.group({
    fromWalletType: ['CASH' as SourceWallet, Validators.required],
    amount: [null as number | null, [Validators.required, Validators.min(1)]],
  });

  sourceBalance = computed(() => {
    const wallet = this.walletService.allWallets().find((item) => item.currency === this.currency());
    if (this.source() === 'REGISTRATION') {
      return wallet?.registrationBalance ?? 0;
    }
    return wallet?.cashBalance ?? 0;
  });

  ngOnInit(): void {
    this.walletService.fetchWallets().subscribe();
    this.transferForm
      .get('fromWalletType')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        if (value === 'CASH' || value === 'REGISTRATION') {
          this.source.set(value);
        }
      });
  }

  amountInvalid(): boolean {
    const control = this.transferForm.get('amount');
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  fund(): void {
    void this.router.navigate(['/payments/fund'], {
      queryParams: { walletType: this.destination() },
    });
  }

  transfer(): void {
    if (this.transferForm.invalid || this.isImpersonating()) {
      this.transferForm.markAllAsTouched();
      return;
    }

    const fromWalletType = this.transferForm.value.fromWalletType;
    const amount = this.transferForm.value.amount;
    if (!fromWalletType || amount == null || amount < 1) return;

    this.submitting.set(true);
    this.walletService
      .transferBetweenWallets({
        fromWalletType,
        toWalletType: this.destination(),
        amount,
        currency: this.currency(),
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.transferForm.patchValue({ amount: null });
          this.transferForm.markAsPristine();
          this.transferred.emit();
        },
        error: () => {
          this.submitting.set(false);
        },
      });
  }
}
