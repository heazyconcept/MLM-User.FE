import { describe, it, expect } from 'vitest';
import {
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

  it('reports flutterwave as enabled in production config', () => {
    expect(isPaymentProviderEnabled('flutterwave')).toBe(true);
    expect(isPaymentProviderEnabled('paystack')).toBe(true);
    expect(isPaymentProviderEnabled('usdt')).toBe(false);
  });

  it('includes flutterwave in NGN gateway options when enabled', () => {
    const options = getEnabledGatewayProviderOptions('NGN');
    expect(options.map((opt) => opt.value)).toEqual(['PAYSTACK', 'FLUTTERWAVE']);
  });
});
