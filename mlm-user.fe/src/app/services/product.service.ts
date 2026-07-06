import { Injectable, signal, computed, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Observable, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';

export interface Product {
  id: string;
  name: string;
  description: string;
  memberPriceNGN: number;
  nonMemberPriceNGN: number;
  price: number;
  currency: 'NGN' | 'USD';
  pv: number; // Point Value
  directReferralPv: number; // Direct Referral PV
  cpv: number; // Carry Point Value
  category: string;
  images: string[];
  inStock: boolean;
  eligibleWallets: ('cash' | 'voucher' | 'autoship')[];
  purchasable: boolean;
  availableFrom: string | null;
  priceStatus: 'active' | 'scheduled' | 'unpriced';
}

export interface Category {
  id: string;
  name: string;
  icon: string;
}

type WalletType = 'cash' | 'voucher' | 'autoship';

export type SortOption = 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc' | 'pv-desc';

@Injectable({
  providedIn: 'root',
})
export class ProductService {
  private api = inject(ApiService);

  // Private state
  private productsState = signal<Product[]>([]);
  private categoriesState = signal<Category[]>([
    { id: 'all', name: 'All Products', icon: 'pi-th-large' },
  ]);
  private selectedCategoryState = signal<string>('all');
  private searchQueryState = signal<string>('');
  private sortOptionState = signal<SortOption>('name-asc');
  private selectedProductState = signal<Product | null>(null);
  private isLoadingState = signal<boolean>(false);

  // Public readonly signals
  readonly products = this.productsState.asReadonly();
  readonly categories = this.categoriesState.asReadonly();
  readonly selectedCategory = this.selectedCategoryState.asReadonly();
  readonly searchQuery = this.searchQueryState.asReadonly();
  readonly sortOption = this.sortOptionState.asReadonly();
  readonly selectedProduct = this.selectedProductState.asReadonly();
  readonly isLoading = this.isLoadingState.asReadonly();

  // Computed: filtered and sorted products
  readonly filteredProducts = computed(() => {
    let result = this.productsState();

    // Filter by category
    const category = this.selectedCategoryState();
    if (category && category !== 'all') {
      result = result.filter((p) => p.category === category);
    }

    // Filter by search query
    const query = this.searchQueryState().toLowerCase().trim();
    if (query) {
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query) ||
          p.category.toLowerCase().includes(query),
      );
    }

    // Sort
    const sort = this.sortOptionState();
    result = [...result].sort((a, b) => {
      switch (sort) {
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'price-asc':
          return a.price - b.price;
        case 'price-desc':
          return b.price - a.price;
        case 'pv-desc':
          return b.pv - a.pv;
        default:
          return 0;
      }
    });

    return result;
  });

  readonly productCount = computed(() => this.filteredProducts().length);
  readonly totalProductCount = computed(() => this.productsState().length);

  // Actions
  setCategory(categoryId: string): void {
    this.selectedCategoryState.set(categoryId);
  }

  setSearchQuery(query: string): void {
    this.searchQueryState.set(query);
  }

  setSortOption(option: SortOption): void {
    this.sortOptionState.set(option);
  }

  selectProduct(product: Product | null): void {
    this.selectedProductState.set(product);
  }

  getProductById(id: string): Observable<Product | undefined> {
    return this.api.get<any>(`products/${id}`).pipe(
      map((res) => this.mapProduct(res)),
      tap((mapped) => {
        const current = this.productsState();
        const idx = current.findIndex((p) => p.id === id);
        if (idx >= 0) {
          const updated = [...current];
          updated[idx] = mapped;
          this.productsState.set(updated);
        }
      }),
      catchError(() => of(undefined)),
    );
  }

  clearFilters(): void {
    this.selectedCategoryState.set('all');
    this.searchQueryState.set('');
    this.sortOptionState.set('name-asc');
  }

  loadProducts(limit = 100, offset = 0, categoryId?: string): void {
    this.isLoadingState.set(true);
    let url = `products`;
    if (categoryId && categoryId !== 'all') {
      url += `?categoryId=${categoryId}`;
    }

    this.api.get<any>(url).subscribe({
      next: (res) => {
        if (!res || !res.items) {
          this.productsState.set([]);
          this.isLoadingState.set(false);
          return;
        }

        const mappedProducts = res.items.map((item: any) => this.mapProduct(item));
        this.productsState.set(mappedProducts);

        const catMap = new Map<string, Category>();
        catMap.set('all', { id: 'all', name: 'All Products', icon: 'pi-th-large' });

        res.items.forEach((item: any) => {
          if (item.category) {
            const catId = item.category.name.toLowerCase();
            if (!catMap.has(catId)) {
              catMap.set(catId, {
                id: catId,
                name: item.category.name,
                icon: 'pi-tag',
              });
            }
          }
        });
        this.categoriesState.set(Array.from(catMap.values()));
      },
      error: (err) => {
        console.error('Failed to load products', err);
        this.isLoadingState.set(false);
      },
      complete: () => {
        this.isLoadingState.set(false);
      },
    });
  }

  private mapProduct(item: any): Product {
    const cp = item.currentPrice;
    const displayCurrency = (cp?.displayCurrency ?? 'NGN') as 'NGN' | 'USD';
    const memberDisplayPrice = Number(
      cp?.memberDisplayPrice ?? cp?.memberPriceNGN ?? cp?.basePrice ?? 0,
    );
    const nonMemberDisplayPrice = Number(
      cp?.nonMemberDisplayPrice ?? cp?.nonMemberPriceNGN ?? cp?.basePrice ?? 0,
    );
    const memberPriceNGN = Number(cp?.memberPriceNGN ?? memberDisplayPrice);
    const nonMemberPriceNGN = Number(cp?.nonMemberPriceNGN ?? nonMemberDisplayPrice);

    const priceStatus = item.priceStatus ?? (cp ? 'active' : 'unpriced');
    const purchasable = item.purchasable ?? (priceStatus === 'active' && item.status === 'ACTIVE');
    const availableFrom = item.availableFrom ?? cp?.effectiveFrom ?? null;

    const inStock = purchasable;

    return {
      id: item.id,
      name: item.name,
      description: item.description ?? '',
      memberPriceNGN,
      nonMemberPriceNGN,
      price: memberDisplayPrice,
      currency: displayCurrency,
      pv: cp ? cp.pv || 0 : 0,
      directReferralPv: cp ? cp.directReferralPv || 0 : 0,
      cpv: cp ? cp.cpv || 0 : 0,
      category: item.category ? item.category.name.toLowerCase() : 'other',
      images:
        item.images && item.images.length > 0
          ? item.images.map((img: any) => img.url)
          : ['/assets/images/placeholder.png'],
      inStock,
      eligibleWallets: this.resolveEligibleWallets(item),
      purchasable,
      availableFrom,
      priceStatus,
    };
  }

  private resolveEligibleWallets(item: any): WalletType[] {
    return ['voucher'];
  }

  private normalizeWallets(value: unknown): WalletType[] {
    if (!Array.isArray(value)) return [];

    const mapped = value
      .map((entry) => String(entry ?? '').trim().toLowerCase())
      .map((entry): WalletType | null => {
        if (entry === 'cash' || entry === 'wallet' || entry === 'cash_wallet') return 'cash';
        if (entry === 'voucher' || entry === 'product_voucher' || entry === 'voucher_wallet') {
          return 'voucher';
        }
        if (entry === 'autoship' || entry === 'autoship_wallet') return 'autoship';
        return null;
      })
      .filter((wallet): wallet is WalletType => wallet !== null);

    return Array.from(new Set(mapped));
  }
}
