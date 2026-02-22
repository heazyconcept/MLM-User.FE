import { Component, inject, signal, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { UserService } from '../../../services/user.service';
import { PaymentService, UpgradeOption } from '../../../services/payment.service';
import { LoadingService } from '../../../services/loading.service';
import { ModalService } from '../../../services/modal.service';

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
  imports: [CommonModule, ButtonModule, DialogModule],
  templateUrl: './package-upgrade.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PackageUpgradeComponent implements OnInit {
  private router = inject(Router);
  private userService = inject(UserService);
  private paymentService = inject(PaymentService);
  private loadingService = inject(LoadingService);
  private modalService = inject(ModalService);
  private cdr = inject(ChangeDetectorRef);

  currentUser = this.userService.currentUser;
  displayCurrency = this.userService.displayCurrency;
  isLoading = this.loadingService.isLoading;

  packages = signal<PackageCard[]>([]);
  isLoadingOptions = signal(true);
  loadError = signal<string | null>(null);

  showConfirmDialog = signal(false);
  selectedPackage = signal<PackageCard | null>(null);

  ngOnInit(): void {
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
            price: currency === 'NGN' ? details.priceNgn : details.priceUsd,
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
    // If API returned options, map them — use prices from API directly
    if (options.length > 0) {
      return options.map((opt) => {
        const name = opt.package.toUpperCase();
        const idx = PACKAGE_ORDER.indexOf(name);
        const details = STATIC_DETAILS[name] ?? STATIC_DETAILS['SILVER'];
        return {
          name,
          price: opt.price,
          currency: opt.currency,
          isCurrent: opt.currentPackage || name === currentPkg,
          isDowngrade: idx <= currentIdx && name !== currentPkg,
          benefits: opt.benefits ?? details.benefits,
          color: details.color,
          icon: details.icon
        };
      });
    }

    // No options from API — use static list with user's display currency
    const currency = this.displayCurrency();
    return PACKAGE_ORDER.map((name, idx) => {
      const details = STATIC_DETAILS[name] ?? STATIC_DETAILS['SILVER'];
      return {
        name,
        price: currency === 'NGN' ? details.priceNgn : details.priceUsd,
        currency,
        isCurrent: name === currentPkg,
        isDowngrade: idx <= currentIdx && name !== currentPkg,
        benefits: details.benefits,
        color: details.color,
        icon: details.icon
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
    const callbackUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/auth/payment/callback`
      : undefined;

    this.paymentService.initiateUpgradePayment(pkg.name, callbackUrl).subscribe({
      next: (res) => {
        this.loadingService.hide();
        this.showConfirmDialog.set(false);
        this.cdr.markForCheck();

        const gatewayUrl = res.authorizationUrl ?? res.gatewayUrl;
        if (gatewayUrl) {
          window.location.href = gatewayUrl;
        } else if (res.reference) {
          this.router.navigate(['/auth/register/payment-pending'], {
            queryParams: { reference: res.reference },
            state: { reference: res.reference }
          });
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
  }

  formatPrice(price: number, currency: string): string {
    const symbol = currency === 'NGN' ? '₦' : '$';
    return `${symbol}${price.toLocaleString()}`;
  }

  getPackageLabel(name: string): string {
    return name.charAt(0) + name.slice(1).toLowerCase();
  }
}
