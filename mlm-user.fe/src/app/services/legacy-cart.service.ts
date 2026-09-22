import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, from, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  LegacyClubHttpError,
  LegacyMockCartLine,
  legacyClubMockStore,
} from '../core/mocks/legacy-club.mock';
import { Product } from './product.service';
import { ApiService } from './api.service';
import { LegacyClubService } from './legacy-club.service';
import { resolveLegacyShopMode } from '../core/models/legacy-club.models';
import { LEGACY_CLUB_USE_MOCKS } from '../core/tokens/legacy-club.tokens';

export interface LegacyCartLineItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  name: string;
  pv: number;
  image?: string;
  product?: Product;
}

interface CartApiLine {
  productId: string;
  quantity: number;
  product?: {
    id?: string;
    name?: string;
    price?: number;
    memberPriceNGN?: number;
    pv?: number;
    images?: string[];
  };
}

interface CartApiResponse {
  items?: CartApiLine[];
  subtotal?: number;
}

function mapHttpErrorCatch(err: unknown): LegacyClubHttpError {
  if (err instanceof LegacyClubHttpError) return err;
  const http = err as {
    status?: number;
    error?: { code?: string; error?: string; message?: string | string[] };
    message?: string;
  };
  const code = http?.error?.code ?? http?.error?.error ?? 'UNKNOWN';
  const message =
    (typeof http?.error?.message === 'string'
      ? http.error.message
      : Array.isArray(http?.error?.message)
        ? http.error.message[0]
        : undefined) ??
    http?.message ??
    'Something went wrong.';
  return new LegacyClubHttpError(http?.status ?? 500, String(code), message);
}

@Injectable({ providedIn: 'root' })
export class LegacyCartService {
  private api = inject(ApiService);
  private legacyClub = inject(LegacyClubService);

  private readonly useMocks =
    inject(LEGACY_CLUB_USE_MOCKS, { optional: true }) ?? environment.useLegacyClubMocks === true;

  private itemsState = signal<LegacyCartLineItem[]>([]);
  private loadingState = signal(false);
  private errorState = signal<string | null>(null);

  readonly items = this.itemsState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();

  readonly subtotal = computed(() =>
    this.itemsState().reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
  );
  readonly itemCount = computed(() =>
    this.itemsState().reduce((sum, line) => sum + line.quantity, 0),
  );
  readonly isEmpty = computed(() => this.itemsState().length === 0);

  readonly canCheckout = computed(() => {
    const mode = resolveLegacyShopMode(this.legacyClub.me());
    if (mode !== 'SHOP') return false;
    return !this.isEmpty();
  });

  readonly progressPercent = computed(() => (this.isEmpty() ? 0 : 100));

  /** Display helper for weekly voucher credit — not a checkout floor. */
  readonly weeklyVoucherHintAmount = computed(() => {
    const cycle = this.legacyClub.me()?.cycle;
    return cycle?.nextDueVoucherNet ?? this.legacyClub.me()?.autoship?.weeklyAutoshipAmount ?? 0;
  });

  refresh(): Observable<{ items: LegacyCartLineItem[]; subtotal: number }> {
    this.loadingState.set(true);
    this.errorState.set(null);

    if (this.useMocks) {
      return from(legacyClubMockStore.getCart()).pipe(
        map((res) => this.applyMockCart(res.items, res.subtotal)),
        tap(() => this.loadingState.set(false)),
        catchError((err) => {
          this.loadingState.set(false);
          this.errorState.set(err?.message ?? 'Failed to load Legacy cart');
          return throwError(() => (err instanceof LegacyClubHttpError ? err : mapHttpErrorCatch(err)));
        }),
      );
    }

    return this.api.get<CartApiResponse>('cart', { channel: 'LEGACY' }).pipe(
      map((res) => this.applyApiCart(res)),
      tap(() => this.loadingState.set(false)),
      catchError((err) => {
        this.loadingState.set(false);
        this.errorState.set('Failed to load Legacy cart');
        return throwError(() => mapHttpErrorCatch(err));
      }),
    );
  }

  setQuantity(productId: string, quantity: number): Observable<{ items: LegacyCartLineItem[]; subtotal: number }> {
    if (this.useMocks) {
      return from(legacyClubMockStore.putCartItem(productId, quantity)).pipe(
        map((res) => this.applyMockCart(res.items, res.subtotal)),
        tap(() => void this.legacyClub.loadMe().subscribe()),
        catchError((err) =>
          throwError(() => (err instanceof LegacyClubHttpError ? err : mapHttpErrorCatch(err))),
        ),
      );
    }

    return this.api.put<CartApiResponse>(`cart/items/${productId}?channel=LEGACY`, { quantity }).pipe(
      map((res) => this.applyApiCart(res)),
      tap(() => void this.legacyClub.loadMe().subscribe()),
      catchError((err) => throwError(() => mapHttpErrorCatch(err))),
    );
  }

  addProduct(product: Product, quantity = 1): Observable<{ items: LegacyCartLineItem[]; subtotal: number }> {
    const existing = this.itemsState().find((l) => l.productId === product.id);
    const nextQty = (existing?.quantity ?? 0) + quantity;
    return this.setQuantity(product.id, nextQty);
  }

  removeItem(productId: string): Observable<{ items: LegacyCartLineItem[]; subtotal: number }> {
    return this.setQuantity(productId, 0);
  }

  clear(): Observable<void> {
    if (this.useMocks) {
      return from(legacyClubMockStore.clearCart()).pipe(
        tap(() => {
          this.itemsState.set([]);
          void this.legacyClub.loadMe().subscribe();
        }),
      );
    }
    return this.api.delete<unknown>('cart?channel=LEGACY').pipe(
      map(() => undefined),
      tap(() => {
        this.itemsState.set([]);
        void this.legacyClub.loadMe().subscribe();
      }),
    );
  }

  resetLocal(): void {
    this.itemsState.set([]);
    this.errorState.set(null);
  }

  private applyMockCart(
    items: LegacyMockCartLine[],
    subtotal: number,
  ): { items: LegacyCartLineItem[]; subtotal: number } {
    const mapped: LegacyCartLineItem[] = items.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      name: line.name,
      pv: line.pv,
      image: line.image,
    }));
    this.itemsState.set(mapped);
    return { items: mapped, subtotal };
  }

  private applyApiCart(res: CartApiResponse): { items: LegacyCartLineItem[]; subtotal: number } {
    const mapped: LegacyCartLineItem[] = (res.items ?? []).map((line) => {
      const price = Number(line.product?.price ?? line.product?.memberPriceNGN ?? 0);
      return {
        productId: line.productId,
        quantity: line.quantity,
        unitPrice: price,
        name: String(line.product?.name ?? 'Product'),
        pv: Number(line.product?.pv ?? 0),
        image: line.product?.images?.[0],
      };
    });
    const subtotal =
      res.subtotal ?? mapped.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
    this.itemsState.set(mapped);
    return { items: mapped, subtotal };
  }
}
