import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  MerchantService,
  type MerchantType,
  type MerchantFeePaymentSource,
} from '../../../services/merchant.service';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-merchant-apply',
  imports: [CommonModule, RouterLink, FormsModule, ButtonModule],
  templateUrl: './merchant-apply.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MerchantApplyComponent implements OnInit {
  private merchantService = inject(MerchantService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  categoryConfig = this.merchantService.categoryConfig;
  profile = this.merchantService.profile;
  isMerchant = this.merchantService.isMerchant;
  loading = this.merchantService.loading;
  actionLoading = this.merchantService.actionLoading;
  error = this.merchantService.error;

  selectedType = signal<MerchantType>('REGIONAL');
  serviceAreasInput = signal('');
  submitted = signal(false);

  // Payment related
  selectedPaymentSource = signal<MerchantFeePaymentSource>('REGISTRATION_WALLET');
  paymentInitiated = signal(false);
  verificationMessage = signal('');
  verificationError = signal('');

  readonly merchantTypes: MerchantType[] = ['REGIONAL', 'NATIONAL', 'GLOBAL'];
  readonly paymentSources: { label: string; value: MerchantFeePaymentSource }[] = [
    { label: 'Registration Wallet', value: 'REGISTRATION_WALLET' },
    { label: 'Cash Wallet', value: 'CASH_WALLET' },
    { label: 'Paystack (Gateway)', value: 'PAYSTACK' },
  ];

  ngOnInit(): void {
    this.merchantService.fetchCategoryConfig();
    this.merchantService.fetchProfile();
    this.handleGatewayVerification();
  }

  private handleGatewayVerification(): void {
    const reference = this.route.snapshot.queryParamMap.get('reference');
    const trxref = this.route.snapshot.queryParamMap.get('trxref');
    const paymentReference = reference || trxref;

    if (!paymentReference) return;

    this.verificationMessage.set('Verifying your payment...');
    this.verificationError.set('');

    this.merchantService.verifyMerchantFeePayment({ reference: paymentReference }).subscribe((res) => {
      if (res?.success) {
        this.verificationMessage.set(
          res.message || 'Merchant fee verified. Your application is pending admin approval.',
        );
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { reference: null, trxref: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
        return;
      }

      this.verificationMessage.set('');
      this.verificationError.set(this.error() || 'Payment could not be verified.');
    });
  }

  getTypeLabel(type: MerchantType): string {
    const labels: Record<MerchantType, string> = {
      REGIONAL: 'Regional',
      NATIONAL: 'National',
      GLOBAL: 'Global',
    };
    return labels[type] ?? type;
  }

  getConfigForType(type: MerchantType) {
    return this.categoryConfig().find((c) => c.merchantType === type);
  }

  selectedConfig() {
    return this.getConfigForType(this.selectedType());
  }

  onSubmit(): void {
    const areas = this.serviceAreasInput()
      .split(',')
      .map((a) => a.trim())
      .filter((a) => a.length > 0);

    if (areas.length === 0) return;

    this.merchantService.apply(this.selectedType(), areas);
    this.submitted.set(true);
  }

  onPayFee(): void {
    const p = this.profile();
    if (!p || !p.id) return;

    const source = this.selectedPaymentSource();
    const payload: any = {
      source,
      merchantId: p.id,
    };

    if (source === 'PAYSTACK') {
      payload.callbackUrl = window.location.origin + '/merchant/apply';
    }

    this.merchantService.initiateMerchantFeePayment(payload).subscribe((res) => {
      if (res) {
        this.paymentInitiated.set(true);
        if (res.gatewayUrl) {
          window.location.href = res.gatewayUrl;
        }
      }
    });
  }
}
