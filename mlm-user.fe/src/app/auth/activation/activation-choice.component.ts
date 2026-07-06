import {
  Component,
  inject,
  ChangeDetectionStrategy,
  signal,
  linkedSignal,
  ChangeDetectorRef,
  OnInit,
  computed,
  effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { MessageModule } from 'primeng/message';
import { PaymentService, type PaymentGatewayProvider } from '../../services/payment.service';
import { UserService } from '../../services/user.service';
import { RegistrationService, type RegistrationWallet, type ManualRegistrationPayment } from '../../services/registration.service';
import { getRequiredAmount, REGISTRATION_FEE_NGN, ADMIN_FEE_NGN, IPV_PERCENT, NGN_TO_USD_RATE } from '../../core/constants/registration.constants';
import {
  getDefaultGatewayProvider,
  getEnabledGatewayProviderOptions,
  getPaymentCallbackUrl,
} from '../../core/utils/payment-config.util';
import { saveUsdtPaymentSession } from '../../core/utils/usdt-payment-storage.util';
import { isUsdtInitiateResponse } from '../../services/payment-initiate.mapper';

const REGISTRATION_PROVIDER_KEY = 'mlm_registration_payment_provider';

@Component({
  selector: 'app-activation-choice',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ButtonModule, SelectModule, MessageModule],
  templateUrl: './activation-choice.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivationChoiceComponent implements OnInit {
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private paymentService = inject(PaymentService);
  private userService = inject(UserService);
  private registrationService = inject(RegistrationService);

  registrationWallet = signal<RegistrationWallet | null>(null);
  loading = signal(true);
  payingOnline = signal(false);
  activating = signal(false);
  errorMessage = signal<string | null>(null);
  pendingManualPayment = signal<ManualRegistrationPayment | null>(null);

  userCurrency = computed(() => this.userService.currentUser()?.currency ?? 'NGN');
  selectedProvider = linkedSignal<PaymentGatewayProvider>(() =>
    getDefaultGatewayProvider(this.userCurrency() === 'NGN' ? 'NGN' : 'USD')
  );

  gatewayOptions = computed(() =>
    getEnabledGatewayProviderOptions(this.userCurrency() === 'NGN' ? 'NGN' : 'USD')
  );

  userPackage = computed(() => this.userService.currentUser()?.package ?? 'NICKEL');
  selectedPackage = linkedSignal(() => this.userPackage());
  selectedPackageLabel = computed(() => {
    const pkg = this.selectedPackage();
    return pkg.charAt(0) + pkg.slice(1).toLowerCase();
  });
  requiredAmount = computed(() => getRequiredAmount(this.selectedPackage(), this.userCurrency()));

  packageBaseOptions = [
    { label: 'Nickel', value: 'NICKEL' },
    { label: 'Silver', value: 'SILVER' },
    { label: 'Gold', value: 'GOLD' },
    { label: 'Platinum', value: 'PLATINUM' },
    { label: 'Ruby', value: 'RUBY' },
    { label: 'Diamond', value: 'DIAMOND' }
  ];

  packageOptions = computed(() => {
    const currency = this.userCurrency();

    return this.packageBaseOptions.map((pkg) => ({
      ...pkg,
      label: `${pkg.label} (${this.getPackagePriceLabel(pkg.value, currency)})`
    }));
  });

  canActivate = computed(() => {
    const wallet = this.registrationWallet();
    if (!wallet) return false;
    return wallet.balance >= this.requiredAmount();
  });

  voucherCreditAmount = computed(() => {
    const pkg = this.userPackage();
    const currency = this.userCurrency();
    const regNgn = REGISTRATION_FEE_NGN[pkg] ?? REGISTRATION_FEE_NGN['NICKEL'];
    const ipvNgn = regNgn * IPV_PERCENT;
    return currency === 'NGN' ? ipvNgn : ipvNgn / NGN_TO_USD_RATE;
  });

  balanceShortfall = computed(() => {
    const wallet = this.registrationWallet();
    if (!wallet) return this.requiredAmount();
    return Math.max(0, this.requiredAmount() - wallet.balance);
  });

  constructor() {
    effect(() => {
      const opts = this.gatewayOptions();
      const current = this.selectedProvider();
      if (opts.length > 0 && !opts.some((o) => o.value === current)) {
        this.selectedProvider.set(opts[0].value);
      }
    });
  }

  ngOnInit(): void {
    if (this.userService.isPaid()) {
      this.router.navigate(['/dashboard']);
      return;
    }
    this.loadWallet();
    this.checkManualPaymentStatus();
  }

  private checkManualPaymentStatus(): void {
    this.registrationService.getManualPayment().subscribe({
      next: (payment) => {
        if (payment?.status === 'APPROVED') {
          this.userService.fetchProfile().subscribe(() => {
            this.router.navigate(['/dashboard']);
          });
          return;
        }
        this.pendingManualPayment.set(payment?.status === 'PENDING' ? payment : null);
        this.cdr.markForCheck();
      },
    });
  }

  private loadWallet(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.cdr.markForCheck();

    this.registrationService.getRegistrationWallet().subscribe({
      next: (wallet) => {
        this.registrationWallet.set(wallet);
        this.loading.set(false);
        this.cdr.markForCheck();
      },
      error: () => {
        this.registrationWallet.set(null);
        this.loading.set(false);
        this.cdr.markForCheck();
      }
    });
  }

  onFundOnline(): void {
    if (this.payingOnline()) return;
    this.payingOnline.set(true);
    this.errorMessage.set(null);
    this.cdr.markForCheck();

    const user = this.userService.currentUser();
    const packageName = this.selectedPackage();
    const currency = user?.currency ?? 'NGN';
    const provider = this.selectedProvider();
    const callbackUrl = getPaymentCallbackUrl();

    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(REGISTRATION_PROVIDER_KEY, provider);
    }

    this.paymentService.initiateRegistrationPayment(packageName, currency, callbackUrl, provider).subscribe({
      next: (res) => {
        this.payingOnline.set(false);
        this.cdr.markForCheck();
        const gatewayUrl = res.authorizationUrl ?? res.gatewayUrl;
        if (gatewayUrl) {
          window.location.href = gatewayUrl;
        } else if (isUsdtInitiateResponse(res)) {
          saveUsdtPaymentSession({ ...res, flow: 'registration' });
          this.router.navigate(['/auth/register/payment-pending'], {
            replaceUrl: true,
          });
        }
      },
      error: (err) => {
        this.payingOnline.set(false);
        const msg = err?.error?.message ?? (Array.isArray(err?.error?.message) ? err.error.message?.[0] : null)
          ?? (typeof err?.error === 'string' ? err.error : null);
        const msgStr = typeof msg === 'string' ? msg : 'Could not initiate payment. Please try again.';
        if (msgStr.toLowerCase().includes('already activated')) {
          this.router.navigate(['/dashboard']);
          return;
        }
        this.errorMessage.set(msgStr);
        this.cdr.markForCheck();
      }
    });
  }

  onActivate(): void {
    if (!this.canActivate() || this.activating()) return;
    this.activating.set(true);
    this.errorMessage.set(null);
    this.cdr.markForCheck();

    this.registrationService.activate().subscribe({
      next: () => {
        this.activating.set(false);
        this.userService.fetchProfile().subscribe({
          next: () => this.router.navigate(['/dashboard']),
          error: () => this.router.navigate(['/dashboard']),
          complete: () => this.cdr.markForCheck()
        });
      },
      error: (err) => {
        this.activating.set(false);
        const msg = err?.error?.message ?? (Array.isArray(err?.error?.message) ? err.error.message?.[0] : null)
          ?? (typeof err?.error === 'string' ? err.error : null);
        const msgStr = typeof msg === 'string' ? msg : 'Activation failed. Please try again.';
        if (msgStr.toLowerCase().includes('already activated')) {
          this.userService.fetchProfile().subscribe(() => {
            this.router.navigate(['/dashboard']);
          });
          return;
        }
        this.errorMessage.set(msgStr);
        this.cdr.markForCheck();
      }
    });
  }

  onProviderChange(provider: PaymentGatewayProvider): void {
    this.selectedProvider.set(provider);
    this.cdr.markForCheck();
  }

  formatAmount(amount: number, currency: 'NGN' | 'USD'): string {
    const sym = currency === 'NGN' ? '₦' : '$';
    return `${sym}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  onPackageChange(packageCode: string): void {
    this.selectedPackage.set((packageCode ?? 'NICKEL').toUpperCase());
    this.cdr.markForCheck();
  }

  private getPackagePriceLabel(packageCode: string, currency: string): string {
    const registrationFeeNgn = REGISTRATION_FEE_NGN[packageCode] ?? REGISTRATION_FEE_NGN['NICKEL'];
    const adminFeeNgn = ADMIN_FEE_NGN[packageCode] ?? ADMIN_FEE_NGN['NICKEL'];
    const totalNgn = registrationFeeNgn + adminFeeNgn;

    if (currency === 'USD') {
      const registrationFeeUsd = Math.round(registrationFeeNgn / NGN_TO_USD_RATE);
      const adminFeeUsd = Math.round(adminFeeNgn / NGN_TO_USD_RATE);
      const totalUsd = registrationFeeUsd + adminFeeUsd;
      return `$${registrationFeeUsd.toLocaleString()} reg + $${adminFeeUsd.toLocaleString()} admin = $${totalUsd.toLocaleString()}`;
    }

    return `₦${registrationFeeNgn.toLocaleString()} reg + ₦${adminFeeNgn.toLocaleString()} admin = ₦${totalNgn.toLocaleString()}`;
  }
}
