import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';

export interface InitiateRegistrationPaymentResponse {
  reference: string;
  authorizationUrl?: string;
  gatewayUrl?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private api = inject(ApiService);

  initiateRegistrationPayment(
    packageName: string,
    currency: string
  ): Observable<InitiateRegistrationPaymentResponse> {
    const body = {
      package: packageName,
      currency
    };
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
}
