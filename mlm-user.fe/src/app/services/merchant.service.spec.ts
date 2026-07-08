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
});
