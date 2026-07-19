import { ParamMap } from '@angular/router';

/** Resolves payment reference from gateway callback query params (Paystack, Flutterwave, Korapay). */
export function resolvePaymentReference(params: ParamMap): string | null {
  return params.get('reference') ?? params.get('trxref') ?? params.get('tx_ref');
}

/** Query params to clear after successful gateway verification. */
export const GATEWAY_REFERENCE_QUERY_PARAMS = {
  reference: null,
  trxref: null,
  tx_ref: null,
} as const;
