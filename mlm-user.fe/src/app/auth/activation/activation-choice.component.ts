import {
  Component,
  inject,
  ChangeDetectionStrategy,
  signal,
  ChangeDetectorRef,
  OnInit,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { PaymentService } from '../../services/payment.service';
import { UserService } from '../../services/user.service';
import { RegistrationService, type RegistrationWallet } from '../../services/registration.service';
import { getRequiredAmount, REGISTRATION_FEE_NGN, IPV_PERCENT, NGN_TO_USD_RATE } from '../../core/constants/registration.constants';

@Component({
  selector: 'app-activation-choice',
  standalone: true,
  imports: [CommonModule, RouterModule, ButtonModule, MessageModule],
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

  userCurrency = computed(() => this.userService.currentUser()?.currency ?? 'NGN');
  userPackage = computed(() => this.userService.currentUser()?.package ?? 'NICKEL');
  requiredAmount = computed(() => getRequiredAmount(this.userPackage(), this.userCurrency()));

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

  ngOnInit(): void {
    if (this.userService.isPaid()) {
      this.router.navigate(['/dashboard']);
      return;
    }
    this.loadWallet();
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

  onFundViaPaystack(): void {
    if (this.payingOnline()) return;
    this.payingOnline.set(true);
    this.errorMessage.set(null);
    this.cdr.markForCheck();

    const user = this.userService.currentUser();
    const packageName = user?.package ?? 'SILVER';
    const currency = user?.currency ?? 'NGN';
    const callbackUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/auth/payment/callback`
      : undefined;

    this.paymentService.initiateRegistrationPayment(packageName, currency, callbackUrl).subscribe({
      next: (res) => {
        this.payingOnline.set(false);
        this.cdr.markForCheck();
        const gatewayUrl = res.authorizationUrl ?? res.gatewayUrl;
        if (gatewayUrl) {
          window.location.href = gatewayUrl;
        } else if (res.reference) {
          this.router.navigate(['/auth/register/payment-pending'], {
            queryParams: { reference: res.reference },
            state: { reference: res.reference }
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

  formatAmount(amount: number, currency: 'NGN' | 'USD'): string {
    const sym = currency === 'NGN' ? '₦' : '$';
    return `${sym}${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }
}
