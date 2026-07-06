import { Component, inject, ChangeDetectionStrategy, signal, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { PaymentService, type PaymentGatewayProvider } from '../../services/payment.service';
import { UserService } from '../../services/user.service';
import { getDefaultGatewayProvider, getPaymentCallbackUrl } from '../../core/utils/payment-config.util';
import { saveUsdtPaymentSession, loadUsdtPaymentSession, clearUsdtPaymentSession } from '../../core/utils/usdt-payment-storage.util';
import { isUsdtInitiateResponse } from '../../services/payment-initiate.mapper';
import { UsdtDepositComponent } from '../../components/usdt-deposit/usdt-deposit.component';
import type { InitiatePaymentResponse } from '../../services/payment.service';

const REGISTRATION_PROVIDER_KEY = 'mlm_registration_payment_provider';

@Component({
  selector: 'app-payment-pending',
  standalone: true,
  imports: [CommonModule, RouterModule, ButtonModule, UsdtDepositComponent],
  templateUrl: './payment-pending.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PaymentPendingComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);
  private paymentService = inject(PaymentService);
  private userService = inject(UserService);

  usdtPayment = signal<InitiatePaymentResponse | null>(null);
  isRestarting = signal(false);
  missingSession = signal(false);

  ngOnInit(): void {
    const session = loadUsdtPaymentSession();
    if (session?.gatewayData) {
      this.usdtPayment.set(session);
      this.missingSession.set(false);
    } else {
      const ref =
        this.route.snapshot.queryParamMap.get('reference') ??
        (history.state as { reference?: string })?.reference ??
        '';
      if (ref) {
        this.missingSession.set(true);
      }
    }
    this.cdr.markForCheck();
  }

  onUsdtVerified(): void {
    clearUsdtPaymentSession();
    this.userService.fetchProfile().subscribe({
      next: () => void this.router.navigate(['/auth/activation']),
      error: () => void this.router.navigate(['/auth/activation']),
    });
  }

  onRestartPayment(): void {
    this.isRestarting.set(true);
    this.cdr.markForCheck();
    const user = this.userService.currentUser();
    const packageName = user?.package ?? 'SILVER';
    const currency = user?.currency ?? 'NGN';
    const callbackUrl = getPaymentCallbackUrl();

    const provider =
      (typeof sessionStorage !== 'undefined'
        ? (sessionStorage.getItem(REGISTRATION_PROVIDER_KEY) as PaymentGatewayProvider | null)
        : null) ?? getDefaultGatewayProvider(currency === 'NGN' ? 'NGN' : 'USD');

    this.paymentService.initiateRegistrationPayment(packageName, currency, callbackUrl, provider).subscribe({
      next: (res) => {
        this.isRestarting.set(false);
        this.cdr.markForCheck();
        const gatewayUrl = res.authorizationUrl ?? res.gatewayUrl;
        if (gatewayUrl) {
          window.location.href = gatewayUrl;
        } else if (isUsdtInitiateResponse(res)) {
          saveUsdtPaymentSession({ ...res, flow: 'registration' });
          this.usdtPayment.set(res);
          this.missingSession.set(false);
          this.router.navigate(['/auth/register/payment-pending'], { replaceUrl: true });
          this.cdr.markForCheck();
        }
      },
      error: () => {
        this.isRestarting.set(false);
        this.cdr.markForCheck();
      }
    });
  }
}
