import { Observable } from 'rxjs';
import type { PaymentService } from '../../services/payment.service';

export interface UsdtPollOptions {
  intervalMs?: number;
  timeoutMs?: number;
  gatewayResponse?: Record<string, unknown>;
}

export interface UsdtPollResult {
  reference: string;
  response: unknown;
}

function extractErrorMessage(err: unknown): string {
  const httpErr = err as { error?: { message?: string | string[] } | string };
  const raw = httpErr?.error;
  if (typeof raw === 'string') return raw;
  const msg = raw?.message;
  if (Array.isArray(msg)) return msg[0] ?? '';
  if (typeof msg === 'string') return msg;
  return '';
}

/** HTTP 400 when deposit not yet detected — keep polling per integration spec. */
export function isUsdtPendingError(err: unknown): boolean {
  const message = extractErrorMessage(err).toLowerCase();
  return (
    message.includes('deposit not found') ||
    message.includes('not found yet') ||
    message.includes('wait a few minutes') ||
    message.includes('please wait')
  );
}

function isPaymentSuccess(response: unknown): boolean {
  if (!response || typeof response !== 'object') return true;
  const status = String((response as Record<string, unknown>)['status'] ?? '').toUpperCase();
  return !status || status === 'SUCCESS' || status === 'VERIFIED' || status === 'PAID';
}

export function pollUsdtPaymentVerification(
  paymentService: PaymentService,
  reference: string,
  options: UsdtPollOptions = {},
): Observable<UsdtPollResult> {
  const intervalMs = options.intervalMs ?? 20_000;
  const timeoutMs = options.timeoutMs ?? 30 * 60 * 1000;
  const gatewayResponse = options.gatewayResponse ?? {};
  const startedAt = Date.now();

  return new Observable<UsdtPollResult>((subscriber) => {
    let stopped = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const failTimeout = () => {
      subscriber.error(
        new Error(
          'We have not detected your deposit yet. Please contact support if you sent the correct amount, network, and memo.',
        ),
      );
    };

    const poll = () => {
      if (stopped) return;
      if (Date.now() - startedAt >= timeoutMs) {
        failTimeout();
        return;
      }

      paymentService.verifyPayment(reference, gatewayResponse).subscribe({
        next: (response) => {
          if (stopped) return;
          if (!isPaymentSuccess(response)) {
            subscriber.error(new Error('Payment verification did not succeed.'));
            return;
          }
          subscriber.next({ reference, response });
          subscriber.complete();
        },
        error: (err) => {
          if (stopped) return;
          if (isUsdtPendingError(err)) {
            timeoutId = setTimeout(poll, intervalMs);
            return;
          }
          subscriber.error(err);
        },
      });
    };

    poll();

    return () => {
      stopped = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  });
}
