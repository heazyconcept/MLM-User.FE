import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';

export interface InitiateRegistrationPaymentResponse {
  reference: string;
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

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private api = inject(ApiService);

  initiateRegistrationPayment(
    packageName: string,
    currency: string,
    callbackUrl?: string
  ): Observable<InitiateRegistrationPaymentResponse> {
    const body: Record<string, unknown> = { package: packageName, currency };
    // Only send callbackUrl when valid (backend @IsUrl rejects localhost)
    const isValidUrl = callbackUrl && /^https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(callbackUrl);
    if (isValidUrl) {
      body['callbackUrl'] = callbackUrl;
    }
    return this.api
      .post<Record<string, unknown>>('payments/registration/initiate', body)
      .pipe(
        map((res) => ({
          reference: String(res['reference'] ?? res['ref'] ?? ''),
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
}
