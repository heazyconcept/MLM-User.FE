import { TestBed } from '@angular/core/testing';
import { CartService } from './cart.service';
import { Product } from './product.service';

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

describe('CartService', () => {
  let service: CartService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(CartService);
    service.clear();
  });

  afterEach(() => {
    localStorage.clear();
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
    const product = mockProduct({ inStock: false });
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

    const reloaded = TestBed.inject(CartService);
    expect(reloaded.items().length).toBe(1);
    expect(reloaded.items()[0].quantity).toBe(3);
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
});
