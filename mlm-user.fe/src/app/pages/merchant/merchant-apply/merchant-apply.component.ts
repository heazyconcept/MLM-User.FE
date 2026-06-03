import { Component, inject, signal, computed, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { switchMap, of, EMPTY } from 'rxjs';
import {
  MerchantService,
  type MerchantType,
  type MerchantFeePaymentSource,
  type MerchantProfile,
  type MerchantCategoryConfig,
} from '../../../services/merchant.service';
import { UserService } from '../../../services/user.service';
import { RealTimeNotificationService } from '../../../services/realtime-notification.service';
import { ButtonModule } from 'primeng/button';
import { NIGERIAN_STATES } from '../../../core/constants/states.constants';

@Component({
  selector: 'app-merchant-apply',
  imports: [CommonModule, RouterLink, FormsModule, ButtonModule],
  templateUrl: './merchant-apply.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MerchantApplyComponent implements OnInit {
  private merchantService = inject(MerchantService);
  private userService = inject(UserService);
  private realTimeNotifications = inject(RealTimeNotificationService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  userCurrency = computed(() => this.userService.currentUser()?.currency ?? 'NGN');

  categoryConfig = this.merchantService.categoryConfig;
  profile = this.merchantService.profile;
  isMerchant = this.merchantService.isMerchant;
  loading = this.merchantService.loading;
  actionLoading = this.merchantService.actionLoading;
  error = this.merchantService.error;
  isFeePaid = this.merchantService.isFeePaid;

  selectedType = signal<MerchantType>('REGIONAL');
  businessNameInput = signal('');
  phoneNumberInput = signal('');
  addressInput = signal('');
  
  // Custom multi-select state selector signals
  selectedStates = signal<string[]>([]);
  statesDropdownOpen = signal(false);
  statesSearchQuery = signal('');
  allStates = NIGERIAN_STATES;

  filteredStates = computed(() => {
    const query = this.statesSearchQuery().toLowerCase().trim();
    if (!query) return this.allStates;
    return this.allStates.filter((state) => state.toLowerCase().includes(query));
  });

  toggleStateSelection(state: string): void {
    const current = this.selectedStates();
    if (current.includes(state)) {
      this.selectedStates.set(current.filter((s) => s !== state));
    } else {
      this.selectedStates.set([...current, state]);
    }
  }

  isStateSelected(state: string): boolean {
    return this.selectedStates().includes(state);
  }

  removeState(state: string): void {
    this.selectedStates.set(this.selectedStates().filter((s) => s !== state));
  }

  // Payment source is chosen on the same form as the application
  selectedPaymentSource = signal<MerchantFeePaymentSource>('REGISTRATION_WALLET');

  // Gateway verification state
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

  /** Returns the fee amount and symbol based on the user's currency */
  getRegistrationFee(cfg: MerchantCategoryConfig): { amount: number; symbol: string } {
    const currency = this.userCurrency();
    if (currency === 'NGN' && cfg.registrationFeeNGN != null) {
      return { amount: cfg.registrationFeeNGN, symbol: '₦' };
    }
    return { amount: cfg.registrationFeeUsd, symbol: '$' };
  }

  /**
   * Single atomic action: apply THEN immediately initiate payment.
   * Admin only sees a PENDING record once payment is in flight.
   */
  onApplyAndPay(): void {
    // Guard: don't re-apply if profile already exists
    if (this.isMerchant()) return;

    const areas = this.selectedStates();

    if (areas.length === 0) return;

    const bName = this.businessNameInput().trim();
    const pNumber = this.phoneNumberInput().trim();
    const addr = this.addressInput().trim();

    if (!bName || !pNumber || !addr) return;

    const source = this.selectedPaymentSource();

    this.merchantService
      .apply(this.selectedType(), areas, bName, pNumber, addr)
      .pipe(
        switchMap((profile: MerchantProfile | null) => {
          if (!profile?.id) {
            // apply() failed — error already set in service, stop chain
            return EMPTY;
          }

          const payload: any = { source, merchantId: profile.id };
          if (source === 'PAYSTACK') {
            payload.callbackUrl = window.location.origin + '/merchant/apply';
          }

          return this.merchantService.initiateMerchantFeePayment(payload);
        }),
      )
      .subscribe({
        next: (res) => {
          if (!res) {
            this.handlePaymentFailure();
            return;
          }
          if (res.gatewayUrl) {
            window.location.href = res.gatewayUrl;
          } else {
            this.handleWalletPaymentSuccess();
          }
        },
        error: () => {
          this.handlePaymentFailure();
        },
      });
  }

  /**
   * For users who are already PENDING+unpaid (legacy or returned from cancelled Paystack).
   * They already have a merchantId, just initiate payment directly.
   */
  onPayFee(): void {
    const p = this.profile();
    if (!p || !p.id) return;

    const source = this.selectedPaymentSource();
    const payload: any = { source, merchantId: p.id };

    if (source === 'PAYSTACK') {
      payload.callbackUrl = window.location.origin + '/merchant/apply';
    }

    this.merchantService.initiateMerchantFeePayment(payload).subscribe({
      next: (res) => {
        if (!res) {
          this.handlePaymentFailure();
          return;
        }
        if (res.gatewayUrl) {
          window.location.href = res.gatewayUrl;
        } else {
          this.handleWalletPaymentSuccess();
        }
      },
      error: () => {
        this.handlePaymentFailure();
      },
    });
  }

  private handleWalletPaymentSuccess(): void {
    setTimeout(() => this.realTimeNotifications.syncUnreadNotifications(), 2000);
    this.router.navigate(['/merchant/dashboard']);
  }

  private handlePaymentFailure(): void {
    const errMsg = this.merchantService.error();
    if (this.merchantService.isFeeAlreadyPaidError(errMsg)) {
      this.merchantService.clearError();
      this.merchantService.fetchProfile();
      return;
    }
    this.merchantService.fetchProfile();
  }
}
