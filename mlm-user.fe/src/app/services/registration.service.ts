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

export interface CompanyBankAccount {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export type ManualRegistrationPaymentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ManualRegistrationPayment {
  id: string;
  userId: string;
  amount: number;
  currency: 'NGN' | 'USD';
  depositorName: string;
  evidenceUrl?: string;
  status: ManualRegistrationPaymentStatus;
  rejectionReason?: string | null;
  packageId?: string;
  paymentId?: string | null;
  createdAt: string;
  updatedAt?: string;
  reviewedAt?: string | null;
}

@Injectable({
  providedIn: 'root',
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
          baseCurrency:
            (res['baseCurrency'] as string | undefined) ??
            (res['base_currency'] as string | undefined),
          status: res['status'] as string | undefined,
          balance: Number(res['balance'] ?? 0),
        };
      }),
      catchError(() => of(null)),
    );
  }

  getCompanyBankAccount(): Observable<CompanyBankAccount | null> {
    return this.api.get<Record<string, unknown>>('registration/company-bank-account').pipe(
      map((res) => ({
        bankName: String(res['bankName'] ?? res['bank_name'] ?? ''),
        accountNumber: String(res['accountNumber'] ?? res['account_number'] ?? ''),
        accountName: String(res['accountName'] ?? res['account_name'] ?? ''),
      })),
      catchError(() => of(null)),
    );
  }

  getManualPayment(): Observable<ManualRegistrationPayment | null> {
    return this.api
      .get<Record<string, unknown> | null>('registration/manual-payment')
      .pipe(
        map((res) => (res ? this.mapManualPayment(res) : null)),
        catchError(() => of(null)),
      );
  }

  submitManualPayment(depositorName: string, evidence: File): Observable<ManualRegistrationPayment> {
    const formData = new FormData();
    formData.append('depositorName', depositorName.trim());
    formData.append('evidence', evidence, evidence.name);
    return this.api
      .post<Record<string, unknown>>('registration/manual-payment', formData)
      .pipe(map((res) => this.mapManualPayment(res)));
  }

  transferToRegistration(
    amount: number,
    currency: 'NGN' | 'USD',
  ): Observable<TransferToRegistrationResponse> {
    return this.api
      .post<Record<string, unknown>>('registration/transfer-to-registration', {
        amount,
        currency,
      })
      .pipe(
        map((res) => ({
          transferId: String(res['transferId'] ?? res['transfer_id'] ?? ''),
        })),
      );
  }

  activate(): Observable<ActivateResponse> {
    return this.api.post<Record<string, unknown>>('registration/activate', {}).pipe(
      map((res) => ({
        activated: res['activated'] === true,
      })),
    );
  }

  private mapManualPayment(raw: Record<string, unknown>): ManualRegistrationPayment {
    const statusRaw = String(raw['status'] ?? 'PENDING').toUpperCase();
    const status: ManualRegistrationPaymentStatus =
      statusRaw === 'APPROVED'
        ? 'APPROVED'
        : statusRaw === 'REJECTED'
          ? 'REJECTED'
          : 'PENDING';

    return {
      id: String(raw['id'] ?? ''),
      userId: String(raw['userId'] ?? raw['user_id'] ?? ''),
      amount: Number(raw['amount'] ?? 0),
      currency: String(raw['currency'] ?? 'NGN') === 'USD' ? 'USD' : 'NGN',
      depositorName: String(raw['depositorName'] ?? raw['depositor_name'] ?? ''),
      evidenceUrl: (raw['evidenceUrl'] ?? raw['evidence_url']) as string | undefined,
      status,
      rejectionReason: (raw['rejectionReason'] ?? raw['rejection_reason'] ?? null) as
        | string
        | null,
      packageId: (raw['packageId'] ?? raw['package_id']) as string | undefined,
      paymentId: (raw['paymentId'] ?? raw['payment_id'] ?? null) as string | null,
      createdAt: String(raw['createdAt'] ?? raw['created_at'] ?? ''),
      updatedAt: (raw['updatedAt'] ?? raw['updated_at']) as string | undefined,
      reviewedAt: (raw['reviewedAt'] ?? raw['reviewed_at'] ?? null) as string | null,
    };
  }
}
