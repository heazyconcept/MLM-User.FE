import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import {
  MerchantService,
  MerchantFeePaymentSource,
  isMerchantGatewaySource,
  isMerchantUsdtSource,
  MerchantType,
  MerchantUpgradeOption,
  MerchantUpgradeOptionsResponse,
  MerchantCategoryConfig,
} from '../../../services/merchant.service';
import { UserService } from '../../../services/user.service';
import { EarningsService } from '../../../services/earnings.service';
import { NIGERIAN_STATES } from '../../../core/constants/states.constants';
import {
  GATEWAY_REFERENCE_QUERY_PARAMS,
  resolvePaymentReference,
} from '../../../core/utils/payment-reference.util';
import { getMerchantCallbackUrl, isPaymentProviderEnabled } from '../../../core/utils/payment-config.util';
import { UsdtDepositComponent } from '../../../components/usdt-deposit/usdt-deposit.component';
import type { InitiatePaymentResponse } from '../../../services/payment.service';

const TIER_STYLES: Record<MerchantType, { color: string; icon: string }> = {
  REGIONAL: { color: 'from-sky-400 to-sky-600', icon: 'pi-map-marker' },
  NATIONAL: { color: 'from-amber-400 to-amber-600', icon: 'pi-flag' },
  GLOBAL: { color: 'from-violet-400 to-violet-600', icon: 'pi-globe' },
};

@Component({
  selector: 'app-merchant-profile',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    MessageModule,
    UsdtDepositComponent,
  ],
  templateUrl: './merchant-profile.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MerchantProfileComponent implements OnInit {
  private merchantService = inject(MerchantService);
  private userService = inject(UserService);
  private earningsService = inject(EarningsService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  profile = this.merchantService.profile;
  categoryConfig = this.merchantService.categoryConfig;
  loading = this.merchantService.loading;
  actionLoading = this.merchantService.actionLoading;
  error = this.merchantService.error;
  canUpgradeCategory = this.merchantService.canUpgradeCategory;
  displayCurrency = this.userService.displayCurrency;

  businessName = signal('');
  phoneNumber = signal('');
  address = signal('');
  selectedStates = signal<string[]>([]);
  statesDropdownOpen = signal(false);
  statesSearchQuery = signal('');
  allStates = NIGERIAN_STATES;
  successMessage = signal('');

  upgradeOptions = signal<MerchantUpgradeOptionsResponse | null>(null);
  isLoadingUpgradeOptions = signal(false);
  upgradeLoadError = signal<string | null>(null);
  selectedTarget = signal<MerchantUpgradeOption | null>(null);
  selectedPaymentSource = signal<MerchantFeePaymentSource>('REGISTRATION_WALLET');
  showConfirmDialog = signal(false);
  upgradeSuccessMessage = signal('');
  upgradeActionError = signal('');
  verificationMessage = signal('');
  verificationError = signal('');
  usdtPayment = signal<InitiatePaymentResponse | null>(null);
  usdtVerifyError = signal('');

  private readonly walletPaymentSources: { label: string; value: MerchantFeePaymentSource }[] = [
    { label: 'Registration Wallet', value: 'REGISTRATION_WALLET' },
    { label: 'Cash Wallet', value: 'CASH_WALLET' },
  ];

  private readonly gatewayPaymentSources: {
    label: string;
    value: MerchantFeePaymentSource;
    configKey: 'paystack' | 'flutterwave';
  }[] = [
    { label: 'Paystack', value: 'PAYSTACK', configKey: 'paystack' },
    { label: 'Flutterwave', value: 'FLUTTERWAVE', configKey: 'flutterwave' },
  ];

  paymentSources = computed(() => {
    const sources = [...this.walletPaymentSources];
    if (this.displayCurrency() === 'USD') {
      if (isPaymentProviderEnabled('usdt')) {
        sources.push({ label: 'USDT (Crypto)', value: 'USDT' });
      }
      return sources;
    }
    sources.push(
      ...this.gatewayPaymentSources
        .filter((source) => isPaymentProviderEnabled(source.configKey))
        .map(({ label, value }) => ({ label, value })),
    );
    return sources;
  });

  showUpgradeSection = computed(() => {
    if (!this.canUpgradeCategory()) return false;
    const opts = this.upgradeOptions();
    return opts != null && opts.eligibleUpgrades.length > 0;
  });

  filteredStates = computed(() => {
    const query = this.statesSearchQuery().toLowerCase().trim();
    if (!query) return this.allStates;
    return this.allStates.filter((state) => state.toLowerCase().includes(query));
  });

  constructor() {
    effect(() => {
      const p = this.profile();
      if (p && !p.message) {
        this.businessName.set(p.businessName || '');
        this.phoneNumber.set(p.phoneNumber || '');
        this.address.set(p.address || '');
        this.selectedStates.set(p.serviceAreas || []);
      }
    });
  }

  ngOnInit(): void {
    this.handleGatewayVerification();
    this.merchantService.fetchProfile$().subscribe(() => {
      if (this.canUpgradeCategory()) {
        this.loadUpgradeOptions();
        this.merchantService.fetchCategoryConfig();
      }
      this.cdr.markForCheck();
    });
  }

  private loadUpgradeOptions(): void {
    this.isLoadingUpgradeOptions.set(true);
    this.upgradeLoadError.set(null);

    this.merchantService.fetchUpgradeOptions().subscribe({
      next: (options) => {
        if (!options) {
          this.upgradeLoadError.set(
            this.merchantService.error() || 'Could not load upgrade options.',
          );
          this.upgradeOptions.set(null);
        } else {
          this.upgradeOptions.set(options);
          this.upgradeLoadError.set(null);
        }
        this.isLoadingUpgradeOptions.set(false);
        this.cdr.markForCheck();
      },
      error: () => {
        this.upgradeLoadError.set('Could not load upgrade options.');
        this.isLoadingUpgradeOptions.set(false);
        this.cdr.markForCheck();
      },
    });
  }

  private handleGatewayVerification(): void {
    const reference = resolvePaymentReference(this.route.snapshot.queryParamMap);

    if (!reference) return;

    this.verificationMessage.set('Verifying your payment...');
    this.verificationError.set('');

    this.merchantService.verifyMerchantUpgrade({ reference }).subscribe((res) => {
      if (res?.success) {
        this.verificationMessage.set('');
        this.upgradeSuccessMessage.set(
          res.message || 'Merchant category upgraded successfully.',
        );
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: GATEWAY_REFERENCE_QUERY_PARAMS,
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
        this.refreshAfterUpgrade();
        this.loadUpgradeOptions();
        this.scrollToUpgradeSection();
        this.cdr.markForCheck();
        return;
      }

      this.verificationMessage.set('');
      this.verificationError.set(
        this.merchantService.error() || 'Payment could not be verified.',
      );
      this.cdr.markForCheck();
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

  getTierStyle(type: MerchantType) {
    return TIER_STYLES[type] ?? TIER_STYLES.REGIONAL;
  }

  getConfigForType(type: MerchantType): MerchantCategoryConfig | undefined {
    return this.categoryConfig().find((c) => c.merchantType === type);
  }

  formatPrice(amount: number): string {
    const currency = this.displayCurrency();
    const symbol = currency === 'NGN' ? '₦' : '$';
    return `${symbol}${amount.toLocaleString()}`;
  }

  getPaymentSourceLabel(source: MerchantFeePaymentSource): string {
    return this.paymentSources().find((s) => s.value === source)?.label ?? source;
  }

  isGatewayPaymentSource(source: MerchantFeePaymentSource): boolean {
    return isMerchantGatewaySource(source);
  }

  isUsdtPaymentSource(source: MerchantFeePaymentSource): boolean {
    return isMerchantUsdtSource(source);
  }

  selectUpgradeTarget(option: MerchantUpgradeOption): void {
    this.upgradeActionError.set('');
    this.selectedTarget.set(option);
    this.showConfirmDialog.set(true);
  }

  confirmUpgrade(): void {
    const target = this.selectedTarget();
    if (!target) return;

    this.upgradeActionError.set('');
    const source = this.selectedPaymentSource();
    const payload: {
      source: MerchantFeePaymentSource;
      targetType: MerchantType;
      callbackUrl?: string;
    } = {
      source,
      targetType: target.merchantType,
    };

    if (isMerchantGatewaySource(source)) {
      payload.callbackUrl = getMerchantCallbackUrl('/merchant/profile');
    }

    this.merchantService.initiateMerchantUpgrade(payload).subscribe((res) => {
      if (!res) {
        this.upgradeActionError.set(
          this.merchantService.error() || 'Could not initiate upgrade payment.',
        );
        this.cdr.markForCheck();
        return;
      }

      this.showConfirmDialog.set(false);
      this.selectedTarget.set(null);

      if (res.gatewayUrl) {
        window.location.href = res.gatewayUrl;
        return;
      }

      if (res.gatewayData && res.reference) {
        this.usdtPayment.set({
          reference: res.reference,
          amount: res.amount,
          currency: res.currency,
          gatewayData: res.gatewayData,
          paymentId: res.paymentId,
        });
        this.cdr.markForCheck();
        return;
      }

      this.upgradeSuccessMessage.set(
        `Upgraded to ${this.getTypeLabel(target.merchantType)} Merchant successfully.`,
      );
      this.refreshAfterUpgrade();
      this.loadUpgradeOptions();
      this.scrollToUpgradeSection();
      this.cdr.markForCheck();
    });
  }

  cancelUpgrade(): void {
    this.showConfirmDialog.set(false);
    this.selectedTarget.set(null);
    this.upgradeActionError.set('');
    this.usdtPayment.set(null);
    this.usdtVerifyError.set('');
  }

  onUsdtVerified(): void {
    const reference = this.usdtPayment()?.reference;
    if (!reference) return;

    this.usdtVerifyError.set('');
    this.merchantService.verifyMerchantUpgrade({ reference }).subscribe((verifyRes) => {
      if (verifyRes?.success) {
        this.usdtPayment.set(null);
        this.upgradeSuccessMessage.set(
          verifyRes.message || 'Merchant category upgraded successfully.',
        );
        this.refreshAfterUpgrade();
        this.loadUpgradeOptions();
        this.scrollToUpgradeSection();
        this.cdr.markForCheck();
        return;
      }
      this.usdtVerifyError.set(
        this.merchantService.error() || 'Payment could not be verified. Please contact support.',
      );
      this.cdr.markForCheck();
    });
  }

  onUsdtBack(): void {
    this.usdtPayment.set(null);
    this.usdtVerifyError.set('');
    this.cdr.markForCheck();
  }

  private refreshAfterUpgrade(): void {
    this.merchantService.fetchAllocations();
    this.earningsService.fetchCpvSummary().subscribe();
  }

  private scrollToUpgradeSection(): void {
    if (typeof document === 'undefined') return;
    setTimeout(() => {
      document.getElementById('merchant-category-upgrade')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 100);
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

  onSubmit(): void {
    this.successMessage.set('');
    const business = this.businessName().trim();
    const phone = this.phoneNumber().trim();
    const addr = this.address().trim();
    const areas = this.selectedStates();

    if (business.length < 2 || !phone || !addr || areas.length === 0) {
      return;
    }

    this.merchantService
      .updateProfile({
        businessName: business,
        phoneNumber: phone,
        address: addr,
        serviceAreas: areas,
      })
      .subscribe((res) => {
        if (res) {
          this.merchantService.clearError();
          this.successMessage.set('Merchant profile updated successfully.');
          setTimeout(() => this.successMessage.set(''), 4000);
        }
      });
  }

  onReset(): void {
    const p = this.profile();
    if (p) {
      this.businessName.set(p.businessName || '');
      this.phoneNumber.set(p.phoneNumber || '');
      this.address.set(p.address || '');
      this.selectedStates.set(p.serviceAreas || []);
    }
    this.successMessage.set('');
  }
}
