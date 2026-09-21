import { Component, ChangeDetectionStrategy, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { OrderPreviewComponent } from '../../orders/order-preview/order-preview.component';
import { LegacyCartService } from '../../../services/legacy-cart.service';
import { LegacyClubService } from '../../../services/legacy-club.service';
import { LegacyCheckoutService } from '../../../services/legacy-checkout.service';
import { AuthService } from '../../../services/auth.service';
import {
  CheckoutConfirmPayload,
  CartCheckoutData,
} from '../../../services/cart-checkout.service';
import { CartLineItem } from '../../../services/cart.service';
import { Product } from '../../../services/product.service';
import { formatLegacyMoney } from '../../../core/utils/legacy-money.util';
import {
  LegacyShopMode,
  resolveLegacyShopMode,
} from '../../../core/models/legacy-club.models';
import { LegacyPageShellComponent } from '../components/legacy-page-shell.component';
import { LegacyPageHeaderComponent } from '../components/legacy-page-header.component';
import { LegacyPanelComponent } from '../components/legacy-panel.component';

const ACTIVE_SHOP_MODES: LegacyShopMode[] = ['AUTOSHIP', 'UPGRADE', 'REACTIVATE'];

@Component({
  selector: 'app-legacy-checkout',
  imports: [
    CommonModule,
    RouterLink,
    ButtonModule,
    OrderPreviewComponent,
    LegacyPageShellComponent,
    LegacyPageHeaderComponent,
    LegacyPanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-legacy-page-shell>
      <app-legacy-page-header
        [title]="pageTitle()"
        subtitle="Pay with your Legacy product voucher only."
        backLink="/legacy/cart"
        backLabel="Legacy cart"
      />

      @if (isImpersonating()) {
        <app-legacy-panel>
          <p class="text-sm text-mlm-secondary">Checkout is disabled during impersonation.</p>
        </app-legacy-panel>
      } @else {
        <app-legacy-panel title="Order details">
          <div class="space-y-2 text-sm text-mlm-text">
          @if (shopMode() === 'JOIN' && pending(); as p) {
            <p>
              <span class="font-semibold">Package:</span> {{ p.package }}
            </p>
            <p>
              <span class="font-semibold">Sponsor:</span> &#64;{{ p.sponsorUsername }}
              <span class="text-gray-500">
                ({{ p.sponsorSource === 'AUTO' ? 'Automatic' : 'You chose this username' }})
              </span>
            </p>
            <p>
              Instant you will receive
              <span class="font-semibold">in the Legacy account</span>
              after pay.
            </p>
          } @else if (shopMode() === 'AUTOSHIP') {
            <p class="font-semibold">Legacy Autoship</p>
            <p>Autoship — no Instant Commission. Pay with Legacy product voucher.</p>
            @if (cart.autoshipWarnBelowUnit()) {
              <p class="text-amber-900">
                Below one Autoship unit — waiting months will not drop (PV only).
              </p>
            } @else if (cart.autoshipReleaseUnits() > 0) {
              <p class="text-emerald-800">
                This checkout can release {{ cart.autoshipReleaseUnits() }} waiting month(s).
              </p>
            }
          } @else if (shopMode() === 'UPGRADE') {
            <p class="font-semibold">
              Upgrade{{ intentPackage() ? ' to ' + intentPackage() : '' }}
            </p>
            <p>Pay the difference only. Instant goes to your Legacy account.</p>
            <p>Your 6 months start again from month 1.</p>
          } @else if (shopMode() === 'REACTIVATE') {
            <p class="font-semibold">Reactivate {{ membershipPackage() }}</p>
            <p>Full Instant goes to your Legacy account. Cycle starts again from month 1.</p>
            @if (isQualified()) {
              <p class="text-emerald-800">You keep the increased monthly.</p>
            }
          }

          <p>
            Pay with <span class="font-semibold">Legacy product voucher</span> only —
            balance {{ money(voucherBalance()) }}.
            @if (voucherBalance() < cart.subtotal()) {
              <a routerLink="/legacy/voucher" class="ml-1 font-medium text-mlm-primary hover:underline"
                >Fund your Legacy product voucher, then return here.</a
              >
            }
          </p>
          <p class="font-semibold">Cart total: {{ money(cart.subtotal()) }}</p>
          </div>
        </app-legacy-panel>

        @if (pendingOrderData(); as orderData) {
          <app-order-preview
            [pendingOrderData]="orderData"
            [submitting]="submitting()"
            (orderConfirmed)="onConfirm($event)"
          />
        }
      }
    </app-legacy-page-shell>
  `,
})
export class LegacyCheckoutComponent implements OnInit {
  cart = inject(LegacyCartService);
  private legacyClub = inject(LegacyClubService);
  private checkout = inject(LegacyCheckoutService);
  private auth = inject(AuthService);
  private router = inject(Router);

  submitting = signal(false);
  voucherBalance = signal(0);
  pendingOrderData = signal<CartCheckoutData | null>(null);
  isImpersonating = computed(() => !!this.auth.impersonation());
  pending = computed(() => this.legacyClub.me()?.pendingJoin ?? null);
  shopMode = computed(() => resolveLegacyShopMode(this.legacyClub.me()));
  intentPackage = computed(() => this.legacyClub.me()?.intentPackage ?? null);
  membershipPackage = computed(() => this.legacyClub.me()?.membership?.package ?? '');
  isQualified = computed(() => !!this.legacyClub.me()?.monthlyQualify?.isQualified);

  pageTitle = computed(() => {
    const mode = this.shopMode();
    switch (mode) {
      case 'AUTOSHIP':
        return 'Legacy Autoship';
      case 'UPGRADE':
        return 'Legacy upgrade checkout';
      case 'REACTIVATE':
        return 'Legacy reactivate checkout';
      case 'JOIN':
        return 'Legacy Club checkout';
      case 'NONE':
        return 'Legacy Club checkout';
      default: {
        const _exhaustive: never = mode;
        return _exhaustive;
      }
    }
  });

  ngOnInit(): void {
    this.legacyClub.loadMe().subscribe({
      next: (me) => {
        const mode = resolveLegacyShopMode(me);
        if (me?.status === 'ACTIVE') {
          if (!ACTIVE_SHOP_MODES.includes(mode)) {
            void this.router.navigate(['/legacy']);
            return;
          }
          this.ensureFloors(mode);
          this.cart.refresh().subscribe({
            next: () => this.buildPending(),
            error: () => undefined,
          });
          this.legacyClub.getVoucher().subscribe({
            next: (v) => this.voucherBalance.set(v.balance),
          });
          return;
        }
        if (me?.status !== 'PENDING_JOIN') {
          void this.router.navigate(['/legacy/join']);
          return;
        }
        this.cart.refresh().subscribe({
          next: () => this.buildPending(),
          error: () => undefined,
        });
        this.legacyClub.getVoucher().subscribe({
          next: (v) => this.voucherBalance.set(v.balance),
        });
      },
    });
  }

  money(amount: number): string {
    return formatLegacyMoney(amount, this.legacyClub.me()?.currency ?? 'NGN');
  }

  onConfirm(payload: CheckoutConfirmPayload): void {
    if (this.isImpersonating() || this.submitting()) return;
    this.submitting.set(true);
    this.checkout.submitLegacyCheckout(payload).subscribe({
      next: () => this.submitting.set(false),
      error: () => this.submitting.set(false),
    });
  }

  private ensureFloors(mode: LegacyShopMode): void {
    if (mode === 'REACTIVATE' && this.cart.purchaseRequired() <= 0) {
      const pkg = this.legacyClub.me()?.membership?.package;
      if (!pkg) return;
      this.legacyClub.getPackages().subscribe({
        next: (res) => {
          const found = res.packages.find((p) => p.code === pkg);
          if (found) this.cart.setReactivateFloor(found.purchaseAmount);
        },
      });
    }
  }

  private buildPending(): void {
    const items: CartLineItem[] = this.cart.items().map((line) => {
      const product: Product = {
        id: line.productId,
        name: line.name,
        description: '',
        memberPriceNGN: line.unitPrice,
        nonMemberPriceNGN: line.unitPrice,
        price: line.unitPrice,
        currency: this.legacyClub.me()?.currency ?? 'NGN',
        pv: line.pv,
        directReferralPv: 0,
        cpv: 0,
        category: 'health',
        images: line.image ? [line.image] : [],
        inStock: true,
        eligibleWallets: ['voucher'],
        purchasable: true,
        availableFrom: null,
        nextPriceEffectiveFrom: null,
        priceStatus: 'active',
      };
      return { productId: line.productId, product, quantity: line.quantity };
    });
    this.pendingOrderData.set({ mode: 'cart', items, wallet: 'voucher' });
  }
}
