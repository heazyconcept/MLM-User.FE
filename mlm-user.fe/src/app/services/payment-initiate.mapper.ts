import type { InitiatePaymentResponse, UsdtGatewayData, PaymentCurrency } from './payment.service';

function mapUsdtGatewayData(raw: unknown): UsdtGatewayData | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const data = raw as Record<string, unknown>;
  const depositAddress = String(data['depositAddress'] ?? data['deposit_address'] ?? '');
  const memo = String(data['memo'] ?? '');
  const network = String(data['network'] ?? '');
  if (!depositAddress || !memo || !network) return undefined;

  return {
    coin: 'USDT',
    network,
    depositAddress,
    memo,
    usdtAmount: Number(data['usdtAmount'] ?? data['usdt_amount'] ?? 0),
    displayAmount: Number(data['displayAmount'] ?? data['display_amount'] ?? 0),
    displayCurrency: (data['displayCurrency'] ?? data['display_currency'] ?? 'USD') as PaymentCurrency,
    instructions: String(data['instructions'] ?? ''),
    simulation: data['simulation'] === true,
  };
}

export function isUsdtSimulationMode(gd: UsdtGatewayData | undefined): boolean {
  return gd?.simulation === true;
}

export function mapInitiatePaymentResponse(res: Record<string, unknown>): InitiatePaymentResponse {
  const gatewayDataRaw = res['gatewayData'] ?? res['gateway_data'];
  const currency = res['currency'] as PaymentCurrency | undefined;

  return {
    paymentId: res['paymentId'] != null ? String(res['paymentId']) : undefined,
    reference: String(res['reference'] ?? res['ref'] ?? ''),
    amount: res['amount'] != null ? Number(res['amount']) : undefined,
    currency,
    authorizationUrl:
      (res['authorizationUrl'] as string | undefined) ??
      (res['authorization_url'] as string | undefined),
    gatewayUrl:
      (res['gatewayUrl'] as string | undefined) ?? (res['gateway_url'] as string | undefined),
    gatewayData: mapUsdtGatewayData(gatewayDataRaw),
  };
}

export function isUsdtInitiateResponse(res: InitiatePaymentResponse): boolean {
  return Boolean(res.gatewayData && !res.gatewayUrl);
}
