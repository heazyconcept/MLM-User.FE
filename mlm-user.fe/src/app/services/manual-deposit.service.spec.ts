import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { describe, beforeEach, it, expect, afterEach } from 'vitest';
import { environment } from '../../environments/environment';
import { ApiService } from './api.service';
import {
  ManualDepositService,
  hasPendingDeposit,
  type ManualDeposit,
} from './manual-deposit.service';

describe('ManualDepositService', () => {
  let service: ManualDepositService;
  let httpMock: HttpTestingController;
  const baseUrl = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ManualDepositService,
        ApiService,
      ],
    });

    service = TestBed.inject(ManualDepositService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('hasPendingDeposit', () => {
    const items: ManualDeposit[] = [
      {
        id: '1',
        userId: 'u1',
        walletType: 'REGISTRATION',
        amount: 1000,
        currency: 'NGN',
        depositorName: 'Jane',
        status: 'PENDING',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: '2',
        userId: 'u1',
        walletType: 'VOUCHER',
        amount: 500,
        currency: 'NGN',
        depositorName: 'Jane',
        status: 'APPROVED',
        createdAt: '',
        updatedAt: '',
      },
    ];

    it('returns true when a pending deposit exists for the wallet type', () => {
      expect(hasPendingDeposit(items, 'REGISTRATION')).toBe(true);
      expect(hasPendingDeposit(items, 'VOUCHER')).toBe(false);
    });
  });

  describe('listDeposits', () => {
    it('should map paginated deposit list', () => {
      const mockResponse = {
        items: [
          {
            id: 'dep-1',
            userId: 'user-1',
            walletType: 'VOUCHER',
            amount: 50000,
            currency: 'NGN',
            depositorName: 'Jane Doe',
            evidenceUrl: 'https://example.com/evidence.png',
            status: 'PENDING',
            rejectionReason: null,
            paymentId: null,
            createdAt: '2026-07-09T08:00:00.000Z',
            updatedAt: '2026-07-09T08:00:00.000Z',
            reviewedAt: null,
          },
        ],
        total: 1,
        limit: 20,
        offset: 0,
      };

      service.listDeposits(20, 0).subscribe((result) => {
        expect(result.total).toBe(1);
        expect(result.items.length).toBe(1);
        expect(result.items[0]).toEqual({
          id: 'dep-1',
          userId: 'user-1',
          walletType: 'VOUCHER',
          amount: 50000,
          currency: 'NGN',
          depositorName: 'Jane Doe',
          evidenceUrl: 'https://example.com/evidence.png',
          status: 'PENDING',
          rejectionReason: null,
          paymentId: null,
          createdAt: '2026-07-09T08:00:00.000Z',
          updatedAt: '2026-07-09T08:00:00.000Z',
          reviewedAt: null,
        });
      });

      const req = httpMock.expectOne(
        (r) => r.url === `${baseUrl}/payments/manual-deposit` && r.method === 'GET',
      );
      expect(req.request.params.get('limit')).toBe('20');
      expect(req.request.params.get('offset')).toBe('0');
      req.flush(mockResponse);
    });
  });

  describe('submitDeposit', () => {
    it('should POST multipart form with required fields', () => {
      const file = new File(['receipt'], 'receipt.png', { type: 'image/png' });

      service
        .submitDeposit('REGISTRATION', 25000, 'Jane Doe', file)
        .subscribe((deposit) => {
          expect(deposit.walletType).toBe('REGISTRATION');
          expect(deposit.amount).toBe(25000);
          expect(deposit.status).toBe('PENDING');
        });

      const req = httpMock.expectOne(`${baseUrl}/payments/manual-deposit`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toBeInstanceOf(FormData);

      const formData = req.request.body as FormData;
      expect(formData.get('walletType')).toBe('REGISTRATION');
      expect(formData.get('amount')).toBe('25000');
      expect(formData.get('depositorName')).toBe('Jane Doe');
      expect(formData.get('evidence')).toBeTruthy();

      req.flush({
        id: 'dep-2',
        userId: 'user-1',
        walletType: 'REGISTRATION',
        amount: 25000,
        currency: 'NGN',
        depositorName: 'Jane Doe',
        status: 'PENDING',
        createdAt: '2026-07-09T08:00:00.000Z',
        updatedAt: '2026-07-09T08:00:00.000Z',
      });
    });
  });
});
