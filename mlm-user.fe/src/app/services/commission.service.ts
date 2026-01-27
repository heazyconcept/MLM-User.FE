import { Injectable, signal, computed } from '@angular/core';

export type CommissionStatus = 'Pending' | 'Approved' | 'Locked';
export type CommissionType = 'Direct Referral' | 'Community Bonus' | 'Product Bonus' | 'Matching Bonus' | 'Level Commission' | 'Bonus' | 'Leadership Bonus' | 'Merchant Bonus';

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

export interface BonusInfo {
  id: string;
  name: string;
  description: string;
  qualificationStatus: 'Qualified' | 'Not Qualified' | 'In Progress';
  earnedStatus: 'Earned' | 'Pending' | 'Locked';
  amount?: number;
  currency?: 'NGN' | 'USD';
  requirements: string[];
}

export interface RankInfo {
  currentRank: string;
  currentStage: number;
  totalStages: number;
  nextRank: string;
  progressPercentage: number;
  requirements: { label: string; current: number; required: number; completed: boolean }[];
  achievedRanks: { rank: string; achievedDate: string }[];
}

export interface MilestoneInfo {
  id: string;
  name: string;
  description: string;
  cpvRequired: number;
  reward: string;
  rewardAmount?: number;
  achieved: boolean;
  achievedDate?: string;
}

export interface CpvSummary {
  totalCpv: number;
  personalCpv: number;
  teamCpv: number;
  nextMilestoneCpv: number;
  nextMilestoneReward: string;
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
          { id: 'c5', date: '2023-11-05T12:00:00Z', type: 'Product Bonus', source: 'Health Pack', amount: 500, currency: 'NGN', status: 'Approved' },
          { id: 'c6', date: '2023-11-10T11:00:00Z', type: 'Leadership Bonus', source: 'Monthly Pool', amount: 2500, currency: 'NGN', status: 'Approved' },
          { id: 'c7', date: '2023-11-12T09:30:00Z', type: 'Merchant Bonus', source: 'Partner Store', amount: 750, currency: 'NGN', status: 'Pending' }
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
        { id: 'c5', date: '2023-11-05T12:00:00Z', type: 'Product Bonus', source: 'Health Pack', amount: 500, currency: 'NGN', status: 'Approved' },
        { id: 'c6', date: '2023-11-10T11:00:00Z', type: 'Leadership Bonus', source: 'Monthly Pool', amount: 2500, currency: 'NGN', status: 'Approved' },
        { id: 'c7', date: '2023-11-12T09:30:00Z', type: 'Merchant Bonus', source: 'Partner Store', amount: 750, currency: 'NGN', status: 'Pending' }
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

  // Bonus-related methods
  getBonuses() {
    return computed<BonusInfo[]>(() => [
      {
        id: 'b1',
        name: 'Direct Referral Bonus',
        description: 'Earn a percentage of each direct referral\'s registration fee.',
        qualificationStatus: 'Qualified',
        earnedStatus: 'Earned',
        amount: 5000,
        currency: 'NGN',
        requirements: ['Active account', 'At least 1 direct referral']
      },
      {
        id: 'b2',
        name: 'Community Bonus',
        description: 'Share in the global community pool based on your activity level.',
        qualificationStatus: 'Qualified',
        earnedStatus: 'Earned',
        amount: 1500,
        currency: 'NGN',
        requirements: ['Active account', 'Minimum 100 CPV']
      },
      {
        id: 'b3',
        name: 'Product Purchase Bonus',
        description: 'Earn from every product purchase in your downline.',
        qualificationStatus: 'Qualified',
        earnedStatus: 'Pending',
        amount: 500,
        currency: 'NGN',
        requirements: ['Active account', 'Downline purchases']
      },
      {
        id: 'b4',
        name: 'Matching Bonus',
        description: 'Match a percentage of your direct referrals\' earnings.',
        qualificationStatus: 'In Progress',
        earnedStatus: 'Locked',
        requirements: ['Silver rank or higher', '5+ active direct referrals']
      },
      {
        id: 'b5',
        name: 'Leadership Bonus',
        description: 'Monthly bonus pool for top-performing leaders.',
        qualificationStatus: 'Not Qualified',
        earnedStatus: 'Locked',
        requirements: ['Gold rank or higher', 'Maintain 1000+ team CPV']
      },
      {
        id: 'b6',
        name: 'Merchant Bonus',
        description: 'Special bonuses from partner merchants and stores.',
        qualificationStatus: 'Qualified',
        earnedStatus: 'Pending',
        amount: 750,
        currency: 'NGN',
        requirements: ['Active account', 'Partner purchases']
      }
    ]);
  }

  // Ranking-related methods
  getRankInfo() {
    return computed<RankInfo>(() => ({
      currentRank: 'Silver Director',
      currentStage: 2,
      totalStages: 5,
      nextRank: 'Gold Director',
      progressPercentage: 65,
      requirements: [
        { label: 'Active Direct Referrals', current: 8, required: 10, completed: false },
        { label: 'Team CPV', current: 1800, required: 2500, completed: false },
        { label: 'Personal CPV', current: 250, required: 200, completed: true },
        { label: 'Active Downline', current: 25, required: 20, completed: true }
      ],
      achievedRanks: [
        { rank: 'Silver Director', achievedDate: '2026-01-05' },
        { rank: 'Bronze Director', achievedDate: '2025-12-15' },
        { rank: 'Ruby', achievedDate: '2025-11-20' },
        { rank: 'Member', achievedDate: '2025-11-01' }
      ]
    }));
  }

  // CPV & Milestones methods
  getCpvSummary() {
    return computed<CpvSummary>(() => ({
      totalCpv: 2050,
      personalCpv: 250,
      teamCpv: 1800,
      nextMilestoneCpv: 2500,
      nextMilestoneReward: '₦10,000 Bonus'
    }));
  }

  getMilestones() {
    return computed<MilestoneInfo[]>(() => [
      {
        id: 'm1',
        name: 'First 100 CPV',
        description: 'Reach your first 100 cumulative point value.',
        cpvRequired: 100,
        reward: 'Welcome Bonus',
        rewardAmount: 1000,
        achieved: true,
        achievedDate: '2025-11-05'
      },
      {
        id: 'm2',
        name: '500 CPV Club',
        description: 'Join the 500 CPV club and unlock special benefits.',
        cpvRequired: 500,
        reward: 'Bonus + Badge',
        rewardAmount: 2500,
        achieved: true,
        achievedDate: '2025-11-25'
      },
      {
        id: 'm3',
        name: '1000 CPV Master',
        description: 'Reach 1000 CPV to become a CPV Master.',
        cpvRequired: 1000,
        reward: 'Exclusive Access',
        rewardAmount: 5000,
        achieved: true,
        achievedDate: '2025-12-20'
      },
      {
        id: 'm4',
        name: '2500 CPV Elite',
        description: 'Elite status unlocked at 2500 CPV.',
        cpvRequired: 2500,
        reward: '₦10,000 Bonus',
        rewardAmount: 10000,
        achieved: false
      },
      {
        id: 'm5',
        name: '5000 CPV Champion',
        description: 'Champion level rewards await you.',
        cpvRequired: 5000,
        reward: '₦25,000 Bonus + Trip',
        rewardAmount: 25000,
        achieved: false
      },
      {
        id: 'm6',
        name: '10000 CPV Legend',
        description: 'Legendary status with premium rewards.',
        cpvRequired: 10000,
        reward: '₦50,000 Bonus + Car Fund',
        rewardAmount: 50000,
        achieved: false
      }
    ]);
  }
}

