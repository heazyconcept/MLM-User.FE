import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { Product } from './product.service';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { getUnavailableCartMessage } from '../core/utils/product-catalog.util';

export interface CartLineItem {
  productId: string;
  product: Product;
  quantity: number;
}

interface CartApiLine {
  productId: string;
  quantity: number;
  product: unknown;
}

interface CartApiResponse {
  items: CartApiLine[];
}

const STORAGE_KEY_PREFIX = 'mlm_cart_v1';
const LEGACY_STORAGE_KEY = 'mlm_cart_v1';

@Injectable({ providedIn: 'root' })
export class CartService {
  private api = inject(ApiService);
  private authService = inject(AuthService);
  private userService = inject(UserService);

  private itemsState = signal<CartLineItem[]>([]);
  private checkoutHintVisibleState = signal(false);
  private checkoutHintTimer: ReturnType<typeof setTimeout> | null = null;
  private serverAvailable = false;
  private syncInFlight = false;
  private lastSyncedUserId: string | null = null;
  private activeUserId: string | null = null;
  private wasAuthenticated = false;

  readonly items = this.itemsState.asReadonly();
  readonly checkoutHintVisible = this.checkoutHintVisibleState.asReadonly();
  readonly itemCount = computed(() =>
    this.itemsState().reduce((sum, line) => sum + line.quantity, 0),
  );
  readonly lineCount = computed(() => this.itemsState().length);
  readonly subtotal = computed(() =>
    this.itemsState().reduce((sum, line) => sum + line.product.price * line.quantity, 0),
  );
  readonly totalPv = computed(() =>
    this.itemsState().reduce((sum, line) => sum + line.product.pv * line.quantity, 0),
  );
  readonly isEmpty = computed(() => this.itemsState().length === 0);
  readonly hasUnavailableItems = computed(() =>
    this.itemsState().some((line) => !line.product.inStock || !line.product.purchasable),
  );

  constructor() {
    this.hydrateForCurrentContext();

    effect(() => {
      const isAuthenticated = this.authService.isAuthenticated();
      const userId = this.userService.currentUser()?.id ?? null;

      if (!isAuthenticated) {
        if (this.wasAuthenticated) {
          this.resetOnLogout();
        }
        this.wasAuthenticated = false;
        return;
      }

      this.wasAuthenticated = true;

      if (userId && userId !== this.lastSyncedUserId) {
        this.hydrateForUser(userId);
        this.syncFromServer(userId);
      }
    });
  }

  addItem(product: Product, quantity = 1): { success: boolean; message?: string } {
    if (!product.purchasable) {
      return { success: false, message: getUnavailableCartMessage(product) };
    }

    const qty = Math.max(1, quantity);
    const previousItems = this.itemsState();
    const current = previousItems;
    const existing = current.find((line) => line.productId === product.id);

    if (existing) {
      const newQty = existing.quantity + qty;
      this.setItems(
        current.map((line) =>
          line.productId === product.id ? { ...line, quantity: newQty, product } : line,
        ),
      );
      this.syncItemToServer(product.id, newQty, previousItems);
    } else {
      this.setItems([...current, { productId: product.id, product, quantity: qty }]);
      this.syncItemToServer(product.id, qty, previousItems);
    }

    this.showCheckoutHint();
    return { success: true };
  }

  updateQuantity(productId: string, quantity: number): { success: boolean; message?: string } {
    if (quantity < 1) {
      this.removeItem(productId);
      return { success: true };
    }

    const previousItems = this.itemsState();
    const line = previousItems.find((l) => l.productId === productId);
    if (!line) return { success: false, message: 'Item not found in cart.' };

    this.setItems(
      previousItems.map((l) => (l.productId === productId ? { ...l, quantity } : l)),
    );
    this.syncItemToServer(productId, quantity, previousItems);
    return { success: true };
  }

  removeItem(productId: string): void {
    const previousItems = this.itemsState();
    this.setItems(previousItems.filter((line) => line.productId !== productId));
    this.syncItemToServer(productId, 0, previousItems);
  }

  clear(): void {
    this.setItems([]);
    this.syncClearToServer();
  }

  refreshFromServer(): void {
    if (!this.serverAvailable || !this.authService.isAuthenticated()) {
      return;
    }

    this.api
      .get<CartApiResponse>('cart')
      .pipe(catchError(() => of(null)))
      .subscribe((response) => {
        if (response) {
          this.setItems(this.mapApiItems(response.items));
        }
      });
  }

  resetOnLogout(): void {
    this.itemsState.set([]);
    this.dismissCheckoutHint();
    this.serverAvailable = false;
    this.syncInFlight = false;
    this.lastSyncedUserId = null;
    this.activeUserId = null;
  }

  dismissCheckoutHint(): void {
    this.checkoutHintVisibleState.set(false);
    if (this.checkoutHintTimer) {
      clearTimeout(this.checkoutHintTimer);
      this.checkoutHintTimer = null;
    }
  }

  private showCheckoutHint(): void {
    this.checkoutHintVisibleState.set(true);
    if (this.checkoutHintTimer) {
      clearTimeout(this.checkoutHintTimer);
    }
    this.checkoutHintTimer = setTimeout(() => this.dismissCheckoutHint(), 8000);
  }

  private setItems(items: CartLineItem[]): void {
    this.itemsState.set(items);
    this.persist(items);
  }

  private hydrateForCurrentContext(): void {
    const userId = this.userService.currentUser()?.id ?? null;
    this.hydrateForUser(userId);
  }

  private hydrateForUser(userId: string | null): void {
    this.activeUserId = userId;
    this.itemsState.set(this.hydrateFromStorage(userId));
  }

  private storageKey(userId: string | null): string {
    return userId ? `${STORAGE_KEY_PREFIX}:${userId}` : LEGACY_STORAGE_KEY;
  }

  private persist(items: CartLineItem[]): void {
    try {
      const stored = items.map(({ productId, quantity, product }) => ({
        productId,
        quantity,
        product,
      }));
      localStorage.setItem(this.storageKey(this.activeUserId), JSON.stringify(stored));
    } catch {
      // ignore storage errors
    }
  }

  private hydrateFromStorage(userId: string | null): CartLineItem[] {
    const userKey = this.storageKey(userId);
    const userItems = this.parseStoredCart(localStorage.getItem(userKey));
    if (userItems.length > 0 || !userId) {
      return userItems;
    }

    const legacyItems = this.parseStoredCart(localStorage.getItem(LEGACY_STORAGE_KEY));
    if (legacyItems.length > 0) {
      try {
        localStorage.setItem(userKey, JSON.stringify(legacyItems));
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      } catch {
        // ignore storage errors
      }
    }
    return legacyItems;
  }

  private parseStoredCart(raw: string | null): CartLineItem[] {
    try {
      if (!raw) return [];
      const parsed = JSON.parse(raw) as CartApiLine[];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((line) => line?.productId && line?.product && line.quantity > 0)
        .map((line) => ({
          productId: line.productId,
          product: this.normalizeCartSnapshot(line.product),
          quantity: line.quantity,
        }));
    } catch {
      return [];
    }
  }

  private syncFromServer(userId: string): void {
    if (this.syncInFlight || this.lastSyncedUserId === userId) {
      return;
    }

    this.syncInFlight = true;

    this.api
      .get<CartApiResponse>('cart')
      .pipe(
        catchError((error: unknown) => {
          if (this.isCartApiUnavailable(error)) {
            this.serverAvailable = false;
            this.lastSyncedUserId = userId;
          }
          return of(null);
        }),
      )
      .subscribe((response) => {
        this.syncInFlight = false;
        if (!response) return;

        this.serverAvailable = true;
        const localItems = this.itemsState();

        if (localItems.length > 0) {
          this.api
            .post<CartApiResponse>('cart/merge', {
              items: localItems.map(({ productId, quantity }) => ({ productId, quantity })),
            })
            .pipe(
              catchError(() => {
                this.setItems(this.mapApiItems(response.items));
                this.clearLegacyStorage();
                this.lastSyncedUserId = userId;
                return of(null);
              }),
            )
            .subscribe((merged) => {
              if (merged) {
                this.setItems(this.mapApiItems(merged.items));
              }
              this.clearLegacyStorage();
              this.lastSyncedUserId = userId;
            });
          return;
        }

        this.setItems(this.mapApiItems(response.items));
        this.clearLegacyStorage();
        this.lastSyncedUserId = userId;
      });
  }

  private syncItemToServer(
    productId: string,
    quantity: number,
    previousItems: CartLineItem[],
  ): void {
    if (!this.serverAvailable) return;

    this.api
      .put<CartApiResponse>(`cart/items/${productId}`, { quantity })
      .pipe(catchError(() => of(null)))
      .subscribe((response) => {
        if (response) {
          this.setItems(this.mapApiItems(response.items));
        } else {
          this.setItems(previousItems);
        }
      });
  }

  private syncClearToServer(): void {
    if (!this.serverAvailable) return;

    this.api.delete<void>('cart').pipe(catchError(() => of(null))).subscribe();
  }

  private mapApiItems(items: CartApiLine[]): CartLineItem[] {
    return items
      .filter((line) => line?.productId && line?.product && line.quantity > 0)
      .map((line) => ({
        productId: line.productId,
        product: this.normalizeCartSnapshot(line.product),
        quantity: line.quantity,
      }));
  }

  private normalizeCartSnapshot(raw: unknown): Product {
    const p = raw as Record<string, unknown>;
    const currentPrice = p['currentPrice'] as Record<string, unknown> | null | undefined;
    const categoryRaw = p['category'];

    const imagesRaw = p['images'] as unknown;
    const images: string[] = Array.isArray(imagesRaw)
      ? imagesRaw.map((img) =>
          typeof img === 'string' ? img : String((img as { url: string }).url ?? ''),
        )
      : ['/assets/images/placeholder.png'];

    const displayCurrency = (p['currency'] ?? currentPrice?.['displayCurrency'] ?? 'NGN') as
      | 'NGN'
      | 'USD';
    const memberDisplayPrice = Number(
      p['price'] ?? currentPrice?.['memberDisplayPrice'] ?? currentPrice?.['memberPriceNGN'] ?? 0,
    );
    const nonMemberDisplayPrice = Number(
      p['nonMemberPriceNGN'] ??
        currentPrice?.['nonMemberDisplayPrice'] ??
        currentPrice?.['nonMemberPriceNGN'] ??
        0,
    );
    const memberPriceNGN = Number(p['memberPriceNGN'] ?? currentPrice?.['memberPriceNGN'] ?? memberDisplayPrice);
    const nonMemberPriceNGN = Number(
      p['nonMemberPriceNGN'] ?? currentPrice?.['nonMemberPriceNGN'] ?? nonMemberDisplayPrice,
    );

    const priceStatus = (p['priceStatus'] ??
      (currentPrice ? 'active' : 'unpriced')) as Product['priceStatus'];
    const purchasable = Boolean(
      p['purchasable'] ?? (priceStatus === 'active' && p['status'] !== 'INACTIVE'),
    );
    const availableFrom = (p['availableFrom'] as string | null) ?? currentPrice?.['effectiveFrom'] ?? null;
    const nextPriceEffectiveFrom =
      p['nextPriceEffectiveFrom'] != null ? String(p['nextPriceEffectiveFrom']) : null;
    const inStock = p['inStock'] != null ? Boolean(p['inStock']) : purchasable;

    let category = 'other';
    if (typeof categoryRaw === 'string') {
      category = categoryRaw.toLowerCase();
    } else if (categoryRaw && typeof categoryRaw === 'object') {
      const name = (categoryRaw as { name?: string }).name;
      category = name ? name.toLowerCase() : 'other';
    }

    return {
      id: String(p['id'] ?? p['productId'] ?? ''),
      name: String(p['name'] ?? ''),
      description: String(p['description'] ?? ''),
      memberPriceNGN,
      nonMemberPriceNGN,
      price: memberDisplayPrice,
      currency: displayCurrency,
      pv: Number(p['pv'] ?? currentPrice?.['pv'] ?? 0),
      directReferralPv: Number(p['directReferralPv'] ?? currentPrice?.['directReferralPv'] ?? 0),
      cpv: Number(p['cpv'] ?? currentPrice?.['cpv'] ?? 0),
      category,
      images: images.length > 0 ? images : ['/assets/images/placeholder.png'],
      inStock,
      eligibleWallets: this.normalizeEligibleWallets(p['eligibleWallets']),
      purchasable,
      availableFrom: availableFrom as string | null,
      nextPriceEffectiveFrom,
      priceStatus,
    };
  }

  private normalizeEligibleWallets(value: unknown): Product['eligibleWallets'] {
    if (!Array.isArray(value)) return ['voucher'];

    const mapped = value
      .map((entry) => String(entry ?? '').trim().toLowerCase())
      .map((entry): Product['eligibleWallets'][number] | null => {
        if (entry === 'cash' || entry === 'wallet' || entry === 'cash_wallet') return 'cash';
        if (entry === 'voucher' || entry === 'product_voucher' || entry === 'voucher_wallet') {
          return 'voucher';
        }
        if (entry === 'autoship' || entry === 'autoship_wallet') return 'autoship';
        return null;
      })
      .filter((wallet): wallet is Product['eligibleWallets'][number] => wallet !== null);

    return mapped.length > 0 ? Array.from(new Set(mapped)) : ['voucher'];
  }

  private isCartApiUnavailable(error: unknown): boolean {
    if (!(error instanceof HttpErrorResponse)) return true;
    return error.status === 404 || error.status === 501 || error.status === 405;
  }

  private clearLegacyStorage(): void {
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
  }
}
