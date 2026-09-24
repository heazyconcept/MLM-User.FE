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
  resolveLegacyShopMode,
} from '../../../core/models/legacy-club.models';
import { LegacyPageShellComponent } from '../components/legacy-page-shell.component';
import { LegacyPageHeaderComponent } from '../components/legacy-page-header.component';
import { LegacyPanelComponent } from '../components/legacy-panel.component';
import { PurchaseThankYouModalComponent } from '../../../components/purchase-thank-you-modal/purchase-thank-you-modal.component';

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
    PurchaseThankYouModalComponent,
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
        <div class="max-w-2xl">
          <app-legacy-panel>
            <p class="text-sm text-mlm-secondary">Checkout is disabled during impersonation.</p>
          </app-legacy-panel>
        </div>
      } @else {
        <div class="mt-2 flex max-w-2xl flex-col gap-8">
          <app-legacy-panel>
            <div class="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p class="text-xs font-bold uppercase tracking-[.15em] text-mlm-secondary">
                  Legacy product voucher
                </p>
                <p class="mt-3 text-3xl font-extrabold tracking-tight text-mlm-text">
                  {{ money(voucherBalance()) }}
                </p>
                <p class="mt-3 text-sm leading-relaxed text-mlm-secondary">
                  Payment comes from this balance.
                </p>
              </div>
              <div class="sm:text-right">
                <p class="text-xs font-bold uppercase tracking-[.15em] text-mlm-secondary">
                  Cart total
                </p>
                <p class="mt-3 text-2xl font-bold text-mlm-text">{{ money(cart.subtotal()) }}</p>
              </div>
            </div>
            @if (voucherBalance() < cart.subtotal()) {
              <a
                routerLink="/legacy/voucher"
                class="mt-6 inline-flex text-sm font-semibold text-mlm-primary hover:underline"
              >
                Add funds before you pay
              </a>
            }
          </app-legacy-panel>

          @if (pendingOrderData(); as orderData) {
            <app-order-preview
              [pendingOrderData]="orderData"
              [submitting]="submitting()"
              [pickupOnly]="true"
              (orderConfirmed)="onConfirm($event)"
            />
          }
        </div>
      }
    </app-legacy-page-shell>
    <app-purchase-thank-you-modal />
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
  pageTitle = computed(() => 'Legacy marketplace checkout');

  ngOnInit(): void {
    this.legacyClub.loadMe().subscribe({
      next: (me) => {
        if (resolveLegacyShopMode(me) !== 'SHOP') {
          void this.router.navigate(['/legacy/home']);
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
    const orderData = this.pendingOrderData();
    if (this.isImpersonating() || this.submitting() || !orderData) return;
    this.submitting.set(true);
    this.checkout.submitLegacyCheckout(orderData, payload).subscribe({
      next: () => this.submitting.set(false),
      error: () => this.submitting.set(false),
    });
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
    this.pendingOrderData.set({ mode: 'cart', items, wallet: 'legacy_voucher' });
  }
}
