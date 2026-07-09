import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';

export type ManualDepositWalletType = 'REGISTRATION' | 'VOUCHER';
export type ManualDepositStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ManualDeposit {
  id: string;
  userId: string;
  walletType: ManualDepositWalletType;
  amount: number;
  currency: 'NGN' | 'USD';
  depositorName: string;
  evidenceUrl?: string;
  status: ManualDepositStatus;
  rejectionReason?: string | null;
  paymentId?: string | null;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string | null;
}

export interface ManualDepositListResponse {
  items: ManualDeposit[];
  total: number;
  limit: number;
  offset: number;
}

export function hasPendingDeposit(
  items: ManualDeposit[],
  walletType: ManualDepositWalletType,
): boolean {
  return items.some(
    (item) => item.walletType === walletType && item.status === 'PENDING',
  );
}

@Injectable({
  providedIn: 'root',
})
export class ManualDepositService {
  private api = inject(ApiService);

  listDeposits(limit = 20, offset = 0): Observable<ManualDepositListResponse> {
    return this.api
      .get<Record<string, unknown>>('payments/manual-deposit', {
        limit: String(limit),
        offset: String(offset),
      })
      .pipe(map((res) => this.mapListResponse(res)));
  }

  submitDeposit(
    walletType: ManualDepositWalletType,
    amount: number,
    depositorName: string,
    evidence: File,
  ): Observable<ManualDeposit> {
    const formData = new FormData();
    formData.append('walletType', walletType);
    formData.append('amount', String(amount));
    formData.append('depositorName', depositorName.trim());
    formData.append('evidence', evidence, evidence.name);

    return this.api
      .post<Record<string, unknown>>('payments/manual-deposit', formData)
      .pipe(map((res) => this.mapDeposit(res)));
  }

  private mapListResponse(res: Record<string, unknown>): ManualDepositListResponse {
    const rawItems = (res['items'] ?? []) as Record<string, unknown>[];
    return {
      items: rawItems.map((item) => this.mapDeposit(item)),
      total: Number(res['total'] ?? rawItems.length),
      limit: Number(res['limit'] ?? 20),
      offset: Number(res['offset'] ?? 0),
    };
  }

  private mapDeposit(res: Record<string, unknown>): ManualDeposit {
    const walletType = String(res['walletType'] ?? res['wallet_type'] ?? 'REGISTRATION')
      .toUpperCase() as ManualDepositWalletType;

    return {
      id: String(res['id'] ?? ''),
      userId: String(res['userId'] ?? res['user_id'] ?? ''),
      walletType: walletType === 'VOUCHER' ? 'VOUCHER' : 'REGISTRATION',
      amount: Number(res['amount'] ?? 0),
      currency: (res['currency'] ?? 'NGN') as 'NGN' | 'USD',
      depositorName: String(res['depositorName'] ?? res['depositor_name'] ?? ''),
      evidenceUrl: (res['evidenceUrl'] ?? res['evidence_url']) as string | undefined,
      status: String(res['status'] ?? 'PENDING').toUpperCase() as ManualDepositStatus,
      rejectionReason: (res['rejectionReason'] ?? res['rejection_reason'] ?? null) as
        | string
        | null,
      paymentId: (res['paymentId'] ?? res['payment_id'] ?? null) as string | null,
      createdAt: String(res['createdAt'] ?? res['created_at'] ?? ''),
      updatedAt: String(res['updatedAt'] ?? res['updated_at'] ?? ''),
      reviewedAt: (res['reviewedAt'] ?? res['reviewed_at'] ?? null) as string | null,
    };
  }
}
