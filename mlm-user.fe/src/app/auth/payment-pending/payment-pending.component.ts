import { Component, inject, ChangeDetectionStrategy, signal, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { PaymentService } from '../../services/payment.service';
import { UserService } from '../../services/user.service';

const REFERENCE_STORAGE_KEY = 'mlm_registration_payment_reference';

@Component({
  selector: 'app-payment-pending',
  standalone: true,
  imports: [CommonModule, RouterModule, ButtonModule],
  templateUrl: './payment-pending.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PaymentPendingComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);
  private paymentService = inject(PaymentService);
  private userService = inject(UserService);

  reference = signal<string>('');
  isVerifying = signal(false);
  isRestarting = signal(false);

  ngOnInit(): void {
    const ref =
      this.route.snapshot.queryParamMap.get('reference') ??
      (history.state as { reference?: string })?.reference ??
      (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(REFERENCE_STORAGE_KEY) : null) ??
      '';
    this.reference.set(ref);
    if (ref && typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(REFERENCE_STORAGE_KEY, ref);
    }
    this.cdr.markForCheck();
  }

  onVerify(): void {
    const ref = this.reference();
    if (!ref) return;
    this.isVerifying.set(true);
    this.cdr.markForCheck();
    this.router.navigate(['/auth/payment/callback'], {
      queryParams: { reference: ref }
    });
  }

  onRestartPayment(): void {
    this.isRestarting.set(true);
    this.cdr.markForCheck();
    const user = this.userService.currentUser();
    const packageName = user?.package ?? 'SILVER';
    const currency = user?.currency ?? 'NGN';
    const callbackUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/auth/payment/callback`
      : undefined;

    this.paymentService.initiateRegistrationPayment(packageName, currency, callbackUrl).subscribe({
      next: (res) => {
        this.isRestarting.set(false);
        this.cdr.markForCheck();
        const gatewayUrl = res.authorizationUrl ?? res.gatewayUrl;
        if (gatewayUrl) {
          window.location.href = gatewayUrl;
        } else if (res.reference) {
          this.reference.set(res.reference);
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem(REFERENCE_STORAGE_KEY, res.reference);
          }
          this.router.navigate(['/auth/register/payment-pending'], {
            queryParams: { reference: res.reference },
            replaceUrl: true
          });
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
