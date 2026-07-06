import { Component, ChangeDetectionStrategy, inject, input, output, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { Subscription } from 'rxjs';
import { CopyButtonComponent } from '../copy-button/copy-button.component';
import { PaymentService, type InitiatePaymentResponse, type PaymentCurrency } from '../../services/payment.service';
import { isUsdtSimulationMode } from '../../services/payment-initiate.mapper';
import { pollUsdtPaymentVerification } from '../../core/utils/usdt-payment.util';

@Component({
  selector: 'app-usdt-deposit',
  standalone: true,
  imports: [CommonModule, ButtonModule, MessageModule, CopyButtonComponent],
  templateUrl: './usdt-deposit.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsdtDepositComponent implements OnDestroy {
  private paymentService = inject(PaymentService);
  private pollSub?: Subscription;

  payment = input.required<InitiatePaymentResponse>();
  title = input('Complete your USDT payment');

  verified = output<InitiatePaymentResponse>();
  back = output<void>();

  isPolling = signal(false);
  pollError = signal('');
  pollStatus = signal('');

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
  }

  gatewayData() {
    return this.payment().gatewayData;
  }

  isSimulation() {
    return isUsdtSimulationMode(this.gatewayData());
  }

  formatDisplayAmount(amount: number | undefined, currency: PaymentCurrency | undefined): string {
    const sym = currency === 'NGN' ? '₦' : '$';
    const value = amount ?? 0;
    return `${sym}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  formatUsdtAmount(amount: number): string {
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 });
  }

  usdtAmountCopy(): string {
    const amount = this.gatewayData()?.usdtAmount;
    return amount != null ? String(amount) : '';
  }

  onBack(): void {
    if (this.isPolling()) return;
    this.back.emit();
  }

  onSent(): void {
    const payment = this.payment();
    const reference = payment.reference;
    if (!reference || this.isPolling()) return;

    this.pollError.set('');
    this.pollStatus.set('Waiting for on-chain confirmation…');
    this.isPolling.set(true);

    const gatewayResponse = this.isSimulation() ? { simulateDeposit: true } : undefined;

    this.pollSub?.unsubscribe();
    this.pollSub = pollUsdtPaymentVerification(this.paymentService, reference, {
      gatewayResponse,
    }).subscribe({
      next: () => {
        this.isPolling.set(false);
        this.pollStatus.set('');
        this.verified.emit(payment);
      },
      error: (err: unknown) => {
        this.isPolling.set(false);
        this.pollStatus.set('');
        const message =
          err instanceof Error
            ? err.message
            : 'Could not verify your payment. Please try again or contact support.';
        this.pollError.set(message);
      },
    });
  }
}
