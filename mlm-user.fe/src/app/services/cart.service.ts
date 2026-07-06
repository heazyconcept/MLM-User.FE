import { Injectable, signal, computed } from '@angular/core';
import { Product } from './product.service';
import { getUnavailableCartMessage } from '../core/utils/product-catalog.util';

export interface CartLineItem {
  productId: string;
  product: Product;
  quantity: number;
}

interface StoredCartLine {
  productId: string;
  quantity: number;
  product: Product;
}

const STORAGE_KEY = 'mlm_cart_v1';

@Injectable({ providedIn: 'root' })
export class CartService {
  private itemsState = signal<CartLineItem[]>(this.hydrateFromStorage());
  private checkoutHintVisibleState = signal(false);
  private checkoutHintTimer: ReturnType<typeof setTimeout> | null = null;

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

  addItem(product: Product, quantity = 1): { success: boolean; message?: string } {
    if (!product.purchasable) {
      return { success: false, message: getUnavailableCartMessage(product) };
    }

    const qty = Math.max(1, quantity);
    const current = this.itemsState();
    const existing = current.find((line) => line.productId === product.id);

    if (existing) {
      const newQty = existing.quantity + qty;
      this.setItems(
        current.map((line) =>
          line.productId === product.id ? { ...line, quantity: newQty, product } : line,
        ),
      );
    } else {
      this.setItems([...current, { productId: product.id, product, quantity: qty }]);
    }

    this.showCheckoutHint();
    return { success: true };
  }

  updateQuantity(productId: string, quantity: number): { success: boolean; message?: string } {
    if (quantity < 1) {
      this.removeItem(productId);
      return { success: true };
    }

    const line = this.itemsState().find((l) => l.productId === productId);
    if (!line) return { success: false, message: 'Item not found in cart.' };

    this.setItems(
      this.itemsState().map((l) => (l.productId === productId ? { ...l, quantity } : l)),
    );
    return { success: true };
  }

  removeItem(productId: string): void {
    this.setItems(this.itemsState().filter((line) => line.productId !== productId));
  }

  clear(): void {
    this.setItems([]);
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

  private persist(items: CartLineItem[]): void {
    try {
      const stored: StoredCartLine[] = items.map(({ productId, quantity, product }) => ({
        productId,
        quantity,
        product,
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // ignore storage errors
    }
  }

  private hydrateFromStorage(): CartLineItem[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as StoredCartLine[];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((line) => line?.productId && line?.product && line.quantity > 0)
        .map((line) => ({
          productId: line.productId,
          product: line.product,
          quantity: line.quantity,
        }));
    } catch {
      return [];
    }
  }
}
