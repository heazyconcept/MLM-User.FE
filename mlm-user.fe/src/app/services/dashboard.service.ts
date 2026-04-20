import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export type DashboardOverview = {
  currency: 'NGN' | 'USD';
  hero: {
    totalWalletBalance: number;
    voucherBalance: number;
    autoshipBalance: number;
  };
  stats: {
    cashoutBalance: number;
    totalEarnings: number;
    totalPayout: number;
    productVoucher: number;
    totalDownlines: number;
    totalCpvs: number;
  };
};

export type DashboardTransaction = {
  id: string;
  date: string;
  description: string;
  type: 'Credit' | 'Debit';
  amount: number;
  currency: 'NGN' | 'USD';
  status: 'Completed' | 'Pending' | 'Failed';
};

export type DashboardTransactionsResponse = {
  items: DashboardTransaction[];
  nextCursor?: string;
};

@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  private api = inject(ApiService);

  getOverview(): Observable<DashboardOverview> {
    return this.api.get<DashboardOverview>('dashboard/overview');
  }

  getTransactions(limit = 10, cursor?: string): Observable<DashboardTransactionsResponse> {
    const params: Record<string, string | number> = { limit };
    if (cursor) params['cursor'] = cursor;
    return this.api.get<DashboardTransactionsResponse>('dashboard/transactions', params);
  }
}
