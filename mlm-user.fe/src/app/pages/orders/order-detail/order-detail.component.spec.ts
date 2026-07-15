import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Observable, of, throwError } from 'rxjs';

import { InvoiceService } from '../../../services/invoice.service';
import { Order, OrderDispute, OrderService } from '../../../services/order.service';
import { OrderDetailComponent } from './order-detail.component';

describe('OrderDetailComponent pickup actions', () => {
  const pickedUpOrder = {
    id: 'order-1',
    reference: 'ORD-1',
    fulfilmentMethod: 'pickup',
    rawStatus: 'PICKED_UP',
    hasOpenDispute: false,
    items: [],
    currency: 'NGN',
    date: '2026-07-15T10:00:00Z',
    total: 1000,
    status: 'Picked Up',
  } satisfies Order;

  function create(disputesResult: Observable<OrderDispute[]>) {
    const orderService = {
      getOrderById: vi.fn().mockReturnValue(of(pickedUpOrder)),
      getOrderDisputes: vi.fn().mockReturnValue(disputesResult),
      selectOrder: vi.fn(),
    };
    TestBed.configureTestingModule({
      imports: [OrderDetailComponent],
      providers: [
        provideRouter([]),
        { provide: OrderService, useValue: orderService },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'order-1' } } },
        },
        { provide: InvoiceService, useValue: { loading: () => false } },
        { provide: MessageService, useValue: { add: vi.fn() } },
      ],
    });
    TestBed.overrideComponent(OrderDetailComponent, { set: { template: '' } });
    const fixture = TestBed.createComponent(OrderDetailComponent);
    fixture.detectChanges();
    return { component: fixture.componentInstance, orderService };
  }

  it('force-refreshes the order and enables actions after dispute state loads', () => {
    const { component, orderService } = create(of([]));

    expect(orderService.getOrderById).toHaveBeenCalledWith('order-1', true);
    expect(component.canConfirmPickup()).toBe(true);
    expect(component.canOpenDispute()).toBe(true);
  });

  it('fails closed and exposes retry state when disputes cannot be loaded', () => {
    const { component } = create(throwError(() => new Error('offline')));

    expect(component.canConfirmPickup()).toBe(false);
    expect(component.canOpenDispute()).toBe(false);
    expect(component.disputesLoadError()).toContain('Actions remain disabled');
  });
});
