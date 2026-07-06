import { describe, it, expect } from 'vitest';
import { isUsdtInitiateResponse, isUsdtSimulationMode, mapInitiatePaymentResponse } from './payment-initiate.mapper';

describe('payment-initiate.mapper', () => {
  it('maps gatewayData from snake_case API fields', () => {
    const mapped = mapInitiatePaymentResponse({
      paymentId: 'pay-1',
      reference: 'ref-usdt',
      amount: 100.5,
      currency: 'USD',
      gateway_data: {
        deposit_address: '0xabc',
        memo: 'ref-usdt',
        network: 'TRC20',
        usdt_amount: 100.5,
        display_amount: 100.5,
        display_currency: 'USD',
        instructions: 'Send exact amount',
      },
    });

    expect(mapped.gatewayData).toEqual({
      coin: 'USDT',
      network: 'TRC20',
      depositAddress: '0xabc',
      memo: 'ref-usdt',
      usdtAmount: 100.5,
      displayAmount: 100.5,
      displayCurrency: 'USD',
      instructions: 'Send exact amount',
      simulation: false,
    });
    expect(isUsdtInitiateResponse(mapped)).toBe(true);
  });

  it('isUsdtInitiateResponse is false when gatewayUrl is present', () => {
    const mapped = mapInitiatePaymentResponse({
      reference: 'ref-1',
      gatewayUrl: 'https://pay.example.com',
      gatewayData: {
        depositAddress: '0xabc',
        memo: 'ref-1',
        network: 'TRC20',
        usdtAmount: 10,
        displayAmount: 10,
        displayCurrency: 'USD',
        instructions: '',
      },
    });

    expect(isUsdtInitiateResponse(mapped)).toBe(false);
  });

  it('maps simulation flag from gatewayData', () => {
    const mapped = mapInitiatePaymentResponse({
      reference: 'ref-sim',
      currency: 'USD',
      gatewayData: {
        depositAddress: '0xsim',
        memo: 'ref-sim',
        network: 'TRC20',
        usdtAmount: 50,
        displayAmount: 50,
        displayCurrency: 'USD',
        instructions: 'No real transfer needed in simulation.',
        simulation: true,
      },
    });

    expect(mapped.gatewayData?.simulation).toBe(true);
    expect(isUsdtSimulationMode(mapped.gatewayData)).toBe(true);
    expect(isUsdtSimulationMode(undefined)).toBe(false);
  });
});
