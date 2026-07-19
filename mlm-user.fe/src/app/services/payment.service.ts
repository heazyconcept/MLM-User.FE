import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { mapInitiatePaymentResponse } from './payment-initiate.mapper';

export type PaymentCurrency = 'NGN' | 'USD';

export interface UsdtGatewayData {
  coin: 'USDT';
  network: string;
  depositAddress: string;
  memo: string;
  usdtAmount: number;
  displayAmount: number;
  displayCurrency: PaymentCurrency;
  instructions: string;
  simulation?: boolean;
}

export interface InitiatePaymentResponse {
  paymentId?: string;
  reference: string;
  amount?: number;
  currency?: PaymentCurrency;
  authorizationUrl?: string;
  gatewayUrl?: string;
  gatewayData?: UsdtGatewayData;
}

/** @deprecated Use InitiatePaymentResponse */
export type InitiateRegistrationPaymentResponse = InitiatePaymentResponse;

export interface PaymentRecord {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  type: string;
  provider: string;
  reference: string;
  status: string;
  verifiedAt: Date | null;
  packageId?: string;
  createdAt: Date;
}

export type PaymentGatewayProvider = 'PAYSTACK' | 'FLUTTERWAVE' | 'KORAPAY' | 'USDT';

export interface UpgradeOption {
  package: string;
  price: number;
  currency: string;
  currentPackage: boolean;
  benefits?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private api = inject(ApiService);

  initiateRegistrationPayment(
    packageName: string,
    currency: string,
    callbackUrl?: string,
    provider?: PaymentGatewayProvider
  ): Observable<InitiatePaymentResponse> {
    const body: Record<string, unknown> = { package: packageName, currency };
    const isValidUrl = callbackUrl && /^https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(callbackUrl);
    if (isValidUrl) {
      body['callbackUrl'] = callbackUrl;
    }
    if (provider) {
      body['provider'] = provider;
    }
    return this.api
      .post<Record<string, unknown>>('payments/registration/initiate', body)
      .pipe(map((res) => mapInitiatePaymentResponse(res)));
  }

  initiateWalletFunding(
    amount: number,
    provider: PaymentGatewayProvider,
    callbackUrl?: string,
    walletType: 'CASH' | 'VOUCHER' = 'CASH'
  ): Observable<InitiatePaymentResponse> {
    const body: Record<string, unknown> = { amount, provider, walletType };
    const isValidUrl = callbackUrl && /^https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(callbackUrl);
    if (isValidUrl) {
      body['callbackUrl'] = callbackUrl;
    }
    return this.api
      .post<Record<string, unknown>>('payments/wallet-funding/initiate', body)
      .pipe(map((res) => mapInitiatePaymentResponse(res)));
  }

  /** POST /payments/registration-wallet-funding/initiate */
  initiateRegistrationWalletFunding(
    amount: number,
    provider: PaymentGatewayProvider,
    callbackUrl?: string
  ): Observable<InitiatePaymentResponse> {
    const body: Record<string, unknown> = { amount, provider };
    const isValidUrl = callbackUrl && /^https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(callbackUrl);
    if (isValidUrl) {
      body['callbackUrl'] = callbackUrl;
    }
    return this.api
      .post<Record<string, unknown>>('payments/registration-wallet-funding/initiate', body)
      .pipe(map((res) => mapInitiatePaymentResponse(res)));
  }

  verifyPayment(
    reference: string,
    gatewayResponse?: Record<string, unknown>
  ): Observable<unknown> {
    const body: Record<string, unknown> = { reference };
    if (gatewayResponse) {
      body['gatewayResponse'] = gatewayResponse;
    }
    return this.api.post('payments/verify', body);
  }

  fetchUpgradeOptions(): Observable<UpgradeOption[]> {
    return this.api.get<Record<string, unknown>>('users/me/upgrade-options').pipe(
      map((res) => {
        const options = (res['eligibleUpgrades'] ?? res['options'] ?? res['packages'] ?? res) as Record<string, unknown>[];
        if (!Array.isArray(options)) return [];
        return options.map((opt) => ({
          package: String(opt['package'] ?? opt['name'] ?? ''),
          price: Number(opt['upgradeAmount'] ?? opt['price'] ?? opt['amount'] ?? 0),
          currency: String(opt['currency'] ?? res['currency'] ?? 'NGN'),
          currentPackage: Boolean(opt['currentPackage'] ?? opt['current'] ?? false),
          benefits: Array.isArray(opt['benefits']) ? (opt['benefits'] as string[]) : undefined
        }));
      })
    );
  }

  initiateUpgradePayment(
    targetPackage: string,
    callbackUrl?: string,
    provider?: PaymentGatewayProvider
  ): Observable<InitiatePaymentResponse> {
    const body: Record<string, unknown> = { targetPackage };
    const isValidUrl = callbackUrl && /^https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(callbackUrl);
    if (isValidUrl) {
      body['callbackUrl'] = callbackUrl;
    }
    if (provider) {
      body['provider'] = provider;
    }
    return this.api
      .post<Record<string, unknown>>('payments/upgrade/initiate', body)
      .pipe(map((res) => mapInitiatePaymentResponse(res)));
  }

  getPayments(limit = 20, offset = 0): Observable<{ items: PaymentRecord[]; total: number }> {
    return this.api
      .get<{ data?: any[]; items?: any[]; total?: number; meta?: any }>(`payments`, { limit: String(limit), offset: String(offset) })
      .pipe(
        map((res) => {
          const rawItems = res.data ?? res.items ?? (Array.isArray(res) ? res : []);
          const total = res.total ?? res.meta?.total ?? rawItems.length;

          const items: PaymentRecord[] = rawItems.map((item: any) => ({
            id: item.id || '',
            userId: item.userId || item.user_id || '',
            amount: Number(item.amount || 0),
            currency: item.currency || 'NGN',
            type: item.type || item.payment_type || 'UNKNOWN',
            provider: item.provider || item.payment_provider || 'UNKNOWN',
            reference: item.reference || '',
            status: item.status || 'PENDING',
            verifiedAt: item.verifiedAt ? new Date(item.verifiedAt) : null,
            packageId: item.packageId || item.package_id,
            createdAt: new Date(item.createdAt || item.created_at || Date.now())
          }));

          return { items, total };
        })
      );
  }
}
