import { convertToParamMap } from '@angular/router';
import { describe, it, expect } from 'vitest';
import { resolvePaymentReference } from './payment-reference.util';

describe('resolvePaymentReference', () => {
  it('returns reference when present', () => {
    const params = convertToParamMap({ reference: 'ref-123' });
    expect(resolvePaymentReference(params)).toBe('ref-123');
  });

  it('falls back to trxref (Paystack)', () => {
    const params = convertToParamMap({ trxref: 'trx-456' });
    expect(resolvePaymentReference(params)).toBe('trx-456');
  });

  it('falls back to tx_ref (Flutterwave)', () => {
    const params = convertToParamMap({ tx_ref: 'flw-789' });
    expect(resolvePaymentReference(params)).toBe('flw-789');
  });

  it('returns null when no reference params exist', () => {
    const params = convertToParamMap({ status: 'successful' });
    expect(resolvePaymentReference(params)).toBeNull();
  });
});
