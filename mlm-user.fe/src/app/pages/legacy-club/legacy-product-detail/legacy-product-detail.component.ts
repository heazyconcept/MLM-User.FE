import { Component, ChangeDetectionStrategy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { environment } from '../../../../environments/environment';
import { legacyClubMockStore, LegacyClubHttpError } from '../../../core/mocks/legacy-club.mock';
import { Product, ProductService } from '../../../services/product.service';
import { LegacyCartService } from '../../../services/legacy-cart.service';
import { LegacyClubService } from '../../../services/legacy-club.service';
import { formatLegacyMoney } from '../../../core/utils/legacy-money.util';
import { LEGACY_ERROR_CODES } from '../../../core/models/legacy-club.models';

@Component({
  selector: 'app-legacy-product-detail',
  imports: [CommonModule, RouterLink, ButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-mlm-background">
      <main class="py-8">
        <div class="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
      <a routerLink="/legacy/shop" class="text-sm font-medium text-mlm-primary hover:underline"
        >← Legacy marketplace</a
      >

      @if (product(); as p) {
        <div class="grid gap-6 lg:grid-cols-2">
          <div class="overflow-hidden rounded-2xl border border-gray-100 bg-white">
            @if (p.images[0]; as img) {
              <img [src]="img" [alt]="p.name" class="aspect-square w-full object-cover" />
            } @else {
              <div class="flex aspect-square items-center justify-center bg-mlm-background text-mlm-secondary">
                <i class="pi pi-box text-4xl"></i>
              </div>
            }
          </div>
          <div class="rounded-2xl border border-gray-100 bg-white p-6 sm:p-8">
            <h1 class="text-2xl font-bold text-mlm-text sm:text-3xl">{{ p.name }}</h1>
            <p class="mt-3 text-sm leading-relaxed text-mlm-secondary">{{ p.description }}</p>
            <p class="mt-6 text-3xl font-extrabold tracking-tight text-mlm-text">{{ money(p.price) }}</p>
            <p class="mt-1 text-sm text-mlm-secondary">{{ p.pv }} PV</p>
            <p-button
              class="mt-8"
              label="Add to Legacy cart"
              styleClass="w-full sm:w-auto"
              (onClick)="add()"
            />
          </div>
        </div>
      } @else {
        <p class="text-mlm-secondary">Product not found.</p>
      }
        </div>
      </main>
    </div>
  `,
})
export class LegacyProductDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cart = inject(LegacyCartService);
  private legacyClub = inject(LegacyClubService);
  private productService = inject(ProductService);
  private messages = inject(MessageService);

  product = signal<Product | null>(null);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.legacyClub.loadMe().subscribe({
      next: (me) => {
        if (me?.status === 'ACTIVE') {
          void this.router.navigate(['/legacy']);
          return;
        }
      },
    });

    if (environment.useLegacyClubMocks) {
      const mock = legacyClubMockStore.getProduct(id);
      if (mock) {
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
      }
      return;
    }

    this.productService.getProductById(id).subscribe({
      next: (p) => this.product.set(p ?? null),
    });
  }

  money(amount: number): string {
    return formatLegacyMoney(amount, this.legacyClub.me()?.currency ?? 'NGN');
  }

  add(): void {
    const p = this.product();
    if (!p) return;
    this.cart.addProduct(p).subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: 'Added', detail: 'Added to Legacy cart' });
        void this.router.navigate(['/legacy/cart']);
      },
      error: (err: LegacyClubHttpError) => {
        if (err.code === LEGACY_ERROR_CODES.LEGACY_SHOP_JOIN_ONLY) {
          void this.router.navigate(['/legacy']);
          return;
        }
        this.messages.add({ severity: 'error', summary: 'Cart', detail: err.message });
      },
    });
  }
}
