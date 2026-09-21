import { Component, ChangeDetectionStrategy, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { SkeletonModule } from 'primeng/skeleton';
import { LegacyClubService } from '../../../services/legacy-club.service';
import { LegacyCartService } from '../../../services/legacy-cart.service';
import { environment } from '../../../../environments/environment';
import { legacyClubMockStore } from '../../../core/mocks/legacy-club.mock';
import { Product } from '../../../services/product.service';
import { ProductService } from '../../../services/product.service';
import { ProductCardComponent } from '../../shop/components/product-card.component';
import { formatLegacyMoney } from '../../../core/utils/legacy-money.util';
import {
  LEGACY_ERROR_CODES,
  LegacyShopMode,
  resolveLegacyShopMode,
} from '../../../core/models/legacy-club.models';
import { LegacyClubHttpError } from '../../../core/mocks/legacy-club.mock';
import { LegacyPageShellComponent } from '../components/legacy-page-shell.component';
import { LegacyPageHeaderComponent } from '../components/legacy-page-header.component';
import { LegacyPanelComponent } from '../components/legacy-panel.component';

const ACTIVE_SHOP_MODES: LegacyShopMode[] = ['AUTOSHIP', 'UPGRADE', 'REACTIVATE'];

@Component({
  selector: 'app-legacy-shop',
  imports: [
    CommonModule,
    RouterLink,
    ButtonModule,
    SkeletonModule,
    ProductCardComponent,
    LegacyPageShellComponent,
    LegacyPageHeaderComponent,
    LegacyPanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-legacy-page-shell>
      <app-legacy-page-header
        title="Legacy Club marketplace"
        [subtitle]="modeChip() ?? 'Browse products for your Legacy purchase'"
        backLink="/legacy"
        backLabel="Legacy Club"
      >
        <div actions class="flex flex-wrap items-center gap-2">
          @if (canCancelIntent()) {
            <p-button
              label="Cancel"
              [text]="true"
              size="small"
              [loading]="cancelling()"
              (onClick)="cancelIntent()"
            />
          }
          <a routerLink="/legacy/voucher">
            <p-button label="Fund Legacy voucher" [outlined]="true" size="small" />
          </a>
        </div>
      </app-legacy-page-header>

      @if (closedMessage()) {
        <app-legacy-panel>
          <div class="py-6 text-center">
            <p class="font-semibold text-mlm-text">{{ closedMessage() }}</p>
            <a routerLink="/legacy" class="mt-5 inline-block">
              <p-button label="Back to Legacy Club" />
            </a>
          </div>
        </app-legacy-panel>
      } @else {
        <div
          class="sticky top-0 z-10 rounded-xl border border-gray-200 bg-white/95 px-5 py-4 shadow-sm backdrop-blur"
        >
          <div class="flex items-center justify-between gap-3 text-sm">
            <span class="font-medium text-mlm-text">{{ stickyLabel() }}</span>
            <a routerLink="/legacy/cart" class="font-semibold text-mlm-primary hover:underline">
              View cart ({{ cart.itemCount() }})
            </a>
          </div>
          @if (stickyHint(); as hint) {
            <p class="mt-1 text-xs text-mlm-secondary">{{ hint }}</p>
          }
          <div class="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              class="h-full rounded-full transition-all"
              [class]="cart.canCheckout() ? 'bg-emerald-500' : 'bg-mlm-primary'"
              [style.width.%]="cart.progressPercent()"
            ></div>
          </div>
        </div>

        @if (loading()) {
          <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            @for (_ of [1, 2, 3, 4, 5, 6, 7, 8]; track $index) {
              <p-skeleton height="16rem" styleClass="rounded-xl" />
            }
          </div>
        } @else if (products().length === 0) {
          <p class="py-12 text-center text-mlm-secondary">No products available. Please try again later.</p>
        } @else {
          <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            @for (product of products(); track product.id) {
              <app-product-card
                [product]="product"
                (productClick)="onProductClick($event)"
                (addToCart)="onAddToCart($event)"
              />
            }
          </div>
        }
      }
    </app-legacy-page-shell>
  `,
})
export class LegacyShopComponent implements OnInit {
  private legacyClub = inject(LegacyClubService);
  private productService = inject(ProductService);
  private router = inject(Router);
  private messages = inject(MessageService);
  cart = inject(LegacyCartService);

  products = signal<Product[]>([]);
  loading = signal(true);
  closedMessage = signal<string | null>(null);
  cancelling = signal(false);

  shopMode = computed(() => resolveLegacyShopMode(this.legacyClub.me()));

  modeChip = computed(() => {
    const me = this.legacyClub.me();
    const mode = this.shopMode();
    switch (mode) {
      case 'JOIN': {
        const p = me?.pendingJoin;
        return p ? `${p.package} · ${this.money(p.purchaseRequired)}` : 'Join';
      }
      case 'AUTOSHIP':
        return `Autoship · ${this.money(me?.autoship?.requiredAmount ?? 0)}`;
      case 'UPGRADE':
        return me?.intentPackage
          ? `Upgrade · ${me.intentPackage}`
          : 'Upgrade · difference';
      case 'REACTIVATE':
        return me?.membership?.package
          ? `Reactivate · ${me.membership.package}`
          : 'Reactivate · full pack';
      case 'NONE':
        return null;
      default: {
        const _exhaustive: never = mode;
        return _exhaustive;
      }
    }
  });

  stickyLabel = computed(() => {
    const mode = this.shopMode();
    const subtotal = this.cart.subtotal();
    if (mode === 'AUTOSHIP') {
      const required = this.cart.autoshipRequired();
      return `Cart ${this.money(subtotal)} of ${this.money(required)} Autoship`;
    }
    return `Cart ${this.money(subtotal)} of ${this.money(this.cart.purchaseRequired())}`;
  });

  stickyHint = computed(() => {
    const mode = this.shopMode();
    if (mode === 'AUTOSHIP') {
      const pending = this.legacyClub.me()?.cycle?.pendingCount ?? 0;
      if (pending > 0) {
        const units = this.cart.autoshipReleaseUnits();
        if (units > 0) {
          return `This checkout can release ${units} waiting month(s).`;
        }
        return 'Cart is below one Autoship unit — this checkout is PV only until you reach the minimum.';
      }
      return 'Autoship not required right now. You can still buy (PV only). Early Autoship does not keep a credit.';
    }
    if (mode === 'UPGRADE' || mode === 'REACTIVATE') {
      const units = this.cart.autoshipReleaseUnits();
      if (units > 0) {
        return `This basket can also release ${units} waiting month(s).`;
      }
    }
    return null;
  });

  canCancelIntent = computed(() => {
    const mode = this.shopMode();
    return mode === 'UPGRADE' || mode === 'REACTIVATE';
  });

  ngOnInit(): void {
    this.legacyClub.loadMe().subscribe({
      next: (me) => {
        const mode = resolveLegacyShopMode(me);
        if (me?.status === 'ACTIVE') {
          if (!ACTIVE_SHOP_MODES.includes(mode)) {
            // Phase 1-only backend or no cycle / NONE: keep shop closed
            this.closedMessage.set(
              'Legacy marketplace is closed until Autoship (coming in your 6-month cycle).',
            );
            this.loading.set(false);
            return;
          }
          this.openShop();
          return;
        }
        if (me?.status !== 'PENDING_JOIN' || mode !== 'JOIN') {
          void this.router.navigate(['/legacy/join']);
          return;
        }
        this.openShop();
      },
    });
  }

  money(amount: number): string {
    return formatLegacyMoney(amount, this.legacyClub.me()?.currency ?? 'NGN');
  }

  onProductClick(product: Product): void {
    void this.router.navigate(['/legacy/shop/product', product.id]);
  }

  onAddToCart(product: Product): void {
    this.cart.addProduct(product).subscribe({
      next: () =>
        this.messages.add({
          severity: 'success',
          summary: 'Added',
          detail: `${product.name} added to Legacy cart`,
        }),
      error: (err: LegacyClubHttpError) => {
        if (err.code === LEGACY_ERROR_CODES.LEGACY_SHOP_JOIN_ONLY) {
          const me = this.legacyClub.me();
          const mode = resolveLegacyShopMode(me);
          if (me?.status === 'ACTIVE' && (mode === 'NONE' || !me.cycle)) {
            this.closedMessage.set(
              'Legacy marketplace is closed until Autoship (coming in your 6-month cycle).',
            );
            return;
          }
          void this.router.navigate(['/legacy']);
          return;
        }
        this.messages.add({ severity: 'error', summary: 'Cart', detail: err.message });
      },
    });
  }

  cancelIntent(): void {
    const mode = this.shopMode();
    if (mode !== 'UPGRADE' && mode !== 'REACTIVATE') return;
    this.cancelling.set(true);
    const req =
      mode === 'UPGRADE' ? this.legacyClub.cancelUpgrade() : this.legacyClub.cancelReactivate();
    req.subscribe({
      next: () => {
        this.cancelling.set(false);
        this.messages.add({
          severity: 'success',
          summary: 'Cancelled',
          detail: mode === 'UPGRADE' ? 'Upgrade cancelled.' : 'Reactivate cancelled.',
        });
        void this.router.navigate(['/legacy']);
      },
      error: (err: LegacyClubHttpError) => {
        this.cancelling.set(false);
        this.messages.add({
          severity: 'error',
          summary: 'Cancel',
          detail: err.message ?? 'Could not cancel.',
        });
      },
    });
  }

  private openShop(): void {
    this.closedMessage.set(null);
    this.loadProducts();
    this.cart.refresh().subscribe({ error: () => undefined });
  }

  private loadProducts(): void {
    if (environment.useLegacyClubMocks) {
      const mocks = legacyClubMockStore.getProducts();
      this.products.set(
        mocks.map(
          (p): Product => ({
            id: p.id,
            name: p.name,
            description: p.description,
            memberPriceNGN: p.price,
            nonMemberPriceNGN: p.price,
            price: p.price,
            currency: p.currency,
            pv: p.pv,
            directReferralPv: p.directReferralPv,
            cpv: p.cpv,
            category: p.category,
            images: p.images,
            inStock: p.inStock,
            eligibleWallets: ['voucher'],
            purchasable: p.purchasable,
            availableFrom: null,
            nextPriceEffectiveFrom: null,
            priceStatus: 'active',
          }),
        ),
      );
      this.loading.set(false);
      return;
    }
    this.productService.loadProducts();
    const poll = window.setInterval(() => {
      if (!this.productService.isLoading()) {
        this.products.set([...this.productService.filteredProducts()]);
        this.loading.set(false);
        window.clearInterval(poll);
      }
    }, 50);
  }
}
