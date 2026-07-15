import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { describe, beforeEach, it, expect, afterEach } from 'vitest';
import { MerchantService } from './merchant.service';
import { ApiService } from './api.service';
import { UserService } from './user.service';
import { environment } from '../../environments/environment';

describe('MerchantService — category upgrade', () => {
  let service: MerchantService;
  let httpMock: HttpTestingController;
  const baseUrl = environment.apiUrl;

  const mockProfile = {
    id: 'merchant-1',
    userId: 'user-1',
    type: 'REGIONAL',
    status: 'ACTIVE',
    serviceAreas: ['Lagos'],
    merchantFeePaidAt: '2026-01-01T00:00:00Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        MerchantService,
        ApiService,
        {
          provide: UserService,
          useValue: {
            displayCurrency: () => 'NGN',
            markAsMerchant: () => undefined,
          },
        },
      ],
    });

    service = TestBed.inject(MerchantService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('fetchUpgradeOptions', () => {
    it('maps eligibleUpgrades with full target tier amounts', () => {
      const mockResponse = {
        currentType: 'REGIONAL',
        eligibleUpgrades: [
          {
            merchantType: 'NATIONAL',
            upgradeAmount: 3000000,
            registrationPV: 320,
            deliveryCommissionPct: 6,
            productCommissionPct: 4.5,
          },
          {
            merchantType: 'GLOBAL',
            upgradeAmount: 10000000,
            registrationPV: 1200,
            deliveryCommissionPct: 10,
            productCommissionPct: 7.5,
          },
        ],
      };

      service.fetchUpgradeOptions().subscribe((result) => {
        expect(result).toEqual({
          currentType: 'REGIONAL',
          eligibleUpgrades: [
            {
              merchantType: 'NATIONAL',
              upgradeAmount: 3000000,
              registrationPV: 320,
              deliveryCommissionPct: 6,
              productCommissionPct: 4.5,
            },
            {
              merchantType: 'GLOBAL',
              upgradeAmount: 10000000,
              registrationPV: 1200,
              deliveryCommissionPct: 10,
              productCommissionPct: 7.5,
            },
          ],
        });
      });

      const req = httpMock.expectOne(`${baseUrl}/merchants/me/upgrade-options`);
      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);
    });

    it('returns null and sets error on failure', () => {
      service.fetchUpgradeOptions().subscribe((result) => {
        expect(result).toBeNull();
        expect(service.error()).toBe('Merchant not active');
      });

      const req = httpMock.expectOne(`${baseUrl}/merchants/me/upgrade-options`);
      req.flush({ message: 'Merchant not active' }, { status: 400, statusText: 'Bad Request' });
    });
  });

  describe('initiateMerchantUpgrade', () => {
    it('posts initiate body and refreshes profile', () => {
      const body = {
        source: 'CASH_WALLET' as const,
        targetType: 'NATIONAL' as const,
      };
      const mockInitiateResponse = {
        paymentId: 'pay-1',
        reference: 'ref-1',
        amount: 3000000,
        currency: 'NGN',
      };

      service.initiateMerchantUpgrade(body).subscribe((result) => {
        expect(result).toEqual(mockInitiateResponse);
      });

      const initiateReq = httpMock.expectOne(`${baseUrl}/merchants/merchant-upgrade/initiate`);
      expect(initiateReq.request.method).toBe('POST');
      expect(initiateReq.request.body).toEqual(body);
      initiateReq.flush(mockInitiateResponse);

      const profileReq = httpMock.expectOne(`${baseUrl}/merchants/me`);
      expect(profileReq.request.method).toBe('GET');
      profileReq.flush({ ...mockProfile, type: 'NATIONAL' });
    });
  });

  describe('verifyMerchantUpgrade', () => {
    it('posts reference and refreshes profile on success', () => {
      const mockVerifyResponse = {
        success: true,
        payment: {
          id: 'pay-1',
          reference: 'ref-paystack',
          amount: 3000000,
          currency: 'NGN',
          type: 'MERCHANT_UPGRADE',
          status: 'SUCCESS',
        },
        message: 'Merchant category upgraded successfully.',
      };

      service.verifyMerchantUpgrade({ reference: 'ref-paystack' }).subscribe((result) => {
        expect(result).toEqual(mockVerifyResponse);
      });

      const verifyReq = httpMock.expectOne(`${baseUrl}/merchants/merchant-upgrade/verify`);
      expect(verifyReq.request.method).toBe('POST');
      expect(verifyReq.request.body).toEqual({ reference: 'ref-paystack' });
      verifyReq.flush(mockVerifyResponse);

      const profileReq = httpMock.expectOne(`${baseUrl}/merchants/me`);
      expect(profileReq.request.method).toBe('GET');
      profileReq.flush({ ...mockProfile, type: 'NATIONAL' });
    });
  });

  describe('canReapplyAsMerchant', () => {
    it('is true when merchant is SUSPENDED and fee was refunded', () => {
      service.fetchProfile();

      const req = httpMock.expectOne(`${baseUrl}/merchants/me`);
      req.flush({
        id: 'merchant-1',
        userId: 'user-1',
        type: 'REGIONAL',
        status: 'SUSPENDED',
        serviceAreas: ['Lagos'],
        merchantFeePaidAt: null,
      });

      expect(service.canReapplyAsMerchant()).toBe(true);
      expect(service.needsPayment()).toBe(true);
    });

    it('is false for SUSPENDED merchants who already paid the fee', () => {
      service.fetchProfile();

      const req = httpMock.expectOne(`${baseUrl}/merchants/me`);
      req.flush({
        id: 'merchant-1',
        userId: 'user-1',
        type: 'REGIONAL',
        status: 'SUSPENDED',
        serviceAreas: ['Lagos'],
        merchantFeePaidAt: '2026-01-01T00:00:00Z',
      });

      expect(service.canReapplyAsMerchant()).toBe(false);
      expect(service.needsPayment()).toBe(false);
    });

    it('is false for unpaid DRAFT applications', () => {
      service.fetchProfile();

      const req = httpMock.expectOne(`${baseUrl}/merchants/me`);
      req.flush({
        id: 'merchant-1',
        userId: 'user-1',
        type: 'REGIONAL',
        status: 'DRAFT',
        serviceAreas: ['Lagos'],
        merchantFeePaidAt: null,
      });

      expect(service.canReapplyAsMerchant()).toBe(false);
      expect(service.needsPayment()).toBe(true);
    });
  });

  describe('fetchProfile$', () => {
    it('shares one in-flight profile request across concurrent callers', () => {
      const results: Array<unknown> = [];

      service.fetchProfile$().subscribe((result) => results.push(result));
      service.fetchProfile$().subscribe((result) => results.push(result));

      const req = httpMock.expectOne(`${baseUrl}/merchants/me`);
      expect(req.request.method).toBe('GET');
      httpMock.expectNone(`${baseUrl}/merchants/me`);

      req.flush(mockProfile);

      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({
        id: 'merchant-1',
        type: 'REGIONAL',
        serviceAreas: ['Lagos'],
      });
      expect(results[0]).toEqual(results[1]);
    });

    it('maps locations and locationsComplete from profile response', () => {
      let mapped: Record<string, unknown> | null | undefined;

      service.fetchProfile$().subscribe((result) => {
        mapped = result as Record<string, unknown> | null;
      });

      const req = httpMock.expectOne(`${baseUrl}/merchants/me`);
      req.flush({
        id: 'merchant-1',
        userId: 'user-1',
        type: 'NATIONAL',
        status: 'DRAFT',
        home_country_code: 'NG',
        phoneNumber: '+2348012345678',
        locations_complete: false,
        locations: [
          {
            id: 'loc-1',
            country_code: 'NG',
            subdivision_code: 'LA',
            country: 'Nigeria',
            state: 'Lagos',
            address: '12 Market Road',
            phone_number: '+2348012345678',
            is_primary: true,
            details_complete: true,
          },
          {
            id: 'loc-2',
            country: 'Nigeria',
            state: 'Abuja',
            address: '',
            phone_number: '',
            is_primary: false,
            details_complete: false,
          },
        ],
        merchantFeePaidAt: null,
      });

      expect(mapped).toMatchObject({
        id: 'merchant-1',
        type: 'NATIONAL',
        homeCountryCode: 'NG',
        locationsComplete: false,
        serviceAreas: ['Lagos', 'Abuja'],
        locations: [
          {
            id: 'loc-1',
            countryCode: 'NG',
            subdivisionCode: 'LA',
            country: 'Nigeria',
            state: 'Lagos',
            address: '12 Market Road',
            phoneNumber: '+2348012345678',
            isPrimary: true,
            detailsComplete: true,
          },
          {
            id: 'loc-2',
            country: 'Nigeria',
            state: 'Abuja',
            address: '',
            phoneNumber: '',
            isPrimary: false,
            detailsComplete: false,
          },
        ],
      });
    });
  });

  describe('apply', () => {
    it('posts REGIONAL apply with exactly one primary Nigeria location', () => {
      const locations = [
        {
          country: 'Nigeria',
          state: 'Lagos',
          address: '12 Market Road, Ikeja',
          phoneNumber: '+2348012345678',
          isPrimary: true,
        },
      ];

      service
        .apply('REGIONAL', '+2348012345678', 'NG', locations, 'Herb World Ventures')
        .subscribe((profile) => {
          expect(profile).toMatchObject({
            id: 'merchant-1',
            type: 'REGIONAL',
            locations: [
              expect.objectContaining({
                state: 'Lagos',
                isPrimary: true,
              }),
            ],
          });
        });

      const req = httpMock.expectOne(`${baseUrl}/merchants/apply`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        phoneNumber: '+2348012345678',
        type: 'REGIONAL',
        homeCountryCode: 'NG',
        locations,
        businessName: 'Herb World Ventures',
      });
      expect(req.request.body.serviceAreas).toBeUndefined();
      expect(req.request.body.address).toBeUndefined();
      req.flush({
        id: 'merchant-1',
        userId: 'user-1',
        type: 'REGIONAL',
        status: 'DRAFT',
        phoneNumber: '+2348012345678',
        businessName: 'Herb World Ventures',
        locations,
        locationsComplete: true,
        createdAt: '2026-07-14T00:00:00Z',
      });
    });

    it('posts NATIONAL apply with multiple distinct state locations', () => {
      const locations = [
        {
          country: 'Nigeria',
          state: 'Lagos',
          address: '12 Market Road',
          phoneNumber: '+2348012345678',
          isPrimary: true,
        },
        {
          country: 'Nigeria',
          state: 'Abuja',
          address: '15 Maitama Avenue',
          phoneNumber: '+2348012345678',
          isPrimary: false,
        },
      ];

      service.apply('NATIONAL', '+2348012345678', 'NG', locations, 'National Mart').subscribe();

      const req = httpMock.expectOne(`${baseUrl}/merchants/apply`);
      expect(req.request.body.type).toBe('NATIONAL');
      expect(req.request.body.businessName).toBe('National Mart');
      expect(req.request.body.locations).toEqual(locations);
      expect(new Set(locations.map((l) => l.state)).size).toBe(2);
      req.flush({
        id: 'merchant-1',
        userId: 'user-1',
        type: 'NATIONAL',
        status: 'DRAFT',
        locations,
        locationsComplete: true,
        createdAt: '2026-07-14T00:00:00Z',
      });
    });

    it('posts GLOBAL apply with address and phone per location', () => {
      const locations = [
        {
          country: 'Nigeria',
          state: 'Lagos',
          address: 'HQ Lagos',
          phoneNumber: '+2348012345678',
          isPrimary: true,
        },
        {
          country: 'Ghana',
          state: 'Accra',
          address: 'Branch Accra',
          phoneNumber: '+233201234567',
          isPrimary: false,
        },
      ];

      service.apply('GLOBAL', '+2348012345678', 'NG', locations, 'Global Mart').subscribe();

      const req = httpMock.expectOne(`${baseUrl}/merchants/apply`);
      expect(req.request.body.type).toBe('GLOBAL');
      expect(req.request.body.businessName).toBe('Global Mart');
      expect(
        req.request.body.locations.every((l: { address: string; phoneNumber: string }) =>
          Boolean(l.address && l.phoneNumber),
        ),
      ).toBe(true);
      req.flush({
        id: 'merchant-1',
        userId: 'user-1',
        type: 'GLOBAL',
        status: 'DRAFT',
        locations,
        locationsComplete: true,
        createdAt: '2026-07-14T00:00:00Z',
      });
    });
  });

  describe('checkout merchant discovery', () => {
    it('uses canonical geography and maps matched-location metadata', () => {
      let result: unknown;
      service
        .fetchAvailableMerchantsForPickup({
          countryCode: 'NG',
          subdivisionCode: 'LA',
          state: 'Lagos',
          productId: 'product-1',
          quantity: 2,
        })
        .subscribe((merchants) => (result = merchants));

      const req = httpMock.expectOne((request) => {
        return (
          request.url === `${baseUrl}/merchants/available` &&
          request.params.get('countryCode') === 'NG' &&
          request.params.get('subdivisionCode') === 'LA' &&
          request.params.get('state') === 'Lagos' &&
          request.params.get('productId') === 'product-1' &&
          request.params.get('quantity') === '2'
        );
      });
      expect(req.request.method).toBe('GET');
      req.flush({
        merchants: [
          {
            id: 'merchant-1',
            businessName: 'Lagos Hub',
            phoneNumber: '+2348012345678',
            address: '12 Pickup Road',
            serviceAreas: ['Lagos'],
            locationsComplete: false,
            usingPrimaryAddressFallback: true,
            locations: [
              {
                id: 'location-1',
                countryCode: 'NG',
                subdivisionCode: 'LA',
                country: 'Nigeria',
                state: 'Lagos',
                address: '',
                phoneNumber: '',
                isPrimary: false,
                detailsComplete: false,
              },
            ],
            products: [
              {
                id: 'product-1',
                name: 'Wine',
                sku: 'W-1',
                stockQuantity: 5,
                inStock: true,
              },
            ],
            requestedProductInStock: true,
            pickupAvailable: true,
          },
        ],
      });

      expect(result).toEqual([
        expect.objectContaining({
          id: 'merchant-1',
          address: '12 Pickup Road',
          locationsComplete: false,
          usingPrimaryAddressFallback: true,
          locations: [
            expect.objectContaining({
              countryCode: 'NG',
              subdivisionCode: 'LA',
              state: 'Lagos',
            }),
          ],
        }),
      ]);
    });

    it('posts canonical geography when checking whole-cart availability', () => {
      service
        .checkCheckoutAvailability({
          countryCode: 'NG',
          subdivisionCode: 'LA',
          state: 'Lagos',
          items: [{ productId: 'product-1', quantity: 2 }],
          selectedMerchantId: 'merchant-1',
        })
        .subscribe();

      const req = httpMock.expectOne(`${baseUrl}/merchants/checkout/availability`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        countryCode: 'NG',
        subdivisionCode: 'LA',
        state: 'Lagos',
        items: [{ productId: 'product-1', quantity: 2 }],
        selectedMerchantId: 'merchant-1',
      });
      req.flush({ merchants: [], selectedMerchant: null });
    });

    it('propagates pickup discovery errors instead of returning an empty list', () => {
      let status: number | undefined;
      service
        .fetchAvailableMerchantsForPickup({
          countryCode: 'NG',
          subdivisionCode: 'LA',
          state: 'Lagos',
        })
        .subscribe({ error: (error) => (status = error.status) });

      httpMock
        .expectOne((request) => request.url === `${baseUrl}/merchants/available`)
        .flush({ message: 'Unavailable' }, { status: 503, statusText: 'Unavailable' });

      expect(status).toBe(503);
    });
  });
});

describe('MerchantService — inventory adjustment disputes', () => {
  it('resolveAdjustmentType returns INCREASE when requested >= authorized', () => {
    expect(MerchantService.resolveAdjustmentType(10, 12)).toBe('INCREASE');
    expect(MerchantService.resolveAdjustmentType(10, 10)).toBe('INCREASE');
  });

  it('resolveAdjustmentType returns DECREASE when requested < authorized', () => {
    expect(MerchantService.resolveAdjustmentType(10, 7)).toBe('DECREASE');
  });

  it('inventoryAdjustmentStatusLabel maps known statuses', () => {
    expect(MerchantService.inventoryAdjustmentStatusLabel('OPEN')).toBe('Waiting for review');
    expect(MerchantService.inventoryAdjustmentStatusLabel('ADMIN_APPROVED')).toBe('Approved');
  });
});

describe('MerchantService — dashboard summary', () => {
  let service: MerchantService;
  let httpMock: HttpTestingController;
  const baseUrl = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        MerchantService,
        ApiService,
        {
          provide: UserService,
          useValue: {
            displayCurrency: () => 'NGN',
            markAsMerchant: () => undefined,
          },
        },
      ],
    });

    service = TestBed.inject(MerchantService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('maps dashboard summary response', () => {
    const mockResponse = {
      currency: 'NGN',
      sales: {
        totalSales: 10000,
        salesChangePct: 12,
        trend: {
          period: '7d',
          points: [{ date: '2026-07-02', amount: 1200 }],
          changePctVsPreviousPeriod: 15,
        },
        monthlyOverview: [{ month: '2026-01', label: 'Jan', amount: 5000 }],
      },
      orders: { pendingFulfillments: 3 },
      inventory: {
        totalProducts: 5,
        totalStockQuantity: 250,
        lowStockCount: 1,
        outOfStockCount: 0,
        lowOrOutCount: 1,
        byCategory: [
          {
            categoryId: 'health',
            categoryName: 'Health',
            productCount: 3,
            totalStockQuantity: 150,
          },
        ],
      },
      earnings: {
        totalEarnings: 7141.6,
        availableEarnings: 5000,
        pendingEarnings: 2141.6,
        byType: {
          personalProduct: 1000,
          directReferralProduct: 2000,
          communityProduct: 500,
          deliveryBonus: 3641.6,
        },
      },
      allocations: { actionableCount: 2 },
      recentActivity: [
        {
          id: 'act-1',
          type: 'ORDER_RECEIVED',
          title: 'New Order',
          description: 'Order 940d41a4…',
          amount: 40000,
          currency: 'NGN',
          occurredAt: '2026-06-24T15:31:40.046Z',
        },
      ],
    };

    service.fetchDashboardSummary$().subscribe((result) => {
      expect(result).toEqual(mockResponse);
      expect(service.dashboardSummary()).toEqual(mockResponse);
      expect(service.dashboardSummary()?.inventory.totalStockQuantity).toBe(250);
      expect(service.dashboardSummary()?.inventory.byCategory?.[0].categoryName).toBe('Health');
    });

    const req = httpMock.expectOne(`${baseUrl}/merchants/dashboard/summary`);
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });
});

describe('MerchantService — stock handover', () => {
  let service: MerchantService;
  let httpMock: HttpTestingController;
  const baseUrl = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        MerchantService,
        ApiService,
        {
          provide: UserService,
          useValue: {
            displayCurrency: () => 'NGN',
            markAsMerchant: () => undefined,
          },
        },
      ],
    });

    service = TestBed.inject(MerchantService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('maps handover fields on allocation profile fetch', () => {
    service.fetchAllocations();

    const req = httpMock.expectOne(`${baseUrl}/merchants/me/allocations`);
    req.flush([
      {
        id: 'alloc-1',
        productId: 'prod-1',
        productName: 'Wine',
        quantity: 10,
        status: 'PENDING',
        handover_status: 'ADMIN_APPROVED',
        source_merchant_id: 'supplier-1',
        source_merchant: {
          id: 'supplier-1',
          businessName: 'National Hub',
          type: 'NATIONAL',
          phone_number: '+2348011111111',
          address: '12 Market Road',
        },
        supplier_approved_at: '2026-07-01T10:00:00Z',
        admin_approved_at: '2026-07-02T10:00:00Z',
      },
    ]);

    const alloc = service.allocations()[0];
    expect(alloc.handoverStatus).toBe('ADMIN_APPROVED');
    expect(alloc.sourceMerchantId).toBe('supplier-1');
    expect(alloc.sourceMerchant).toMatchObject({
      id: 'supplier-1',
      businessName: 'National Hub',
      phoneNumber: '+2348011111111',
    });
    expect(MerchantService.canRequestHandover(alloc)).toBe(false);
    expect(MerchantService.isHandoverActive(alloc)).toBe(true);
  });

  it('maps nested handover data returned by receiver allocations', () => {
    service.fetchAllocations();

    const req = httpMock.expectOne(`${baseUrl}/merchants/me/allocations`);
    req.flush([
      {
        id: 'alloc-1',
        productId: 'prod-1',
        productName: 'Wine',
        quantity: 10,
        status: 'PENDING',
        handover: {
          status: 'READY_FOR_PICKUP',
          sourceMerchantId: 'supplier-1',
          sourceMerchant: {
            id: 'supplier-1',
            businessName: 'National Hub',
            phoneNumber: '+2348011111111',
            address: '12 Market Road',
          },
          supplierApprovedAt: '2026-07-01T10:00:00Z',
          adminApprovedAt: '2026-07-02T10:00:00Z',
          readyAt: '2026-07-03T10:00:00Z',
        },
      },
    ]);

    const alloc = service.allocations()[0];
    expect(alloc.handoverStatus).toBe('READY_FOR_PICKUP');
    expect(alloc.sourceMerchantId).toBe('supplier-1');
    expect(alloc.sourceMerchant?.businessName).toBe('National Hub');
    expect(alloc.handoverReadyAt).toBe('2026-07-03T10:00:00Z');
    expect(MerchantService.canRequestHandover(alloc)).toBe(false);
    expect(MerchantService.canConfirmHandoverReceipt(alloc)).toBe(true);
  });

  it('posts handover request with supplierMerchantId', () => {
    service.requestHandover('alloc-1', 'supplier-1').subscribe((res) => {
      expect(res?.handoverStatus).toBe('REQUESTED');
    });

    const req = httpMock.expectOne(`${baseUrl}/merchants/me/allocations/alloc-1/handover-request`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ supplierMerchantId: 'supplier-1' });
    req.flush({
      id: 'alloc-1',
      productId: 'prod-1',
      productName: 'Wine',
      quantity: 10,
      status: 'PENDING',
      handoverStatus: 'REQUESTED',
      sourceMerchantId: 'supplier-1',
    });

    const refresh = httpMock.expectOne(`${baseUrl}/merchants/me/allocations`);
    refresh.flush([]);
  });

  it('loads eligible suppliers', () => {
    service.fetchEligibleHandoverSuppliers('alloc-1').subscribe((suppliers) => {
      expect(suppliers).toHaveLength(1);
      expect(suppliers[0]).toMatchObject({
        id: 'supplier-1',
        businessName: 'National Hub',
        stockQuantity: 50,
      });
    });

    const req = httpMock.expectOne(
      `${baseUrl}/merchants/me/allocations/alloc-1/eligible-suppliers`,
    );
    expect(req.request.method).toBe('GET');
    req.flush({
      suppliers: [
        {
          id: 'supplier-1',
          businessName: 'National Hub',
          type: 'NATIONAL',
          stockQuantity: 50,
        },
      ],
    });
  });

  it('supplier approve / mark-ready / confirm receipt hit correct endpoints', () => {
    service.approveHandoverRequest('alloc-1').subscribe();
    const approveReq = httpMock.expectOne(
      `${baseUrl}/merchants/me/handover-requests/alloc-1/approve`,
    );
    expect(approveReq.request.method).toBe('POST');
    approveReq.flush({ id: 'alloc-1', status: 'PENDING', handoverStatus: 'SUPPLIER_APPROVED' });
    httpMock.expectOne(`${baseUrl}/merchants/me/handover-requests`).flush([]);

    service.markHandoverReady('alloc-1').subscribe();
    const readyReq = httpMock.expectOne(
      `${baseUrl}/merchants/me/handover-requests/alloc-1/mark-ready`,
    );
    expect(readyReq.request.method).toBe('POST');
    readyReq.flush({ id: 'alloc-1', status: 'PENDING', handoverStatus: 'READY_FOR_PICKUP' });
    httpMock.expectOne(`${baseUrl}/merchants/me/handover-requests`).flush([]);
    httpMock.expectOne(`${baseUrl}/merchants/inventory`).flush([]);

    service.confirmHandoverReceipt('alloc-1').subscribe((res) => {
      expect(res?.handoverStatus).toBe('COMPLETED');
    });
    const confirmReq = httpMock.expectOne(
      `${baseUrl}/merchants/me/allocations/alloc-1/confirm-handover-receipt`,
    );
    expect(confirmReq.request.method).toBe('POST');
    confirmReq.flush({
      id: 'alloc-1',
      status: 'RECEIVED',
      handoverStatus: 'COMPLETED',
      quantity: 10,
      productId: 'prod-1',
      productName: 'Wine',
    });
    httpMock.expectOne(`${baseUrl}/merchants/me/allocations`).flush([]);
    httpMock.expectOne(`${baseUrl}/merchants/inventory`).flush([]);
  });

  it('helper flags for request and confirm', () => {
    expect(
      MerchantService.canRequestHandover({
        id: 'a',
        productId: 'p',
        productName: 'Wine',
        quantity: 1,
        status: 'PENDING',
        quantityReceived: null,
        dispatchedAt: null,
        inTransitAt: null,
        deliveredAt: null,
        receivedAt: null,
        trackingReference: null,
        parentAllocationId: null,
        dispute: null,
        handoverStatus: 'NONE',
        sourceMerchantId: null,
        sourceMerchant: null,
        receiverMerchant: null,
        supplierApprovedAt: null,
        adminApprovedAt: null,
        handoverReadyAt: null,
        handoverRejectedAt: null,
        handoverRejectedBy: null,
        handoverRejectReason: null,
      }),
    ).toBe(true);

    expect(
      MerchantService.canConfirmHandoverReceipt({
        id: 'a',
        productId: 'p',
        productName: 'Wine',
        quantity: 1,
        status: 'PENDING',
        quantityReceived: null,
        dispatchedAt: null,
        inTransitAt: null,
        deliveredAt: null,
        receivedAt: null,
        trackingReference: null,
        parentAllocationId: null,
        dispute: null,
        handoverStatus: 'READY_FOR_PICKUP',
        sourceMerchantId: 's',
        sourceMerchant: null,
        receiverMerchant: null,
        supplierApprovedAt: null,
        adminApprovedAt: null,
        handoverReadyAt: null,
        handoverRejectedAt: null,
        handoverRejectedBy: null,
        handoverRejectReason: null,
      }),
    ).toBe(true);
  });
});
