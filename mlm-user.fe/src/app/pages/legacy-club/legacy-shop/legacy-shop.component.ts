import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
  computed,
  effect,
} from '@angular/core';
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
  resolveLegacyShopMode,
} from '../../../core/models/legacy-club.models';
import { LegacyClubHttpError } from '../../../core/mocks/legacy-club.mock';
import { LegacyPageShellComponent } from '../components/legacy-page-shell.component';
import { LegacyPageHeaderComponent } from '../components/legacy-page-header.component';
import { LegacyPanelComponent } from '../components/legacy-panel.component';

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
        subtitle="Optional shop · pay with Legacy product voucher"
        backLink="/legacy/home"
        backLabel="Legacy Club"
      >
        <div actions class="flex flex-wrap items-center gap-2">
          <a routerLink="/legacy/voucher">
            <p-button label="Fund Legacy voucher" [outlined]="true" size="small" />
          </a>
        </div>
      </app-legacy-page-header>

      @if (closedMessage()) {
        <app-legacy-panel>
          <div class="py-6 text-center">
            <p class="font-semibold text-mlm-text">{{ closedMessage() }}</p>
            <a routerLink="/legacy/home" class="mt-5 inline-block">
              <p-button label="Back to Legacy Club" />
            </a>
          </div>
        </app-legacy-panel>
      } @else {
        <div
          class="sticky top-0 z-10 rounded-xl border border-gray-200 bg-white/95 px-5 py-4 shadow-sm backdrop-blur"
        >
          <div class="flex items-center justify-between gap-3 text-sm">
            <span class="font-medium text-mlm-text">Cart {{ money(cart.subtotal()) }}</span>
            <a routerLink="/legacy/cart" class="font-semibold text-mlm-primary hover:underline">
              View cart ({{ cart.itemCount() }})
            </a>
          </div>
          @if (stickyHint(); as hint) {
            <p class="mt-1 text-xs text-mlm-secondary">{{ hint }}</p>
          }
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
  private awaitingLiveProducts = signal(false);

  constructor() {
    effect(() => {
      if (!this.awaitingLiveProducts()) return;
      if (this.productService.isLoading()) return;
      this.products.set([...this.productService.products()]);
      this.loading.set(false);
      this.awaitingLiveProducts.set(false);
    });
  }

  stickyHint = computed(() => {
    const voucherNet = this.legacyClub.me()?.cycle?.nextDueVoucherNet;
    if (voucherNet != null && voucherNet > 0) {
      return `Your weekly voucher credit is ${this.money(voucherNet)} — shop whenever you want.`;
    }
    return 'Spend your Legacy product voucher anytime. Shopping does not unlock commission.';
  });

  ngOnInit(): void {
    this.legacyClub.loadMe().subscribe({
      next: () => this.openShop(),
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
          void this.router.navigate(['/legacy/pay/JOIN']);
          return;
        }
        this.messages.add({ severity: 'error', summary: 'Cart', detail: err.message });
      },
    });
  }

  private openShop(): void {
    const mode = resolveLegacyShopMode(this.legacyClub.me());
    if (mode === 'JOIN') {
      this.closedMessage.set('Finish your membership payment before shopping.');
      this.loading.set(false);
      return;
    }
    if (mode !== 'SHOP') {
      this.closedMessage.set('Legacy marketplace is not available right now.');
      this.loading.set(false);
      return;
    }
    this.closedMessage.set(null);
    this.loadProducts();
    this.cart.refresh().subscribe({ error: () => undefined });
  }

  private loadProducts(): void {
    this.loading.set(true);
    if (environment.useLegacyClubMocks) {
      const mockProducts = legacyClubMockStore.getProducts();
      this.products.set(
        mockProducts.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          price: p.price,
          memberPriceNGN: p.price,
          currency: p.currency,
          pv: p.pv,
          directReferralPv: p.directReferralPv,
          cpv: p.cpv,
          category: p.category,
          images: p.images,
          inStock: p.inStock,
          purchasable: p.purchasable,
        })) as Product[],
      );
      this.loading.set(false);
      return;
    }
    this.awaitingLiveProducts.set(true);
    this.productService.loadProducts();
  }
}
