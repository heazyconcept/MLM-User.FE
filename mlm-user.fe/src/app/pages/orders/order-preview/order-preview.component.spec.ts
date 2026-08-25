import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { GeographyService } from '../../../services/geography.service';
import { MerchantService } from '../../../services/merchant.service';
import { OrderService } from '../../../services/order.service';
import { OrderPreviewComponent } from './order-preview.component';

describe('OrderPreviewComponent pickup geography', () => {
  const fulfilmentOption = signal<'pickup' | 'delivery'>('pickup');
  const merchantService = {
    fetchPickupMerchantsForCart: vi.fn().mockReturnValue(
      of([
        {
          id: 'merchant-1',
          businessName: 'Lagos Hub',
          phoneNumber: '+2348012345678',
          address: '12 Pickup Road',
          serviceAreas: ['Lagos'],
          locations: [],
          locationsComplete: true,
          usingPrimaryAddressFallback: true,
          products: [
            {
              id: 'product-1',
              name: 'Wine',
              sku: 'W-1',
              stockQuantity: 1,
              inStock: true,
            },
          ],
          pickupAvailable: true,
        },
      ]),
    ),
    checkCheckoutAvailability: vi.fn().mockReturnValue(
      of({
        merchants: [
          {
            id: 'merchant-1',
            businessName: 'Lagos Hub',
            phoneNumber: '+2348012345678',
            address: '12 Pickup Road',
            serviceAreas: ['Lagos'],
            locations: [],
            locationsComplete: true,
            usingPrimaryAddressFallback: true,
            products: [
              {
                id: 'product-1',
                name: 'Wine',
                sku: 'W-1',
                stockQuantity: 2,
                inStock: true,
              },
            ],
            pickupAvailable: true,
          },
        ],
        selectedMerchant: {
          merchantId: 'merchant-1',
          canFulfillAll: true,
          missingItems: [],
        },
      }),
    ),
  };
  const geographyService = {
    error: signal<string | null>(null),
    fetchCountries: vi.fn().mockReturnValue(
      of([
        { code: 'NG', name: 'Nigeria' },
        { code: 'GH', name: 'Ghana' },
      ]),
    ),
    fetchSubdivisions: vi.fn().mockImplementation((countryCode: string) =>
      of(
        countryCode === 'NG'
          ? [{ code: 'LA', name: 'Lagos' }]
          : [{ code: 'AA', name: 'Greater Accra' }],
      ),
    ),
  };

  beforeEach(() => {
    fulfilmentOption.set('pickup');
    TestBed.configureTestingModule({
      imports: [OrderPreviewComponent],
      providers: [
        {
          provide: OrderService,
          useValue: {
            fulfilmentOption,
            setFulfilmentOption: (option: 'pickup' | 'delivery') =>
              fulfilmentOption.set(option),
          },
        },
        { provide: MerchantService, useValue: merchantService },
        { provide: GeographyService, useValue: geographyService },
      ],
    });
    TestBed.overrideComponent(OrderPreviewComponent, { set: { template: '' } });
  });

  function create() {
    const fixture = TestBed.createComponent(OrderPreviewComponent);
    fixture.componentRef.setInput('pendingOrderData', {
      mode: 'single',
      wallet: 'voucher',
      product: { id: 'product-1', name: 'Wine', price: 1000, pv: 10 },
      quantity: 2,
    });
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('forces pickup fulfilment on init', () => {
    create();
    expect(fulfilmentOption()).toBe('pickup');
  });

  it('emits canonical geography and pickup groups on confirm', () => {
    const component = create();
    const emitted = vi.fn();
    component.orderConfirmed.subscribe(emitted);
    component.onCountryChange('NG');
    component.onSubdivisionChange('LA');
    component.onLocationSelect('merchant-1');

    component.onConfirm();

    expect(emitted).toHaveBeenCalledWith(
      expect.objectContaining({
        countryCode: 'NG',
        subdivisionCode: 'LA',
        state: 'Lagos',
        groups: [
          expect.objectContaining({
            fulfilmentMode: 'PICKUP',
            selectedMerchantId: 'merchant-1',
          }),
        ],
      }),
    );
  });

  it('blocks confirm until a pickup merchant is selected', () => {
    const component = create();
    component.onCountryChange('NG');
    component.onSubdivisionChange('LA');

    expect(component.canConfirm()).toBe(false);
  });

  it('keeps partial-stock merchants selectable for split resolution', () => {
    const component = create();
    component.onCountryChange('NG');
    component.onSubdivisionChange('LA');

    expect(component.pickupLocations()[0]).toEqual(
      expect.objectContaining({
        stockState: 'partial',
        usingPrimaryAddressFallback: true,
      }),
    );
    expect(component.hasSelectablePickup()).toBe(true);
  });

  // Home delivery disabled — restore these when re-enabling delivery UI:
  // it('blocks home delivery outside Nigeria', () => {
  //   const component = create();
  //   component.setOption('delivery');
  //   component.onCountryChange('GH');
  //   component.onSubdivisionChange('AA');
  //   component.deliveryAddress.set('12 Complete Delivery Road');
  //   expect(component.deliveryAvailable()).toBe(false);
  //   expect(component.canConfirm()).toBe(false);
  // });
  //
  // it('emits canonical Nigerian geography for delivery', () => {
  //   const component = create();
  //   const emitted = vi.fn();
  //   component.orderConfirmed.subscribe(emitted);
  //   component.setOption('delivery');
  //   component.onCountryChange('NG');
  //   component.onSubdivisionChange('LA');
  //   component.deliveryAddress.set('12 Complete Delivery Road');
  //   component.onConfirm();
  //   expect(emitted).toHaveBeenCalledWith(
  //     expect.objectContaining({
  //       countryCode: 'NG',
  //       subdivisionCode: 'LA',
  //       state: 'Lagos',
  //     }),
  //   );
  // });
});
