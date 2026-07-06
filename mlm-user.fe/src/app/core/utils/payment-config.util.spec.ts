import { describe, it, expect } from 'vitest';
import {
  getDefaultGatewayProvider,
  getEnabledGatewayProviderOptions,
  getMerchantCallbackUrl,
  getPaymentCallbackUrl,
  isPaymentProviderEnabled,
} from './payment-config.util';

describe('payment-config.util', () => {
  it('uses configured production callback URL', () => {
    expect(getPaymentCallbackUrl()).toBe(
      'https://dashboard.segulahglobal-herbal.com/auth/payment/callback',
    );
  });

  it('builds merchant callback from configured appUrl', () => {
    expect(getMerchantCallbackUrl('/merchant/apply')).toBe(
      'https://dashboard.segulahglobal-herbal.com/merchant/apply',
    );
    expect(getMerchantCallbackUrl('/merchant/profile')).toBe(
      'https://dashboard.segulahglobal-herbal.com/merchant/profile',
    );
  });

  it('reports provider flags from production config', () => {
    expect(isPaymentProviderEnabled('flutterwave')).toBe(true);
    expect(isPaymentProviderEnabled('paystack')).toBe(false);
    expect(isPaymentProviderEnabled('usdt')).toBe(true);
  });

  it('includes only USDT in USD gateway options when enabled', () => {
    const options = getEnabledGatewayProviderOptions('USD');
    expect(options.map((opt) => opt.value)).toEqual(['USDT']);
    expect(options.find((opt) => opt.value === 'USDT')?.label).toBe('USDT (Crypto)');
  });

  it('includes only Flutterwave in NGN gateway options when paystack is disabled', () => {
    const options = getEnabledGatewayProviderOptions('NGN');
    expect(options.map((opt) => opt.value)).toEqual(['FLUTTERWAVE']);
  });

  it('defaults NGN to Flutterwave and USD to USDT', () => {
    expect(getDefaultGatewayProvider('NGN')).toBe('FLUTTERWAVE');
    expect(getDefaultGatewayProvider('USD')).toBe('USDT');
  });
});
