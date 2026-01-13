import { Injectable, signal, computed } from '@angular/core';

export type CommissionStatus = 'Pending' | 'Approved' | 'Locked';
export type CommissionType = 'Direct Referral' | 'Community Bonus' | 'Product Bonus' | 'Matching Bonus' | 'Level Commission' | 'Bonus';

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
  directReferralBonus: number;
  communityBonus: number;
  productBonus: number;
  matchingBonus: number;
  directReferrals: number;
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
      let entries = JSON.parse(savedEntries) as CommissionEntry[];
      // Migration: Check if we have the new types
      const hasNewTypes = entries.some(e => e.type === 'Community Bonus' || e.type === 'Matching Bonus');
      if (!hasNewTypes) {
        // Reset to defaults to ensure user sees the new widgets
        const defaultEntries: CommissionEntry[] = [
          { id: 'c1', date: '2023-10-25T09:00:00Z', type: 'Direct Referral', source: 'Alice Smith', amount: 5000, currency: 'NGN', status: 'Approved' },
          { id: 'c2', date: '2023-10-26T10:30:00Z', type: 'Community Bonus', source: 'Global Pool', amount: 1500, currency: 'NGN', status: 'Approved' },
          { id: 'c3', date: '2023-11-01T14:15:00Z', type: 'Direct Referral', source: 'Bob Jones', amount: 25, currency: 'USD', status: 'Approved' },
          { id: 'c4', date: '2023-11-02T16:00:00Z', type: 'Matching Bonus', source: 'Team A', amount: 1000, currency: 'NGN', status: 'Approved' },
          { id: 'c5', date: '2023-11-05T12:00:00Z', type: 'Product Bonus', source: 'Health Pack', amount: 500, currency: 'NGN', status: 'Approved' }
        ];
        entries = defaultEntries;
        this.saveEntries(defaultEntries);
      }
      this.entries.set(entries);
    } else {
      // Default mock entries
      const defaultEntries: CommissionEntry[] = [
        { id: 'c1', date: '2023-10-25T09:00:00Z', type: 'Direct Referral', source: 'Alice Smith', amount: 5000, currency: 'NGN', status: 'Approved' },
        { id: 'c2', date: '2023-10-26T10:30:00Z', type: 'Community Bonus', source: 'Global Pool', amount: 1500, currency: 'NGN', status: 'Approved' },
        { id: 'c3', date: '2023-11-01T14:15:00Z', type: 'Direct Referral', source: 'Bob Jones', amount: 25, currency: 'USD', status: 'Approved' },
        { id: 'c4', date: '2023-11-02T16:00:00Z', type: 'Matching Bonus', source: 'Team A', amount: 1000, currency: 'NGN', status: 'Approved' },
        { id: 'c5', date: '2023-11-05T12:00:00Z', type: 'Product Bonus', source: 'Health Pack', amount: 500, currency: 'NGN', status: 'Approved' }
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
      const approved = filtered.filter(e => e.status === 'Approved');
      
      return {
        totalEarnings: approved.reduce((acc, curr) => acc + curr.amount, 0),
        pendingCommissions: filtered.filter(e => e.status === 'Pending').reduce((acc, curr) => acc + curr.amount, 0),
        approvedCommissions: approved.reduce((acc, curr) => acc + curr.amount, 0),
        withdrawnAmount: 0,
        directReferralBonus: approved.filter(e => e.type === 'Direct Referral').reduce((acc, curr) => acc + curr.amount, 0),
        communityBonus: approved.filter(e => e.type === 'Community Bonus').reduce((acc, curr) => acc + curr.amount, 0),
        productBonus: approved.filter(e => e.type === 'Product Bonus').reduce((acc, curr) => acc + curr.amount, 0),
        matchingBonus: approved.filter(e => e.type === 'Matching Bonus').reduce((acc, curr) => acc + curr.amount, 0),
        directReferrals: approved.filter(e => e.type === 'Direct Referral').length
      };
    });
  }

  getEntriesByType(type: CommissionType) {
    return computed(() => this.entries().filter(e => e.type === type));
  }

  getAllCommissions() {
    return computed(() => this.entries());
  }
}
