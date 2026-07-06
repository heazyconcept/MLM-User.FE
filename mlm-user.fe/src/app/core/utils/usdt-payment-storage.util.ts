import type { InitiatePaymentResponse } from '../../services/payment.service';

const USDT_SESSION_KEY = 'mlm_usdt_payment_session';

export interface UsdtPaymentSession extends InitiatePaymentResponse {
  flow?: string;
}

export function saveUsdtPaymentSession(session: UsdtPaymentSession): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(USDT_SESSION_KEY, JSON.stringify(session));
}

export function loadUsdtPaymentSession(): UsdtPaymentSession | null {
  if (typeof sessionStorage === 'undefined') return null;
  const raw = sessionStorage.getItem(USDT_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UsdtPaymentSession;
  } catch {
    return null;
  }
}

export function clearUsdtPaymentSession(): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(USDT_SESSION_KEY);
}
