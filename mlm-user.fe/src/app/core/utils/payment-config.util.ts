import { environment } from '../../../environments/environment';
import type { PaymentGatewayProvider } from '../../services/payment.service';

const PAYMENT_CALLBACK_PATH = '/auth/payment/callback';

const VALID_CALLBACK_URL = /^https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

/** Payment callback URL for gateway redirects (Paystack, Flutterwave). */
export function getPaymentCallbackUrl(): string | undefined {
  const configured = environment.payments?.callbackUrl?.trim();
  if (configured && VALID_CALLBACK_URL.test(configured)) {
    return configured;
  }
  if (typeof window === 'undefined') return undefined;
  const runtime = `${window.location.origin}${PAYMENT_CALLBACK_PATH}`;
  return VALID_CALLBACK_URL.test(runtime) ? runtime : undefined;
}

/** Merchant gateway return URL (fee apply or category upgrade). */
export function getMerchantCallbackUrl(
  path: '/merchant/apply' | '/merchant/profile',
): string | undefined {
  const appUrl = environment.payments?.appUrl?.replace(/\/$/, '');
  if (appUrl) {
    return `${appUrl}${path}`;
  }
  if (typeof window === 'undefined') return undefined;
  return `${window.location.origin}${path}`;
}

export function isPaymentProviderEnabled(
  provider: Lowercase<PaymentGatewayProvider>,
): boolean {
  return environment.payments?.providers?.[provider] ?? true;
}

export const GATEWAY_PROVIDER_OPTIONS: {
  value: PaymentGatewayProvider;
  label: string;
  configKey: Lowercase<PaymentGatewayProvider>;
}[] = [
  { value: 'PAYSTACK', label: 'Paystack (Card, Bank Transfer)', configKey: 'paystack' },
  { value: 'FLUTTERWAVE', label: 'Flutterwave (Card, Mobile Money)', configKey: 'flutterwave' },
  { value: 'USDT', label: 'USDT (Crypto)', configKey: 'usdt' },
];

export function getEnabledGatewayProviderOptions(
  currency: 'NGN' | 'USD' = 'NGN',
): { value: PaymentGatewayProvider; label: string }[] {
  const enabled = GATEWAY_PROVIDER_OPTIONS.filter((opt) =>
    isPaymentProviderEnabled(opt.configKey),
  );

  if (currency === 'USD') {
    return enabled.filter((opt) => opt.value === 'USDT' || opt.value === 'PAYSTACK');
  }

  return enabled.filter((opt) => opt.value !== 'USDT');
}
