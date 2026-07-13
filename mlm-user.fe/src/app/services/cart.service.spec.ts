import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { signal, computed } from '@angular/core';
import { describe, beforeEach, it, expect, afterEach } from 'vitest';
import { CartService } from './cart.service';
import { Product } from './product.service';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { UserService, User } from './user.service';
import { environment } from '../../environments/environment';

function mockProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    name: 'Test Product',
    description: 'Desc',
    memberPriceNGN: 1000,
    nonMemberPriceNGN: 1200,
    price: 1000,
    currency: 'NGN',
    pv: 10,
    directReferralPv: 5,
    cpv: 2,
    category: 'health',
    images: ['/img.png'],
    inStock: true,
    eligibleWallets: ['voucher'],
    purchasable: true,
    availableFrom: null,
    nextPriceEffectiveFrom: null,
    priceStatus: 'active',
    ...overrides,
  };
}

function mockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    username: 'DELE1',
    email: 'dele@example.com',
    firstName: 'Ben',
    lastName: 'Dele',
    paymentStatus: 'PAID',
    profileCompletionPercentage: 100,
    ...overrides,
  };
}

describe('CartService', () => {
  let service: CartService;
  let httpMock: HttpTestingController;
  const baseUrl = environment.apiUrl;
  const isAuthenticatedSignal = signal(false);
  const userSignal = signal<User | null>(null);

  function flushCartPut(productId: string, product: Product, quantity: number): void {
    const putReq = httpMock.expectOne(`${baseUrl}/cart/items/${productId}`);
    putReq.flush({
      items: [{ productId, quantity, product }],
    });
  }

  function loginAs(user: User): void {
    isAuthenticatedSignal.set(true);
    userSignal.set(user);
    TestBed.flushEffects();
  }

  beforeEach(() => {
    localStorage.clear();
    isAuthenticatedSignal.set(false);
    userSignal.set(null);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        CartService,
        ApiService,
        {
          provide: AuthService,
          useValue: {
            isAuthenticated: isAuthenticatedSignal.asReadonly(),
          },
        },
        {
          provide: UserService,
          useValue: {
            currentUser: computed(() => userSignal()),
          },
        },
      ],
    });

    service = TestBed.inject(CartService);
    httpMock = TestBed.inject(HttpTestingController);
    service.clear();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('should add a product to an empty cart', () => {
    const product = mockProduct();
    const result = service.addItem(product, 2);

    expect(result.success).toBe(true);
    expect(service.items().length).toBe(1);
    expect(service.items()[0].quantity).toBe(2);
    expect(service.itemCount()).toBe(2);
  });

  it('should merge quantity when adding the same product twice', () => {
    const product = mockProduct();
    service.addItem(product, 2);
    service.addItem(product, 3);

    expect(service.items().length).toBe(1);
    expect(service.items()[0].quantity).toBe(5);
    expect(service.itemCount()).toBe(5);
  });

  it('should merge large quantities without a cap', () => {
    const product = mockProduct();
    service.addItem(product, 8);
    const result = service.addItem(product, 5);

    expect(result.success).toBe(true);
    expect(service.items()[0].quantity).toBe(13);
  });

  it('should reject unavailable products', () => {
    const product = mockProduct({ purchasable: false });
    const result = service.addItem(product);

    expect(result.success).toBe(false);
    expect(service.isEmpty()).toBe(true);
  });

  it('should compute subtotal and total PV', () => {
    service.addItem(mockProduct({ id: 'a', price: 1000, pv: 10 }), 2);
    service.addItem(mockProduct({ id: 'b', price: 500, pv: 5 }), 1);

    expect(service.subtotal()).toBe(2500);
    expect(service.totalPv()).toBe(25);
  });

  it('should remove items and clear the cart', () => {
    const product = mockProduct();
    service.addItem(product);
    service.removeItem(product.id);
    expect(service.isEmpty()).toBe(true);

    service.addItem(product);
    service.clear();
    expect(service.isEmpty()).toBe(true);
  });

  it('should persist cart to localStorage', () => {
    const product = mockProduct();
    service.addItem(product, 3);

    const stored = JSON.parse(localStorage.getItem('mlm_cart_v1')!);
    expect(stored.length).toBe(1);
    expect(stored[0].quantity).toBe(3);
  });

  it('should show checkout hint when adding to cart', () => {
    const product = mockProduct();
    expect(service.checkoutHintVisible()).toBe(false);

    service.addItem(product);

    expect(service.checkoutHintVisible()).toBe(true);
    service.dismissCheckoutHint();
    expect(service.checkoutHintVisible()).toBe(false);
  });

  it('should update quantity and remove when quantity is zero', () => {
    const product = mockProduct();
    service.addItem(product, 2);
    service.updateQuantity(product.id, 0);
    expect(service.isEmpty()).toBe(true);
  });

  it('should scope localStorage cart per user', () => {
    loginAs(mockUser({ id: 'user-1' }));
    httpMock.expectOne(`${baseUrl}/cart`).flush({ items: [] });

    const productForUser1 = mockProduct({ id: 'prod-user-1', name: 'User 1 Product' });
    service.addItem(productForUser1, 4);
    flushCartPut(productForUser1.id, productForUser1, 4);
    expect(localStorage.getItem('mlm_cart_v1:user-1')).toBeTruthy();

    userSignal.set(mockUser({ id: 'user-2' }));
    TestBed.flushEffects();
    httpMock.expectOne(`${baseUrl}/cart`).flush({ items: [] });

    const productForUser2 = mockProduct({ id: 'prod-user-2', name: 'User 2 Product' });
    service.addItem(productForUser2, 2);
    flushCartPut(productForUser2.id, productForUser2, 2);
    expect(localStorage.getItem('mlm_cart_v1:user-2')).toBeTruthy();

    const user1Cart = JSON.parse(localStorage.getItem('mlm_cart_v1:user-1')!);
    expect(user1Cart[0].productId).toBe('prod-user-1');
  });

  it('should migrate legacy localStorage cart to per-user key on login', () => {
    const legacyProduct = mockProduct({ id: 'legacy-prod', name: 'Legacy Product' });
    localStorage.setItem(
      'mlm_cart_v1',
      JSON.stringify([{ productId: legacyProduct.id, quantity: 3, product: legacyProduct }]),
    );

    loginAs(mockUser({ id: 'user-1' }));

    const getReq = httpMock.expectOne(`${baseUrl}/cart`);
    getReq.flush({ items: [] });

    const mergeReq = httpMock.expectOne(`${baseUrl}/cart/merge`);
    expect(mergeReq.request.body).toEqual({
      items: [{ productId: 'legacy-prod', quantity: 3 }],
    });
    mergeReq.flush({
      items: [{ productId: 'legacy-prod', quantity: 3, product: legacyProduct }],
    });

    expect(localStorage.getItem('mlm_cart_v1')).toBeNull();
    expect(service.items().length).toBe(1);
    expect(service.items()[0].quantity).toBe(3);
  });

  it('should fall back to localStorage when cart API is unavailable', () => {
    const product = mockProduct();
    service.addItem(product, 2);

    loginAs(mockUser({ id: 'user-1' }));

    const getReq = httpMock.expectOne(`${baseUrl}/cart`);
    getReq.flush('Not Found', { status: 404, statusText: 'Not Found' });

    expect(service.items().length).toBe(1);
    expect(service.items()[0].quantity).toBe(2);
    httpMock.expectNone(`${baseUrl}/cart/merge`);
  });

  it('should hydrate cart from server when no local items exist', () => {
    const serverProduct = mockProduct({ id: 'server-prod', name: 'Server Product' });

    loginAs(mockUser({ id: 'user-1' }));

    const getReq = httpMock.expectOne(`${baseUrl}/cart`);
    getReq.flush({
      items: [{ productId: serverProduct.id, quantity: 5, product: serverProduct }],
    });

    expect(service.items().length).toBe(1);
    expect(service.items()[0].productId).toBe('server-prod');
    expect(service.items()[0].quantity).toBe(5);
    httpMock.expectNone(`${baseUrl}/cart/merge`);
  });

  it('should sync cart mutations to server when API is available', () => {
    loginAs(mockUser({ id: 'user-1' }));

    const getReq = httpMock.expectOne(`${baseUrl}/cart`);
    getReq.flush({ items: [] });

    const product = mockProduct();
    service.addItem(product, 2);

    const putReq = httpMock.expectOne(`${baseUrl}/cart/items/${product.id}`);
    expect(putReq.request.method).toBe('PUT');
    expect(putReq.request.body).toEqual({ quantity: 2 });
    putReq.flush({ items: [{ productId: product.id, quantity: 2, product }] });

    service.clear();
    const deleteReq = httpMock.expectOne(`${baseUrl}/cart`);
    expect(deleteReq.request.method).toBe('DELETE');
    deleteReq.flush(null);
  });

  it('should reset in-memory cart on logout', () => {
    const product = mockProduct();
    service.addItem(product, 2);
    expect(service.isEmpty()).toBe(false);

    loginAs(mockUser({ id: 'user-1' }));
    httpMock.expectOne(`${baseUrl}/cart`).flush({ items: [] });
    const mergeReq = httpMock.expectOne(`${baseUrl}/cart/merge`);
    mergeReq.flush({
      items: [{ productId: product.id, quantity: 2, product }],
    });

    isAuthenticatedSignal.set(false);
    userSignal.set(null);
    TestBed.flushEffects();

    expect(service.isEmpty()).toBe(true);
    expect(localStorage.getItem('mlm_cart_v1:user-1')).toBeTruthy();
  });

  it('should normalize catalog-nested product snapshots from GET /cart', () => {
    loginAs(mockUser({ id: 'user-1' }));

    const getReq = httpMock.expectOne(`${baseUrl}/cart`);
    getReq.flush({
      items: [
        {
          productId: 'nested-prod',
          quantity: 2,
          product: {
            id: 'nested-prod',
            name: 'Nested Product',
            currentPrice: {
              memberDisplayPrice: 2500,
              memberPriceNGN: 2500,
              nonMemberPriceNGN: 3000,
              displayCurrency: 'NGN',
              pv: 15,
              directReferralPv: 7,
              cpv: 3,
            },
            images: [{ id: 'img-1', url: '/nested.png', altText: 'Nested', position: 0 }],
            category: { name: 'Health' },
            purchasable: true,
            inStock: true,
            priceStatus: 'active',
            eligibleWallets: ['cash', 'voucher'],
          },
        },
      ],
    });

    expect(service.items()[0].product.price).toBe(2500);
    expect(service.items()[0].product.pv).toBe(15);
    expect(service.items()[0].product.images).toEqual(['/nested.png']);
    expect(service.items()[0].product.category).toBe('health');
  });

  it('should hydrate cart from PUT response with updated server snapshot', () => {
    loginAs(mockUser({ id: 'user-1' }));
    httpMock.expectOne(`${baseUrl}/cart`).flush({ items: [] });

    const product = mockProduct({ id: 'prod-1', price: 1000 });
    service.addItem(product, 2);

    const serverProduct = mockProduct({ id: 'prod-1', price: 1200, name: 'Updated Name' });
    const putReq = httpMock.expectOne(`${baseUrl}/cart/items/${product.id}`);
    putReq.flush({
      items: [{ productId: 'prod-1', quantity: 2, product: serverProduct }],
    });

    expect(service.items()[0].product.price).toBe(1200);
    expect(service.items()[0].product.name).toBe('Updated Name');
  });

  it('should revert optimistic update when PUT fails', () => {
    loginAs(mockUser({ id: 'user-1' }));
    httpMock.expectOne(`${baseUrl}/cart`).flush({ items: [] });

    const product = mockProduct({ id: 'prod-1' });
    service.addItem(product, 1);
    httpMock
      .expectOne(`${baseUrl}/cart/items/${product.id}`)
      .flush({ items: [{ productId: 'prod-1', quantity: 1, product }] });
    expect(service.items()[0].quantity).toBe(1);

    service.addItem(product, 2);
    expect(service.items()[0].quantity).toBe(3);

    const putReq = httpMock.expectOne(`${baseUrl}/cart/items/${product.id}`);
    putReq.flush('Server error', { status: 500, statusText: 'Server Error' });

    expect(service.items()[0].quantity).toBe(1);
  });

  it('should refresh cart from server when refreshFromServer is called', () => {
    loginAs(mockUser({ id: 'user-1' }));
    httpMock.expectOne(`${baseUrl}/cart`).flush({ items: [] });

    const refreshedProduct = mockProduct({ id: 'remote-prod', name: 'Remote Product' });
    service.refreshFromServer();

    const refreshReq = httpMock.expectOne(`${baseUrl}/cart`);
    refreshReq.flush({
      items: [{ productId: 'remote-prod', quantity: 4, product: refreshedProduct }],
    });

    expect(service.items().length).toBe(1);
    expect(service.items()[0].productId).toBe('remote-prod');
    expect(service.items()[0].quantity).toBe(4);
  });
});
