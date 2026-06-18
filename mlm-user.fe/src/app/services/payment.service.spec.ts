import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { PaymentService } from './payment.service';
import { ApiService } from './api.service';
import { environment } from '../../environments/environment';
import { describe, beforeEach, it, expect, afterEach } from 'vitest';

describe('PaymentService', () => {
  let service: PaymentService;
  let httpMock: HttpTestingController;
  const baseUrl = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        PaymentService,
        ApiService,
      ]
    });

    service = TestBed.inject(PaymentService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('fetchUpgradeOptions', () => {
    it('should map upgraded API structure (eligibleUpgrades and upgradeAmount)', () => {
      const mockResponse = {
        currentPackage: 'NICKEL',
        currency: 'NGN',
        eligibleUpgrades: [
          {
            package: 'SILVER',
            upgradeAmount: 35000,
            benefits: { earningsRateIncrease: 0, newEarningsRate: 10 }
          },
          {
            package: 'GOLD',
            upgradeAmount: 130000
          }
        ]
      };

      service.fetchUpgradeOptions().subscribe((options) => {
        expect(options.length).toBe(2);
        
        expect(options[0]).toEqual({
          package: 'SILVER',
          price: 35000,
          currency: 'NGN',
          currentPackage: false,
          benefits: undefined // Object format is mapped to undefined to fall back to static benefits
        });

        expect(options[1]).toEqual({
          package: 'GOLD',
          price: 130000,
          currency: 'NGN',
          currentPackage: false,
          benefits: undefined
        });
      });

      const req = httpMock.expectOne(`${baseUrl}/users/me/upgrade-options`);
      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);
    });

    it('should map legacy API structure (options / packages list and price / amount)', () => {
      const mockResponse = {
        options: [
          {
            package: 'SILVER',
            price: 15000,
            currency: 'USD',
            currentPackage: false,
            benefits: ['Benefit 1', 'Benefit 2']
          }
        ]
      };

      service.fetchUpgradeOptions().subscribe((options) => {
        expect(options.length).toBe(1);
        expect(options[0]).toEqual({
          package: 'SILVER',
          price: 15000,
          currency: 'USD',
          currentPackage: false,
          benefits: ['Benefit 1', 'Benefit 2']
        });
      });

      const req = httpMock.expectOne(`${baseUrl}/users/me/upgrade-options`);
      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);
    });
  });
});
