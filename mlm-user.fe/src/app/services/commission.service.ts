import { Injectable, signal, computed } from '@angular/core';

export type CommissionStatus = 'Pending' | 'Approved' | 'Locked';
export type CommissionType = 'Direct Referral' | 'Level Commission' | 'Bonus';

export interface CommissionEntry {
  id: string;
  date: string;
  type: CommissionType;
  source: string; // User Name or Order Ref
  amount: number;
  currency: 'NGN' | 'USD';
  status: CommissionStatus;
}

export interface CommissionSummary {
  totalEarnings: number;
  pendingCommissions: number;
  approvedCommissions: number;
  withdrawnAmount: number;
}

const COMMISSION_KEY = 'mlm_commissions';

@Injectable({
  providedIn: 'root'
})
export class CommissionService {
  private entries = signal<CommissionEntry[]>([]);

  readonly allEntries = computed(() => this.entries());
  
  constructor() {
    this.initialLoad();
  }

  private initialLoad() {
    const savedEntries = localStorage.getItem(COMMISSION_KEY);
    if (savedEntries) {
      this.entries.set(JSON.parse(savedEntries));
    } else {
      // Default mock entries
      const defaultEntries: CommissionEntry[] = [
        { id: 'c1', date: '2023-10-25T09:00:00Z', type: 'Direct Referral', source: 'Alice Smith', amount: 5000, currency: 'NGN', status: 'Approved' },
        { id: 'c2', date: '2023-10-26T10:30:00Z', type: 'Level Commission', source: 'Order #882', amount: 250, currency: 'NGN', status: 'Pending' },
        { id: 'c3', date: '2023-11-01T14:15:00Z', type: 'Direct Referral', source: 'Bob Jones', amount: 25, currency: 'USD', status: 'Approved' },
        { id: 'c4', date: '2023-11-02T16:00:00Z', type: 'Bonus', source: 'Monthly Target', amount: 1000, currency: 'NGN', status: 'Locked' }
      ];
      this.entries.set(defaultEntries);
      this.saveEntries(defaultEntries);
    }
  }

  private saveEntries(entries: CommissionEntry[]) {
    localStorage.setItem(COMMISSION_KEY, JSON.stringify(entries));
  }

  getSummary(currency: 'NGN' | 'USD') {
    return computed(() => {
      const filtered = this.entries().filter(e => e.currency === currency);
      return {
        totalEarnings: filtered.filter(e => e.status === 'Approved').reduce((acc, curr) => acc + curr.amount, 0),
        pendingCommissions: filtered.filter(e => e.status === 'Pending').reduce((acc, curr) => acc + curr.amount, 0),
        approvedCommissions: filtered.filter(e => e.status === 'Approved').reduce((acc, curr) => acc + curr.amount, 0),
        withdrawnAmount: 0 // In a real app, this would be linked to withdrawal service
      };
    });
  }

  getEntriesByType(type: CommissionType) {
    return computed(() => this.entries().filter(e => e.type === type));
  }
}
