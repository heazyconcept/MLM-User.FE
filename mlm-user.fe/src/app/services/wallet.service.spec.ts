import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { describe, beforeEach, it, expect, afterEach, vi } from 'vitest';
import { WalletService, type FundTransferRequest } from './wallet.service';
import { ApiService } from './api.service';
import { ModalService } from './modal.service';
import { environment } from '../../environments/environment';

describe('WalletService', () => {
  let service: WalletService;
  let httpMock: HttpTestingController;
  let modalService: ModalService;
  const baseUrl = environment.apiUrl;

  const fundTransferRequest: FundTransferRequest = {
    recipientUsername: 'janedoe',
    fromWalletType: 'CASH',
    toWalletType: 'VOUCHER',
    amount: 5000,
    currency: 'NGN',
    pin: '1234',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), WalletService, ApiService],
    });

    service = TestBed.inject(WalletService);
    httpMock = TestBed.inject(HttpTestingController);
    modalService = TestBed.inject(ModalService);
    vi.spyOn(modalService, 'open');
  });

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
  });

  function flushWalletRefresh(): void {
    const withdrawalsReq = httpMock.expectOne(
      (req) => req.url.includes('withdrawals') && req.method === 'GET',
    );
    withdrawalsReq.flush({ items: [] });

    const walletsReq = httpMock.expectOne((req) => req.url.includes('wallets') && req.method === 'GET');
    walletsReq.flush({
      cashWallet: { currency: 'NGN', balance: 7000, status: 'ACTIVE' },
      registrationWallet: { currency: 'NGN', balance: 1000, status: 'ACTIVE' },
      voucherWallet: { currency: 'NGN', balance: 0, status: 'ACTIVE' },
      autoshipWallet: { currency: 'NGN', balance: 0, status: 'ACTIVE' },
    });
  }

  it('should POST /wallets/fund-transfer with the request body', () => {
    service.fundTransfer(fundTransferRequest).subscribe((response) => {
      expect(response.transferId).toBe('transfer-123');
    });

    const req = httpMock.expectOne(`${baseUrl}/wallets/fund-transfer`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(fundTransferRequest);
    req.flush({ transferId: 'transfer-123' });

    flushWalletRefresh();

    expect(modalService.open).toHaveBeenCalledWith(
      'success',
      'Transfer Completed',
      'Transfer completed. Reference: transfer-123',
      '/wallet',
    );
  });

  it('should format insufficient balance JSON errors for fund transfer', () => {
    const insufficientMessage = JSON.stringify({
      error: 'Insufficient balance',
      fromWalletType: 'CASH',
      toWalletType: 'VOUCHER',
      currency: 'NGN',
      requestedDisplayAmount: 5000,
      requiredAmountBase: 5,
      availableBalanceBase: 2.5,
      availableDisplayAmount: 2500,
    });

    service.fundTransfer(fundTransferRequest).subscribe({
      next: () => expect.unreachable('should have failed'),
      error: (err) => {
        expect(err.isIncorrectPin).toBeFalsy();
        expect(err.friendlyMessage).toBe(
          'Insufficient balance. Available: ₦2,500.00 (requested: ₦5,000.00).',
        );
      },
    });

    const req = httpMock.expectOne(`${baseUrl}/wallets/fund-transfer`);
    req.flush(
      { statusCode: 400, message: insufficientMessage, error: 'Bad Request' },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(modalService.open).toHaveBeenCalledWith(
      'error',
      'Fund Transfer Failed',
      'Insufficient balance. Available: ₦2,500.00 (requested: ₦5,000.00).',
    );
  });

  it('should not open an error modal for incorrect transaction PIN', () => {
    service.fundTransfer(fundTransferRequest).subscribe({
      next: () => expect.unreachable('should have failed'),
      error: (err) => {
        expect(err.isIncorrectPin).toBe(true);
        expect(err.friendlyMessage).toBe('Incorrect transaction PIN.');
      },
    });

    const req = httpMock.expectOne(`${baseUrl}/wallets/fund-transfer`);
    req.flush(
      { statusCode: 400, message: 'Incorrect transaction PIN.', error: 'Bad Request' },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(modalService.open).not.toHaveBeenCalled();
  });

  it('should map impersonation blocked errors during fund transfer', () => {
    service.fundTransfer(fundTransferRequest).subscribe({
      next: () => expect.unreachable('should have failed'),
      error: (err) => {
        expect(err.friendlyMessage).toBe('Action disabled during impersonation.');
      },
    });

    const req = httpMock.expectOne(`${baseUrl}/wallets/fund-transfer`);
    req.flush(
      {
        statusCode: 403,
        error: 'IMPERSONATION_ACTION_BLOCKED',
        code: 'IMPERSONATION_ACTION_BLOCKED',
        message: 'Blocked',
      },
      { status: 403, statusText: 'Forbidden' },
    );

    expect(modalService.open).toHaveBeenCalledWith(
      'error',
      'Fund Transfer Failed',
      'Action disabled during impersonation.',
    );
  });

  it('should detect locked cash wallets from GET /wallets', () => {
    service.fetchWallets().subscribe();

    const withdrawalsReq = httpMock.expectOne(
      (req) => req.url.includes('withdrawals') && req.method === 'GET',
    );
    withdrawalsReq.flush({ items: [] });

    const walletsReq = httpMock.expectOne((req) => req.url.includes('wallets') && req.method === 'GET');
    walletsReq.flush({
      cashWallet: { currency: 'NGN', balance: 12000, status: 'LOCKED' },
      registrationWallet: { currency: 'NGN', balance: 5000, status: 'ACTIVE' },
      voucherWallet: { currency: 'NGN', balance: 0, status: 'ACTIVE' },
      autoshipWallet: { currency: 'NGN', balance: 0, status: 'ACTIVE' },
    });

    expect(service.isCashWalletLocked('NGN')).toBe(true);
  });
});
