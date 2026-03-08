import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ApiService } from './api.service';

export interface RegistrationWallet {
  walletId: string;
  walletType: string;
  currency: 'NGN' | 'USD';
  baseCurrency?: string;
  status?: string;
  balance: number;
}

export interface TransferToRegistrationResponse {
  transferId: string;
}

export interface ActivateResponse {
  activated: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class RegistrationService {
  private api = inject(ApiService);

  getRegistrationWallet(): Observable<RegistrationWallet | null> {
    return this.api.get<Record<string, unknown> | null>('registration/wallet').pipe(
      map((res) => {
        if (!res) return null;
        return {
          walletId: String(res['walletId'] ?? res['wallet_id'] ?? ''),
          walletType: String(res['walletType'] ?? res['wallet_type'] ?? 'REGISTRATION'),
          currency: (res['currency'] ?? 'NGN') as 'NGN' | 'USD',
          baseCurrency: res['baseCurrency'] as string | undefined ?? res['base_currency'] as string | undefined,
          status: res['status'] as string | undefined,
          balance: Number(res['balance'] ?? 0)
        };
      }),
      catchError(() => of(null))
    );
  }

  transferToRegistration(amount: number, currency: 'NGN' | 'USD'): Observable<TransferToRegistrationResponse> {
    return this.api.post<Record<string, unknown>>('registration/transfer-to-registration', {
      amount,
      currency
    }).pipe(
      map((res) => ({
        transferId: String(res['transferId'] ?? res['transfer_id'] ?? '')
      }))
    );
  }

  activate(): Observable<ActivateResponse> {
    return this.api.post<Record<string, unknown>>('registration/activate', {}).pipe(
      map((res) => ({
        activated: res['activated'] === true
      }))
    );
  }
}
