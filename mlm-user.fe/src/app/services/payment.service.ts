import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';

export interface InitiateRegistrationPaymentResponse {
  paymentId?: string;
  reference: string;
  amount?: number;
  currency?: string;
  authorizationUrl?: string;
  gatewayUrl?: string;
}

export interface UpgradeOption {
  package: string;
  price: number;
  currency: string;
  currentPackage: boolean;
  benefits?: string[];
}

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

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private api = inject(ApiService);

  initiateRegistrationPayment(
    packageName: string,
    currency: string,
    callbackUrl?: string,
    provider?: 'PAYSTACK' | 'USDT'
  ): Observable<InitiateRegistrationPaymentResponse> {
    const body: Record<string, unknown> = { package: packageName, currency };
    // Only send callbackUrl when valid (backend @IsUrl rejects localhost)
    const isValidUrl = callbackUrl && /^https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(callbackUrl);
    if (isValidUrl) {
      body['callbackUrl'] = callbackUrl;
    }
    if (provider) {
      body['provider'] = provider;
    }
    return this.api
      .post<Record<string, unknown>>('payments/registration/initiate', body)
      .pipe(
        map((res) => ({
          paymentId: res['paymentId'] as string | undefined,
          reference: String(res['reference'] ?? res['ref'] ?? ''),
          amount: res['amount'] as number | undefined,
          currency: res['currency'] as string | undefined,
          authorizationUrl: res['authorizationUrl'] as string | undefined ?? res['authorization_url'] as string | undefined,
          gatewayUrl: res['gatewayUrl'] as string | undefined ?? res['gateway_url'] as string | undefined
        }))
      );
  }

  initiateWalletFunding(
    amount: number,
    provider: 'PAYSTACK' | 'FLUTTERWAVE' | 'USDT',
    callbackUrl?: string
  ): Observable<InitiateRegistrationPaymentResponse> {
    const body: Record<string, unknown> = { amount, provider };
    const isValidUrl = callbackUrl && /^https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(callbackUrl);
    if (isValidUrl) {
      body['callbackUrl'] = callbackUrl;
    }
    return this.api
      .post<Record<string, unknown>>('payments/wallet-funding/initiate', body)
      .pipe(
        map((res) => ({
          reference: String(res['reference'] ?? res['ref'] ?? ''),
          authorizationUrl: res['authorizationUrl'] as string | undefined ?? res['authorization_url'] as string | undefined,
          gatewayUrl: res['gatewayUrl'] as string | undefined ?? res['gateway_url'] as string | undefined
        }))
      );
  }

  /** POST /payments/registration-wallet-funding/initiate */
  initiateRegistrationWalletFunding(
    amount: number,
    provider: 'PAYSTACK' | 'FLUTTERWAVE' | 'USDT',
    callbackUrl?: string
  ): Observable<InitiateRegistrationPaymentResponse> {
    const body: Record<string, unknown> = { amount, provider };
    const isValidUrl = callbackUrl && /^https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(callbackUrl);
    if (isValidUrl) {
      body['callbackUrl'] = callbackUrl;
    }
    return this.api
      .post<Record<string, unknown>>('payments/registration-wallet-funding/initiate', body)
      .pipe(
        map((res) => ({
          reference: String(res['reference'] ?? res['ref'] ?? ''),
          authorizationUrl: res['authorizationUrl'] as string | undefined ?? res['authorization_url'] as string | undefined,
          gatewayUrl: res['gatewayUrl'] as string | undefined ?? res['gateway_url'] as string | undefined
        }))
      );
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
        const options = (res['options'] ?? res['packages'] ?? res) as Record<string, unknown>[];
        if (!Array.isArray(options)) return [];
        return options.map((opt) => ({
          package: String(opt['package'] ?? opt['name'] ?? ''),
          price: Number(opt['price'] ?? opt['amount'] ?? 0),
          currency: String(opt['currency'] ?? 'NGN'),
          currentPackage: Boolean(opt['currentPackage'] ?? opt['current'] ?? false),
          benefits: Array.isArray(opt['benefits']) ? (opt['benefits'] as string[]) : undefined
        }));
      })
    );
  }

  initiateUpgradePayment(
    targetPackage: string,
    callbackUrl?: string
  ): Observable<InitiateRegistrationPaymentResponse> {
    const body: Record<string, unknown> = { targetPackage };
    const isValidUrl = callbackUrl && /^https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(callbackUrl);
    if (isValidUrl) {
      body['callbackUrl'] = callbackUrl;
    }
    return this.api
      .post<Record<string, unknown>>('payments/upgrade/initiate', body)
      .pipe(
        map((res) => ({
          reference: String(res['reference'] ?? res['ref'] ?? ''),
          authorizationUrl: res['authorizationUrl'] as string | undefined ?? res['authorization_url'] as string | undefined,
          gatewayUrl: res['gatewayUrl'] as string | undefined ?? res['gateway_url'] as string | undefined
        }))
      );
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
