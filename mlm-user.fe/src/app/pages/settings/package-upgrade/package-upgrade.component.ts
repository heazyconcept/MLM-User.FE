import {
  Component,
  inject,
  signal,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { UserService } from '../../../services/user.service';
import {
  PaymentService,
  type InitiatePaymentResponse,
  type UpgradeOptionsResult,
  type UpgradePaymentSource,
} from '../../../services/payment.service';
import { LoadingService } from '../../../services/loading.service';
import { ModalService } from '../../../services/modal.service';
import {
  getDefaultGatewayProvider,
  getEnabledGatewayProviderOptions,
  getPaymentCallbackUrl,
} from '../../../core/utils/payment-config.util';
import { isUsdtInitiateResponse } from '../../../services/payment-initiate.mapper';
import { UsdtDepositComponent } from '../../../components/usdt-deposit/usdt-deposit.component';
import {
  canPayUpgradeFromRegistrationWallet,
  formatUpgradeMoney,
  formatUpgradePaymentError,
  mergeUpgradeBenefits,
  upgradeActionLabel,
} from '../../../core/utils/package-upgrade.util';

interface PackageCard {
  name: string;
  price: number;
  ipvCredit: number | null;
  currency: string;
  isCurrent: boolean;
  isDowngrade: boolean;
  canUpgrade: boolean;
  benefits: string[];
  color: string;
  icon: string;
}

interface PackageStaticInfo {
  color: string;
  icon: string;
  benefits: string[];
}

const PACKAGE_ORDER = ['NICKEL', 'SILVER', 'GOLD', 'PLATINUM', 'RUBY', 'DIAMOND'];

const STATIC_DETAILS: Record<string, PackageStaticInfo> = {
  NICKEL: {
    color: 'from-gray-400 to-gray-500',
    icon: 'pi-circle',
    benefits: ['10% Direct Referral', '0.05% PDPA', '5% CDPA'],
  },
  SILVER: {
    color: 'from-slate-400 to-slate-500',
    icon: 'pi-star',
    benefits: ['10% Direct Referral', '0.08% PDPA', '10% CDPA'],
  },
  GOLD: {
    color: 'from-amber-400 to-amber-600',
    icon: 'pi-star-fill',
    benefits: ['12% Direct Referral', '0.1% PDPA', '15% CDPA'],
  },
  PLATINUM: {
    color: 'from-sky-400 to-sky-600',
    icon: 'pi-star-fill',
    benefits: ['15% Direct Referral', '0.15% PDPA', '20% CDPA'],
  },
  RUBY: {
    color: 'from-rose-400 to-rose-600',
    icon: 'pi-gem',
    benefits: ['18% Direct Referral', '0.18% PDPA', '25% CDPA'],
  },
  DIAMOND: {
    color: 'from-violet-400 to-violet-600',
    icon: 'pi-gem',
    benefits: ['20% Direct Referral', '0.2% PDPA', '30% CDPA'],
  },
};

@Component({
  selector: 'app-package-upgrade',
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DialogModule,
    SelectModule,
    UsdtDepositComponent,
  ],
  templateUrl: './package-upgrade.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PackageUpgradeComponent implements OnInit {
  private userService = inject(UserService);
  private paymentService = inject(PaymentService);
  private loadingService = inject(LoadingService);
  private modalService = inject(ModalService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  currentUser = this.userService.currentUser;
  displayCurrency = this.userService.displayCurrency;
  isLoading = this.loadingService.isLoading;

  packages = signal<PackageCard[]>([]);
  isLoadingOptions = signal(true);
  loadError = signal<string | null>(null);
  pricesAreLive = signal(false);
  registrationWalletBalance = signal<number | null>(null);
  optionsCurrency = signal('');

  showConfirmDialog = signal(false);
  selectedPackage = signal<PackageCard | null>(null);
  selectedSource = signal<UpgradePaymentSource>(getDefaultGatewayProvider('NGN'));
  actionError = signal<string | null>(null);
  usdtPayment = signal<InitiatePaymentResponse | null>(null);

  paymentMethodOptions = computed(() => {
    const pkg = this.selectedPackage();
    const currency = this.payCurrency(pkg);
    const options: { label: string; value: UpgradePaymentSource }[] = [];
    if (pkg && canPayUpgradeFromRegistrationWallet(this.registrationWalletBalance(), pkg.price)) {
      options.push({
        label: `Registration Wallet (${this.formatPrice(this.registrationWalletBalance() ?? 0, currency)})`,
        value: 'REGISTRATION_WALLET',
      });
    }
    return [...options, ...getEnabledGatewayProviderOptions(currency)];
  });

  walletShortfall = computed(() => {
    const balance = this.registrationWalletBalance();
    const pkg = this.selectedPackage();
    if (balance == null || !pkg || pkg.price <= 0) return null;
    if (canPayUpgradeFromRegistrationWallet(balance, pkg.price)) return null;
    const currency = this.payCurrency(pkg);
    return `Registration wallet balance is ${this.formatPrice(balance, currency)}. This upgrade needs ${this.formatPrice(pkg.price, currency)}.`;
  });

  /** NGN upgrades can always use manual bank transfer when gateways are off. */
  showManualFunding = computed(() => this.payCurrency(this.selectedPackage()) === 'NGN');

  ngOnInit(): void {
    this.selectedSource.set(getDefaultGatewayProvider(this.accountCurrency()));
    this.loadUpgradeOptions();
  }

  retryLoad(): void {
    this.loadUpgradeOptions();
  }

  private loadUpgradeOptions(): void {
    this.isLoadingOptions.set(true);
    this.loadError.set(null);

    this.paymentService.fetchUpgradeOptions().subscribe({
      next: (result) => {
        this.applyUpgradeOptions(result);
        this.isLoadingOptions.set(false);
        this.cdr.markForCheck();
      },
      error: () => {
        const currentPkg = this.currentUser()?.package?.toUpperCase() ?? '';
        this.packages.set(this.buildPackageCards(null, currentPkg));
        this.pricesAreLive.set(false);
        this.registrationWalletBalance.set(null);
        this.isLoadingOptions.set(false);
        this.loadError.set('Could not load upgrade prices. Try again before paying.');
        this.cdr.markForCheck();
      },
    });
  }

  private applyUpgradeOptions(result: UpgradeOptionsResult): void {
    const currentPkg = (result.currentPackage || this.currentUser()?.package || '').toUpperCase();
    this.optionsCurrency.set(result.currency);
    this.registrationWalletBalance.set(result.registrationWalletBalance);
    this.packages.set(this.buildPackageCards(result, currentPkg));
    this.pricesAreLive.set(true);
    this.loadError.set(null);
  }

  private buildPackageCards(
    result: UpgradeOptionsResult | null,
    currentPkg: string,
  ): PackageCard[] {
    const currentIdx = PACKAGE_ORDER.indexOf(currentPkg);
    const currency = this.resolveCurrency(result?.currency);

    return PACKAGE_ORDER.map((name, idx) => {
      const details = STATIC_DETAILS[name] ?? STATIC_DETAILS['SILVER'];
      const isCurrent = name === currentPkg;
      const isDowngrade = idx <= currentIdx && !isCurrent;
      const liveOpt = result?.options.find((opt) => opt.package.toUpperCase() === name);
      const canUpgrade =
        Boolean(liveOpt) && !isCurrent && !isDowngrade && (liveOpt?.price ?? 0) > 0;

      return {
        name,
        price: canUpgrade ? (liveOpt?.price ?? 0) : 0,
        ipvCredit: canUpgrade ? (liveOpt?.ipvCredit ?? null) : null,
        currency: liveOpt?.currency || currency,
        isCurrent,
        isDowngrade,
        canUpgrade,
        benefits: mergeUpgradeBenefits(details.benefits, liveOpt),
        color: details.color,
        icon: details.icon,
      };
    });
  }

  selectPackage(pkg: PackageCard): void {
    if (!pkg.canUpgrade || !this.pricesAreLive()) return;
    this.actionError.set(null);
    this.usdtPayment.set(null);
    this.selectedPackage.set(pkg);
    this.selectedSource.set(this.defaultSource(pkg));
    this.showConfirmDialog.set(true);
  }

  confirmUpgrade(): void {
    const pkg = this.selectedPackage();
    if (!pkg || !this.pricesAreLive()) return;

    const source = this.selectedSource();
    this.actionError.set(null);
    this.loadingService.show();

    this.paymentService
      .initiateUpgradePayment(
        pkg.name,
        source === 'REGISTRATION_WALLET' ? undefined : getPaymentCallbackUrl(),
        source,
      )
      .subscribe({
        next: (res) => this.handleUpgradeStarted(res, source),
        error: (error: unknown) => {
          this.loadingService.hide();
          this.actionError.set(formatUpgradePaymentError(error));
          this.cdr.markForCheck();
        },
      });
  }

  cancelUpgrade(): void {
    this.showConfirmDialog.set(false);
    this.selectedPackage.set(null);
    this.actionError.set(null);
    this.selectedSource.set(getDefaultGatewayProvider(this.accountCurrency()));
    this.usdtPayment.set(null);
  }

  goToManualFunding(): void {
    const pkg = this.selectedPackage();
    if (!pkg || !pkg.canUpgrade) return;

    this.showConfirmDialog.set(false);
    this.selectedPackage.set(null);
    this.unlockBodyScroll();

    const queryParams: Record<string, string | number> = {
      walletType: 'REGISTRATION',
      purpose: 'PACKAGE_UPGRADE',
      targetPackage: pkg.name,
      amount: pkg.price,
    };
    void this.router.navigate(['/payments/manual-deposit'], { queryParams });
  }

  /** PrimeNG dialog can leave body scroll locked after navigate-away. */
  private unlockBodyScroll(): void {
    if (typeof document === 'undefined') return;
    document.body.classList.remove('p-overflow-hidden');
    document.documentElement.classList.remove('p-overflow-hidden');
    document.body.style.removeProperty('overflow');
    document.documentElement.style.removeProperty('overflow');
  }

  onUsdtVerified(): void {
    this.usdtPayment.set(null);
    this.showConfirmDialog.set(false);
    this.selectedPackage.set(null);
    this.refreshAfterUpgrade(
      'Upgrade Complete',
      'Your package has been upgraded successfully.',
      'Your payment was verified. Your package will update shortly.',
    );
  }

  onUsdtBack(): void {
    this.usdtPayment.set(null);
    this.cdr.markForCheck();
  }

  onPaymentSourceChange(source: UpgradePaymentSource): void {
    this.selectedSource.set(source);
    this.cdr.markForCheck();
  }

  upgradeLabel(pkg: PackageCard): string {
    return upgradeActionLabel(
      this.getPackageLabel(pkg.name),
      this.formatPrice(pkg.price, pkg.currency),
    );
  }

  formatPrice(price: number, currency: string): string {
    return formatUpgradeMoney(price, currency);
  }

  getPackageLabel(name: string): string {
    return name.charAt(0) + name.slice(1).toLowerCase();
  }

  walletBalanceLabel(): string | null {
    const balance = this.registrationWalletBalance();
    if (balance == null) return null;
    const currency = this.resolveCurrency(this.optionsCurrency());
    return `Registration wallet ${this.formatPrice(balance, currency)}`;
  }

  paymentHint(): string {
    const source = this.selectedSource();
    switch (source) {
      case 'REGISTRATION_WALLET':
        return 'Your registration wallet is charged this difference and your package updates immediately.';
      case 'USDT':
        return 'Send USDT on the deposit screen after you proceed.';
      case 'PAYSTACK':
      case 'FLUTTERWAVE':
      case 'KORAPAY':
        return "You'll be redirected to our payment partner to complete the upgrade.";
      default: {
        const unreachable: never = source;
        return unreachable;
      }
    }
  }

  proceedLabel(): string {
    return this.selectedSource() === 'REGISTRATION_WALLET'
      ? 'Pay from Registration Wallet'
      : 'Proceed to Payment';
  }

  private handleUpgradeStarted(res: InitiatePaymentResponse, source: UpgradePaymentSource): void {
    this.loadingService.hide();
    const gatewayUrl = res.authorizationUrl ?? res.gatewayUrl;
    if (gatewayUrl) {
      this.showConfirmDialog.set(false);
      window.location.href = gatewayUrl;
      return;
    }
    if (isUsdtInitiateResponse(res)) {
      this.usdtPayment.set(res);
      this.cdr.markForCheck();
      return;
    }
    if (source === 'REGISTRATION_WALLET') {
      this.showConfirmDialog.set(false);
      this.selectedPackage.set(null);
      this.refreshAfterUpgrade(
        'Upgrade Complete',
        'Your package has been upgraded successfully.',
        'Your registration wallet was charged. Your package will update shortly.',
      );
      return;
    }
    this.actionError.set('No payment link was returned. Please try again or contact support.');
    this.cdr.markForCheck();
  }

  private refreshAfterUpgrade(title: string, successDetail: string, pendingDetail: string): void {
    this.userService.fetchProfile().subscribe({
      next: () => {
        this.loadUpgradeOptions();
        this.modalService.open('success', title, successDetail);
        this.cdr.markForCheck();
      },
      error: () => {
        this.modalService.open('success', title, pendingDetail);
        this.cdr.markForCheck();
      },
    });
  }

  private defaultSource(pkg: PackageCard): UpgradePaymentSource {
    if (canPayUpgradeFromRegistrationWallet(this.registrationWalletBalance(), pkg.price)) {
      return 'REGISTRATION_WALLET';
    }
    return getDefaultGatewayProvider(this.payCurrency(pkg));
  }

  private payCurrency(pkg?: PackageCard | null): 'NGN' | 'USD' {
    return this.resolveCurrency(pkg?.currency || this.optionsCurrency());
  }

  private resolveCurrency(currency?: string): 'NGN' | 'USD' {
    if (currency === 'USD') return 'USD';
    if (currency === 'NGN') return 'NGN';
    return this.accountCurrency();
  }

  private accountCurrency(): 'NGN' | 'USD' {
    return this.displayCurrency() === 'USD' ? 'USD' : 'NGN';
  }
}
