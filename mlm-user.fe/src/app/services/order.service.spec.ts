import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../environments/environment';
import { ApiService } from './api.service';
import { Order, OrderService } from './order.service';

describe('OrderService checkout contracts', () => {
  let service: OrderService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ApiService, OrderService],
    });
    service = TestBed.inject(OrderService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('posts canonical geography and all split groups unchanged', () => {
    const payload = {
      countryCode: 'NG',
      subdivisionCode: 'LA',
      state: 'Lagos',
      paymentMethod: 'WALLET' as const,
      idempotencyKey: 'checkout-key',
      groups: [
        {
          fulfilmentMode: 'PICKUP' as const,
          selectedMerchantId: 'merchant-1',
          items: [{ productId: 'product-1', quantity: 1 }],
        },
        {
          fulfilmentMode: 'OFFLINE_DELIVERY' as const,
          deliveryAddress: '12 Delivery Road, Lagos',
          deliveryDisclaimerAccepted: true,
          items: [{ productId: 'product-2', quantity: 2 }],
        },
      ],
    };

    service.checkoutBatch(payload).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/orders/checkout`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ checkoutId: 'checkout-1', orders: [], grandTotal: 1000 });
  });

  it('normalizes voucher wallet payment to VOUCHER', () => {
    service.payCheckoutWithWallet('checkout-1', 'voucher').subscribe();

    const req = httpMock.expectOne(
      `${environment.apiUrl}/orders/checkout/checkout-1/pay-wallet`,
    );
    expect(req.request.body).toEqual({ walletType: 'VOUCHER' });
    req.flush({ paidOrderIds: ['order-1'] });
  });

  it('propagates dispute loading failures', () => {
    let status: number | undefined;
    service
      .getOrderDisputes('order-1')
      .subscribe({ error: (error) => (status = error.status) });

    httpMock
      .expectOne(`${environment.apiUrl}/orders/order-1/disputes`)
      .flush({}, { status: 503, statusText: 'Unavailable' });

    expect(status).toBe(503);
  });

  it('maps resolved dispute history fields', () => {
    let result: unknown;
    service.getOrderDisputes('order-1').subscribe((rows) => (result = rows));

    httpMock.expectOne(`${environment.apiUrl}/orders/order-1/disputes`).flush({
      disputes: [
        {
          id: 'dispute-1',
          orderId: 'order-1',
          reason: 'Damaged item',
          status: 'RESOLVED',
          outcome: 'REFUND',
          adminNotes: 'Refund approved',
          resolvedAt: '2026-07-15T10:00:00Z',
          createdAt: '2026-07-14T10:00:00Z',
        },
      ],
    });

    expect(result).toEqual([
      expect.objectContaining({
        status: 'RESOLVED',
        outcome: 'REFUND',
        adminNotes: 'Refund approved',
        resolvedAt: '2026-07-15T10:00:00Z',
      }),
    ]);
  });

  it('posts dispute multipart data to the order endpoint unchanged', () => {
    const formData = new FormData();
    formData.append('reason', 'Damaged item');
    formData.append('customerNotes', 'The seal was broken');

    service.openOrderDispute('order-1', formData).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/orders/order-1/disputes`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBe(formData);
    expect((req.request.body as FormData).get('reason')).toBe('Damaged item');
    req.flush({
      id: 'dispute-1',
      orderId: 'order-1',
      reason: 'Damaged item',
      status: 'OPEN',
      createdAt: '2026-07-15T10:00:00Z',
    });
  });

  it('maps marketplace source fields from order list responses', () => {
    service.loadOrders();

    httpMock
      .expectOne((req) => req.url === `${environment.apiUrl}/orders`)
      .flush({
        orders: [
          {
            id: 'order-legacy',
            reference: 'ORD-LEG-001',
            status: 'PAID',
            totalAmount: 5000,
            currency: 'NGN',
            fulfilmentMode: 'PICKUP',
            channel: 'LEGACY',
            sourceLabel: 'Legacy Marketplace',
            paidFromWalletType: 'LEGACY_VOUCHER',
            paidFromLabel: 'Legacy product voucher',
            items: [],
            createdAt: '2026-10-01T10:00:00.000Z',
          },
        ],
      });

    expect(service.list()[0]).toEqual(
      expect.objectContaining({
        channel: 'LEGACY',
        sourceLabel: 'Legacy Marketplace',
        paidFromWalletType: 'LEGACY_VOUCHER',
        paidFromLabel: 'Legacy product voucher',
      }),
    );
  });

  it('sends channel query param when loading filtered orders', () => {
    service.setChannelFilter('LEGACY');
    service.loadOrders({ channel: 'LEGACY' });

    const req = httpMock.expectOne(
      `${environment.apiUrl}/orders?channel=LEGACY`,
    );
    expect(req.request.method).toBe('GET');
    req.flush({ orders: [] });
  });

  it('only enables pickup handoff actions for picked-up orders without open disputes', () => {
    const order = {
      fulfilmentMethod: 'pickup',
      rawStatus: 'PICKED_UP',
      hasOpenDispute: false,
    } as Order;

    expect(OrderService.canConfirmPickupReceived(order, [])).toBe(true);
    expect(OrderService.canOpenPickupDispute(order, [])).toBe(true);
    expect(
      OrderService.canConfirmPickupReceived({ ...order, fulfilmentMethod: 'delivery' }, []),
    ).toBe(false);
    expect(
      OrderService.canOpenPickupDispute({ ...order, hasOpenDispute: true }, []),
    ).toBe(false);
  });

});
