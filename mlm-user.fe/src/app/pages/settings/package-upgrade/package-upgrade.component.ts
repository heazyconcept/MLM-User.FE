import { Component, inject, signal, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { UserService } from '../../../services/user.service';
import { PaymentService, UpgradeOption, type PaymentGatewayProvider, type InitiatePaymentResponse } from '../../../services/payment.service';
import { LoadingService } from '../../../services/loading.service';
import { ModalService } from '../../../services/modal.service';
import { getRequiredAmount } from '../../../core/constants/registration.constants';
import {
  getDefaultGatewayProvider,
  getEnabledGatewayProviderOptions,
  getPaymentCallbackUrl,
} from '../../../core/utils/payment-config.util';
import { isUsdtInitiateResponse } from '../../../services/payment-initiate.mapper';
import { UsdtDepositComponent } from '../../../components/usdt-deposit/usdt-deposit.component';

interface PackageCard {
  name: string;
  price: number;
  currency: string;
  isCurrent: boolean;
  isDowngrade: boolean;
  benefits: string[];
  color: string;
  icon: string;
}

const PACKAGE_ORDER = ['NICKEL', 'SILVER', 'GOLD', 'PLATINUM', 'RUBY', 'DIAMOND'];

interface PackageStaticInfo {
  color: string;
  icon: string;
  priceUsd: number;
  priceNgn: number;
  benefits: string[];
}

const STATIC_DETAILS: Record<string, PackageStaticInfo> = {
  NICKEL:   { color: 'from-gray-400 to-gray-500',     icon: 'pi-circle',    priceUsd: 15,    priceNgn: 15000,     benefits: ['10% Direct Referral', '0.05% PDPA', '5% CDPA'] },
  SILVER:   { color: 'from-slate-400 to-slate-500',   icon: 'pi-star',      priceUsd: 30,    priceNgn: 30000,     benefits: ['10% Direct Referral', '0.08% PDPA', '10% CDPA'] },
  GOLD:     { color: 'from-amber-400 to-amber-600',   icon: 'pi-star-fill', priceUsd: 120,   priceNgn: 120000,    benefits: ['12% Direct Referral', '0.1% PDPA', '15% CDPA'] },
  PLATINUM: { color: 'from-sky-400 to-sky-600',       icon: 'pi-star-fill', priceUsd: 600,   priceNgn: 600000,    benefits: ['15% Direct Referral', '0.15% PDPA', '20% CDPA'] },
  RUBY:     { color: 'from-rose-400 to-rose-600',     icon: 'pi-gem',       priceUsd: 1800,  priceNgn: 1800000,   benefits: ['18% Direct Referral', '0.18% PDPA', '25% CDPA'] },
  DIAMOND:  { color: 'from-violet-400 to-violet-600', icon: 'pi-gem',       priceUsd: 6000,  priceNgn: 6000000,   benefits: ['20% Direct Referral', '0.2% PDPA', '30% CDPA'] }
};

@Component({
  selector: 'app-package-upgrade',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, DialogModule, SelectModule, UsdtDepositComponent],
  templateUrl: './package-upgrade.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
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

  showConfirmDialog = signal(false);
  selectedPackage = signal<PackageCard | null>(null);
  selectedProvider = signal<PaymentGatewayProvider>(
    getDefaultGatewayProvider('NGN'),
  );
  usdtPayment = signal<InitiatePaymentResponse | null>(null);

  providerOptions = computed(() =>
    getEnabledGatewayProviderOptions(this.displayCurrency() === 'NGN' ? 'NGN' : 'USD')
  );
  /** NGN upgrades can always use manual bank transfer when gateways are off. */
  showManualFunding = computed(() => this.displayCurrency() === 'NGN');

  ngOnInit(): void {
    this.selectedProvider.set(
      getDefaultGatewayProvider(this.displayCurrency() === 'NGN' ? 'NGN' : 'USD'),
    );
    this.loadUpgradeOptions();
  }

  private loadUpgradeOptions(): void {
    this.isLoadingOptions.set(true);
    this.loadError.set(null);

    this.paymentService.fetchUpgradeOptions().subscribe({
      next: (options) => {
        const currentPkg = this.currentUser()?.package?.toUpperCase() ?? '';
        const currentIdx = PACKAGE_ORDER.indexOf(currentPkg);
        const cards = this.buildPackageCards(options, currentPkg, currentIdx);
        this.packages.set(cards);
        this.isLoadingOptions.set(false);
        this.cdr.markForCheck();
      },
      error: () => {
        // Fallback: build cards from static data with currency-aware prices
        const currentPkg = this.currentUser()?.package?.toUpperCase() ?? '';
        const currentIdx = PACKAGE_ORDER.indexOf(currentPkg);
        const currency = this.displayCurrency();
        const fallbackCards = PACKAGE_ORDER.map((name, idx) => {
          const details = STATIC_DETAILS[name] ?? STATIC_DETAILS['SILVER'];
          return {
            name,
            price: getRequiredAmount(name, currency),
            currency,
            isCurrent: name === currentPkg,
            isDowngrade: idx <= currentIdx && name !== currentPkg,
            benefits: details.benefits,
            color: details.color,
            icon: details.icon
          };
        });
        this.packages.set(fallbackCards);
        this.isLoadingOptions.set(false);
        this.loadError.set('Could not load live upgrade prices. Showing plan overview.');
        this.cdr.markForCheck();
      }
    });
  }

  private buildPackageCards(options: UpgradeOption[], currentPkg: string, currentIdx: number): PackageCard[] {
    const currency = this.displayCurrency();

    return PACKAGE_ORDER.map((name, idx) => {
      const details = STATIC_DETAILS[name] ?? STATIC_DETAILS['SILVER'];
      const isCurrent = name === currentPkg;
      const isDowngrade = idx <= currentIdx && !isCurrent;

      const liveOpt = options.find((opt) => opt.package.toUpperCase() === name);

      let price = getRequiredAmount(name, currency);
      let benefits = details.benefits;

      if (liveOpt && liveOpt.currency.toUpperCase() === currency) {
        price = liveOpt.price;
        if (liveOpt.benefits && Array.isArray(liveOpt.benefits)) {
          benefits = liveOpt.benefits;
        }
      }

      return {
        name,
        price,
        currency,
        isCurrent,
        isDowngrade,
        benefits,
        color: details.color,
        icon: details.icon,
      };
    });
  }

  selectPackage(pkg: PackageCard): void {
    if (pkg.isCurrent || pkg.isDowngrade) return;
    this.selectedPackage.set(pkg);
    this.showConfirmDialog.set(true);
  }

  confirmUpgrade(): void {
    const pkg = this.selectedPackage();
    if (!pkg) return;

    this.loadingService.show();
    const callbackUrl = getPaymentCallbackUrl();

    this.paymentService.initiateUpgradePayment(pkg.name, callbackUrl, this.selectedProvider()).subscribe({
      next: (res) => {
        this.loadingService.hide();
        this.showConfirmDialog.set(false);
        this.cdr.markForCheck();

        const gatewayUrl = res.authorizationUrl ?? res.gatewayUrl;
        if (gatewayUrl) {
          window.location.href = gatewayUrl;
        } else if (isUsdtInitiateResponse(res)) {
          this.usdtPayment.set(res);
          this.cdr.markForCheck();
        } else {
          this.modalService.open(
            'error',
            'Upgrade Failed',
            'No payment link was returned. Please try again or contact support.'
          );
        }
      },
      error: () => {
        this.loadingService.hide();
        this.showConfirmDialog.set(false);
        this.cdr.markForCheck();
        this.modalService.open(
          'error',
          'Upgrade Failed',
          'Could not initiate the upgrade payment. Please try again or contact support.'
        );
      }
    });
  }

  cancelUpgrade(): void {
    this.showConfirmDialog.set(false);
    this.selectedPackage.set(null);
    this.selectedProvider.set(getDefaultGatewayProvider(this.displayCurrency() === 'NGN' ? 'NGN' : 'USD'));
    this.usdtPayment.set(null);
  }

  goToManualFunding(): void {
    const pkg = this.selectedPackage();
    if (!pkg) return;

    this.showConfirmDialog.set(false);
    this.selectedPackage.set(null);
    this.unlockBodyScroll();

    const queryParams: Record<string, string | number> = {
      walletType: 'REGISTRATION',
      purpose: 'PACKAGE_UPGRADE',
      targetPackage: pkg.name,
    };
    if (pkg.price > 0) {
      queryParams['amount'] = pkg.price;
    }
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
    this.userService.fetchProfile().subscribe({
      next: () => {
        this.loadUpgradeOptions();
        this.modalService.open(
          'success',
          'Upgrade Complete',
          'Your package has been upgraded successfully.',
        );
        this.cdr.markForCheck();
      },
      error: () => {
        this.modalService.open(
          'success',
          'Payment Verified',
          'Your payment was verified. Your package will update shortly.',
        );
        this.cdr.markForCheck();
      },
    });
  }

  onUsdtBack(): void {
    this.usdtPayment.set(null);
    this.cdr.markForCheck();
  }

  onProviderChange(provider: PaymentGatewayProvider): void {
    this.selectedProvider.set(provider);
    this.cdr.markForCheck();
  }

  formatPrice(price: number, currency: string): string {
    const symbol = currency === 'NGN' ? '₦' : '$';
    return `${symbol}${price.toLocaleString()}`;
  }

  getPackageLabel(name: string): string {
    return name.charAt(0) + name.slice(1).toLowerCase();
  }
}
