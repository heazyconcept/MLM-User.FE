import {
  Component,
  inject,
  signal,
  computed,
  effect,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { switchMap, EMPTY, Observable } from 'rxjs';
import {
  MerchantService,
  type MerchantType,
  type MerchantFeePaymentSource,
  type MerchantProfile,
  type MerchantCategoryConfig,
  type InitiateMerchantFeeResponse,
  type UpdateMerchantProfileBody,
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
  needsPayment = this.merchantService.needsPayment;

  selectedType = signal<MerchantType>('REGIONAL');
  phoneNumberInput = signal('');
  addressInput = signal('');

  selectedStates = signal<string[]>([]);
  statesDropdownOpen = signal(false);
  statesSearchQuery = signal('');
  allStates = NIGERIAN_STATES;

  private prefillApplied = false;

  filteredStates = computed(() => {
    const query = this.statesSearchQuery().toLowerCase().trim();
    if (!query) return this.allStates;
    return this.allStates.filter((state) => state.toLowerCase().includes(query));
  });

  constructor() {
    effect(() => {
      if (this.loading() || this.prefillApplied) return;
      if (!this.needsPayment()) return;

      const p = this.profile();
      if (!p?.id) return;

      this.selectedType.set(p.type ?? 'REGIONAL');
      if (p.phoneNumber) {
        this.phoneNumberInput.set(p.phoneNumber);
      }
      if (p.address) {
        this.addressInput.set(p.address);
      }
      if (p.serviceAreas?.length) {
        this.selectedStates.set([...p.serviceAreas]);
      }
      this.prefillApplied = true;
    });
  }

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

  selectedPaymentSource = signal<MerchantFeePaymentSource>('REGISTRATION_WALLET');

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

  getRegistrationFee(cfg: MerchantCategoryConfig): { amount: number; symbol: string } {
    const currency = this.userCurrency();
    if (currency === 'NGN' && cfg.registrationFeeNGN != null) {
      return { amount: cfg.registrationFeeNGN, symbol: '₦' };
    }
    return { amount: cfg.registrationFeeUsd, symbol: '$' };
  }

  onApplyAndPay(): void {
    const areas = this.selectedStates();
    if (areas.length === 0) return;

    const pNumber = this.phoneNumberInput().trim();
    const addr = this.addressInput().trim();
    if (!pNumber || !addr) return;

    if (this.needsPayment()) {
      const existing = this.profile();
      if (!existing?.id) return;

      const updateBody: UpdateMerchantProfileBody = {
        type: this.selectedType(),
        phoneNumber: pNumber,
        address: addr,
        serviceAreas: areas,
      };

      this.merchantService
        .updateProfile(updateBody)
        .pipe(
          switchMap((updated) => {
            const merchantId = updated?.id ?? existing.id;
            if (!merchantId) return EMPTY;
            return this.initiatePayment(merchantId);
          }),
        )
        .subscribe({
          next: (res) => this.handlePaymentResult(res),
          error: () => this.handlePaymentFailure(),
        });
      return;
    }

    if (this.isMerchant()) return;

    this.merchantService
      .apply(this.selectedType(), areas, pNumber, addr)
      .pipe(
        switchMap((profile: MerchantProfile | null) => {
          if (!profile?.id) {
            return EMPTY;
          }
          return this.initiatePayment(profile.id);
        }),
      )
      .subscribe({
        next: (res) => this.handlePaymentResult(res),
        error: () => this.handlePaymentFailure(),
      });
  }

  private initiatePayment(merchantId: string): Observable<InitiateMerchantFeeResponse | null> {
    const source = this.selectedPaymentSource();
    const payload: { source: MerchantFeePaymentSource; merchantId: string; callbackUrl?: string } = {
      source,
      merchantId,
    };
    if (source === 'PAYSTACK') {
      payload.callbackUrl = window.location.origin + '/merchant/apply';
    }
    return this.merchantService.initiateMerchantFeePayment(payload);
  }

  private handlePaymentResult(res: InitiateMerchantFeeResponse | null): void {
    if (!res) {
      this.handlePaymentFailure();
      return;
    }
    if (res.gatewayUrl) {
      window.location.href = res.gatewayUrl;
    } else {
      this.handleWalletPaymentSuccess();
    }
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
