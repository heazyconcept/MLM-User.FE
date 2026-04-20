import { Injectable, signal, computed, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface Product {
  id: string;
  name: string;
  description: string;
  memberPriceNGN: number;
  nonMemberPriceNGN: number;
  price: number;
  currency: 'NGN' | 'USD';
  pv: number; // Point Value
  cpv: number; // Carry Point Value
  category: string;
  images: string[];
  inStock: boolean;
  eligibleWallets: ('cash' | 'voucher' | 'autoship')[];
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
    const existing = this.productsState().find((p) => p.id === id);
    if (existing) {
      return of(existing);
    }

    return this.api.get<any>(`products/${id}`).pipe(
      map((res) => this.mapProduct(res)),
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
    const memberPriceNGN = Number(item.currentPrice?.memberPriceNGN ?? item.currentPrice?.basePrice ?? 0);
    const nonMemberPriceNGN = Number(item.currentPrice?.nonMemberPriceNGN ?? item.currentPrice?.basePrice ?? 0);

    return {
      id: item.id,
      name: item.name,
      description: item.description,
      memberPriceNGN,
      nonMemberPriceNGN,
      // Keep `price` for existing purchase/order flows; use member price as default.
      price: memberPriceNGN,
      currency: 'NGN',
      pv: item.currentPrice ? item.currentPrice.pv || 0 : 0,
      cpv: item.currentPrice ? item.currentPrice.cpv || 0 : 0,
      category: item.category ? item.category.name.toLowerCase() : 'other',
      images:
        item.images && item.images.length > 0
          ? item.images.map((img: any) => img.url)
          : ['/assets/images/placeholder.png'],
      inStock: item.status === 'ACTIVE',
      eligibleWallets: this.resolveEligibleWallets(item),
    };
  }

  private resolveEligibleWallets(item: any): WalletType[] {
    const candidates = [
      item?.eligibleWallets,
      item?.eligibleWalletTypes,
      item?.availableWallets,
      item?.allowedWallets,
      item?.wallets,
      item?.paymentWallets,
      item?.currentPrice?.eligibleWallets,
      item?.currentPrice?.eligibleWalletTypes,
      item?.currentPrice?.availableWallets,
      item?.currentPrice?.allowedWallets,
      item?.currentPrice?.wallets,
      item?.currentPrice?.paymentWallets,
    ];

    for (const candidate of candidates) {
      const normalized = this.normalizeWallets(candidate);
      if (normalized.length) return normalized;
    }

    return ['cash', 'voucher', 'autoship'];
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
