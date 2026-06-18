import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { EarningsService } from './earnings.service';
import { ApiService } from './api.service';
import { environment } from '../../environments/environment';
import { describe, beforeEach, it, expect, afterEach } from 'vitest';

describe('EarningsService', () => {
  let service: EarningsService;
  let httpMock: HttpTestingController;
  const baseUrl = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        EarningsService,
        ApiService,
      ]
    });

    service = TestBed.inject(EarningsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('fetchEarningsCardHistory', () => {
    it('should map history items including metadata object if present', () => {
      const mockResponse = {
        cardKey: 'CDPA',
        unit: 'MONEY',
        currency: 'NGN',
        items: [
          {
            id: 'txn-1',
            date: '2026-06-18T00:05:00.860Z',
            status: 'POSTED',
            source: 'Community Daily Proceeds',
            sourceRef: 'CDA-REF-34F2C63F',
            value: 180,
            runningBalance: 834.9,
            metadata: {
              date: '2026-06-18',
              package: 'PLATINUM',
              cdpaPercent: 20,
              cdpaAmountDisplay: 180,
              pdpaAmountDisplay: 900
            }
          }
        ],
        nextCursor: 'next-page-id'
      };

      service.fetchEarningsCardHistory('CDPA').subscribe((response) => {
        expect(response.items.length).toBe(1);
        const item = response.items[0];
        expect(item.id).toBe('txn-1');
        expect(item.status).toBe('POSTED');
        expect(item.value).toBe(180);
        expect(item.runningBalance).toBe(834.9);
        expect(item.metadata).toEqual({
          date: '2026-06-18',
          package: 'PLATINUM',
          cdpaPercent: 20,
          cdpaAmountDisplay: 180,
          pdpaAmountDisplay: 900
        });
      });

      const req = httpMock.expectOne(`${baseUrl}/earnings/cards/CDPA/history`);
      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);
    });

    it('should map history items with downlinePackage metadata', () => {
      const mockResponse = {
        cardKey: 'CDPA',
        unit: 'MONEY',
        currency: 'NGN',
        items: [
          {
            id: 'txn-downline',
            date: '2026-06-17T16:01:49.613Z',
            status: 'POSTED',
            source: 'Community Daily Proceeds',
            sourceRef: 'CDA-REF-18CF94F6',
            value: 24,
            description: 'CDPA from downline',
            metadata: {
              date: '2026-06-17',
              package: 'PLATINUM',
              downlinePackage: 'GOLD',
              triggeredByUserId: 'fd782bc9-5331-451c-94f6-a00f69284639'
            }
          }
        ]
      };

      service.fetchEarningsCardHistory('CDPA').subscribe((response) => {
        expect(response.items.length).toBe(1);
        const item = response.items[0];
        expect(item.id).toBe('txn-downline');
        expect(item.description).toBe('CDPA from downline');
        expect(item.metadata).toEqual({
          date: '2026-06-17',
          package: 'PLATINUM',
          downlinePackage: 'GOLD',
          triggeredByUserId: 'fd782bc9-5331-451c-94f6-a00f69284639'
        });
      });

      const req = httpMock.expectOne(`${baseUrl}/earnings/cards/CDPA/history`);
      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);
    });

    it('should handle history items without metadata', () => {
      const mockResponse = {
        cardKey: 'CDPA',
        unit: 'MONEY',
        currency: 'NGN',
        items: [
          {
            id: 'txn-2',
            date: '2026-06-18T00:05:00.860Z',
            status: 'PENDING',
            source: 'Community Daily Proceeds',
            value: 100
          }
        ]
      };

      service.fetchEarningsCardHistory('CDPA').subscribe((response) => {
        expect(response.items.length).toBe(1);
        const item = response.items[0];
        expect(item.id).toBe('txn-2');
        expect(item.status).toBe('PENDING');
        expect(item.metadata).toBeUndefined();
      });

      const req = httpMock.expectOne(`${baseUrl}/earnings/cards/CDPA/history`);
      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);
    });
  });
});
