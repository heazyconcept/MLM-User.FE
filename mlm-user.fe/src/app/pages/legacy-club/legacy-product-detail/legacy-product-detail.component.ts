import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { environment } from '../../../../environments/environment';
import { legacyClubMockStore, LegacyClubHttpError } from '../../../core/mocks/legacy-club.mock';
import { Product, ProductService } from '../../../services/product.service';
import { LegacyCartService } from '../../../services/legacy-cart.service';
import { LegacyClubService } from '../../../services/legacy-club.service';
import {
  LEGACY_ERROR_CODES,
  LegacyShopMode,
  resolveLegacyShopMode,
} from '../../../core/models/legacy-club.models';
import {
  canPurchaseProduct,
  formatCatalogPrice,
  getNextActiveLabel,
} from '../../../core/utils/product-catalog.util';
import { ProductGalleryComponent } from '../../../components/product-gallery/product-gallery.component';
import { QuantitySelectorComponent } from '../../../components/quantity-selector/quantity-selector.component';
import { BadgeComponent } from '../../../components/badge/badge.component';

const ACTIVE_SHOP_MODES: LegacyShopMode[] = ['AUTOSHIP', 'UPGRADE', 'REACTIVATE'];

@Component({
  selector: 'app-legacy-product-detail',
  imports: [
    CommonModule,
    RouterLink,
    ProductGalleryComponent,
    QuantitySelectorComponent,
    BadgeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './legacy-product-detail.component.html',
})
export class LegacyProductDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cart = inject(LegacyCartService);
  private legacyClub = inject(LegacyClubService);
  private productService = inject(ProductService);
  private messages = inject(MessageService);

  product = signal<Product | null>(null);
  quantity = signal(1);
  adding = signal(false);

  total = computed(() => {
    const p = this.product();
    return p ? p.price * this.quantity() : 0;
  });

  totalPV = computed(() => {
    const p = this.product();
    return p ? p.pv * this.quantity() : 0;
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    if (!id) {
      void this.router.navigate(['/legacy/shop']);
      return;
    }

    this.legacyClub.loadMe().subscribe({
      next: (me) => {
        const mode = resolveLegacyShopMode(me);
        if (me?.status === 'ACTIVE') {
          if (!ACTIVE_SHOP_MODES.includes(mode)) {
            void this.router.navigate(['/legacy']);
          }
          return;
        }
        if (me?.status !== 'PENDING_JOIN' || mode !== 'JOIN') {
          void this.router.navigate(['/legacy/join']);
        }
      },
    });

    this.loadProduct(id);
  }

  onQuantityChange(value: number): void {
    this.quantity.set(value);
  }

  onAddToCart(): void {
    this.addToLegacyCart(false);
  }

  onBuyNow(): void {
    this.addToLegacyCart(true);
  }

  formatCurrency(amount: number): string {
    const p = this.product();
    return formatCatalogPrice(amount, p?.currency ?? this.legacyClub.me()?.currency ?? 'NGN');
  }

  nextActiveLabel(p: Product): string | null {
    return getNextActiveLabel(p);
  }

  canPurchase(p: Product): boolean {
    return canPurchaseProduct(p);
  }

  buyNowLabel(p: Product): string {
    const nextActive = getNextActiveLabel(p);
    if (nextActive) return nextActive;
    if (p.priceStatus === 'scheduled') return 'Out of Stock';
    if (p.priceStatus === 'unpriced') return 'Unavailable';
    if (!p.purchasable) return 'Out of Stock';
    return 'Buy Now';
  }

  private loadProduct(id: string): void {
    if (environment.useLegacyClubMocks) {
      const mock = legacyClubMockStore.getProduct(id);
      if (!mock) {
        void this.router.navigate(['/legacy/shop']);
        return;
      }
      this.product.set({
        id: mock.id,
        name: mock.name,
        description: mock.description,
        memberPriceNGN: mock.price,
        nonMemberPriceNGN: mock.price,
        price: mock.price,
        currency: mock.currency,
        pv: mock.pv,
        directReferralPv: mock.directReferralPv,
        cpv: mock.cpv,
        category: mock.category,
        images: mock.images,
        inStock: mock.inStock,
        eligibleWallets: ['voucher'],
        purchasable: mock.purchasable,
        availableFrom: null,
        nextPriceEffectiveFrom: null,
        priceStatus: 'active',
      });
      return;
    }

    this.productService.getProductById(id).subscribe((p) => {
      if (!p) {
        void this.router.navigate(['/legacy/shop']);
        return;
      }
      this.product.set(p);
    });
  }

  private addToLegacyCart(goToCart: boolean): void {
    const p = this.product();
    if (!p || !canPurchaseProduct(p) || this.adding()) return;

    this.adding.set(true);
    this.cart.addProduct(p, this.quantity()).subscribe({
      next: () => {
        this.adding.set(false);
        this.messages.add({
          severity: 'success',
          summary: 'Added to cart',
          detail: `${p.name} was added to your Legacy cart.`,
          life: 3000,
        });
        if (goToCart) {
          void this.router.navigate(['/legacy/cart']);
        }
      },
      error: (err: LegacyClubHttpError) => {
        this.adding.set(false);
        if (err.code === LEGACY_ERROR_CODES.LEGACY_SHOP_JOIN_ONLY) {
          void this.router.navigate(['/legacy']);
          return;
        }
        this.messages.add({
          severity: 'error',
          summary: 'Could not add to cart',
          detail: err.message ?? 'This product is unavailable.',
          life: 4000,
        });
      },
    });
  }
}
