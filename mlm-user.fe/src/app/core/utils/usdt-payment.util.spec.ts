import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { of, throwError } from 'rxjs';
import {
  isUsdtPendingError,
  pollUsdtPaymentVerification,
} from './usdt-payment.util';
import type { PaymentService } from '../../services/payment.service';

describe('usdt-payment.util', () => {
  describe('isUsdtPendingError', () => {
    it('returns true for deposit-not-found pending messages', () => {
      expect(
        isUsdtPendingError({ error: { message: 'Deposit not found yet. Please wait.' } }),
      ).toBe(true);
      expect(isUsdtPendingError({ error: { message: 'Please wait a few minutes' } })).toBe(true);
    });

    it('returns false for fatal errors', () => {
      expect(isUsdtPendingError({ error: { message: 'Invalid reference' } })).toBe(false);
    });
  });

  describe('pollUsdtPaymentVerification', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('completes on successful verify response', () => {
      const paymentService = {
        verifyPayment: vi.fn(() => of({ status: 'SUCCESS' })),
      } as unknown as PaymentService;

      const next = vi.fn();
      const complete = vi.fn();

      pollUsdtPaymentVerification(paymentService, 'ref-123', {
        intervalMs: 1000,
        timeoutMs: 60_000,
      }).subscribe({ next, complete });

      expect(paymentService.verifyPayment).toHaveBeenCalledWith('ref-123', {});
      expect(next).toHaveBeenCalledWith({ reference: 'ref-123', response: { status: 'SUCCESS' } });
      expect(complete).toHaveBeenCalled();
    });

    it('retries on pending 400 then succeeds', () => {
      const verifyPayment = vi
        .fn()
        .mockReturnValueOnce(
          throwError(() => ({ error: { message: 'Deposit not found yet' } })),
        )
        .mockReturnValueOnce(of({ status: 'SUCCESS' }));

      const paymentService = { verifyPayment } as unknown as PaymentService;
      const next = vi.fn();
      const complete = vi.fn();

      pollUsdtPaymentVerification(paymentService, 'ref-pending', {
        intervalMs: 1000,
        timeoutMs: 60_000,
      }).subscribe({ next, complete });

      expect(verifyPayment).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1000);

      expect(verifyPayment).toHaveBeenCalledTimes(2);
      expect(next).toHaveBeenCalled();
      expect(complete).toHaveBeenCalled();
    });

    it('passes gatewayResponse to verifyPayment when provided', () => {
      const paymentService = {
        verifyPayment: vi.fn(() => of({ status: 'SUCCESS' })),
      } as unknown as PaymentService;

      pollUsdtPaymentVerification(paymentService, 'ref-sim', {
        gatewayResponse: { simulateDeposit: true },
      }).subscribe();

      expect(paymentService.verifyPayment).toHaveBeenCalledWith('ref-sim', {
        simulateDeposit: true,
      });
    });
  });
});
