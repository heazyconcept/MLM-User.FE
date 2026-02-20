import { Injectable, inject, computed } from '@angular/core';
import { EarningsService } from './earnings.service';

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

@Injectable({
  providedIn: 'root'
})
export class CommissionService {
  private earningsService = inject(EarningsService);

  private mapToCommissionEntry = (e: { id: string; date: string; type: string; source: string; amount: number; currency: 'NGN' | 'USD'; status: string }): CommissionEntry => ({
    id: e.id,
    date: e.date,
    type: e.type as CommissionType,
    source: e.source,
    amount: e.amount,
    currency: e.currency,
    status: e.status as CommissionStatus
  });

  readonly allEntries = computed(() =>
    this.earningsService.earningsList().map(this.mapToCommissionEntry)
  );

  getSummary(currency: 'NGN' | 'USD') {
    return computed(() => {
      const summary = this.earningsService.earningsSummary();
      const list = this.earningsService.earningsList();
      const filtered = list.filter((e) => e.currency === currency);
      const approved = filtered.filter((e) => e.status === 'Approved');
      const pending = filtered.filter((e) => e.status === 'Pending');
      return {
        totalEarnings: summary.totalEarnings || approved.reduce((acc, curr) => acc + curr.amount, 0),
        pendingCommissions: pending.reduce((acc, curr) => acc + curr.amount, 0),
        approvedCommissions: approved.reduce((acc, curr) => acc + curr.amount, 0),
        withdrawnAmount: 0,
        directReferralBonus: summary.directReferralBonus ?? approved.filter((e) => e.type === 'Direct Referral').reduce((acc, curr) => acc + curr.amount, 0),
        communityBonus: summary.communityBonus ?? approved.filter((e) => e.type === 'Community Bonus').reduce((acc, curr) => acc + curr.amount, 0),
        productBonus: summary.productBonus ?? approved.filter((e) => e.type === 'Product Bonus').reduce((acc, curr) => acc + curr.amount, 0),
        matchingBonus: summary.matchingBonus ?? approved.filter((e) => e.type === 'Matching Bonus').reduce((acc, curr) => acc + curr.amount, 0),
        directReferrals: approved.filter((e) => e.type === 'Direct Referral').length
      };
    });
  }

  getEntriesByType(type: CommissionType) {
    return computed(() =>
      this.earningsService.earningsList().filter((e) => e.type === type).map(this.mapToCommissionEntry)
    );
  }

  getAllCommissions() {
    return computed(() => this.allEntries());
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

  getRankInfo() {
    return computed<RankInfo>(() => {
      const r = this.earningsService.ranking();
      if (r) {
        return {
          currentRank: r.currentRank,
          currentStage: r.currentStage,
          totalStages: r.totalStages,
          nextRank: r.nextRank,
          progressPercentage: r.progressPercentage,
          requirements: r.requirements,
          achievedRanks: r.achievedRanks
        };
      }
      return {
        currentRank: '—',
        currentStage: 0,
        totalStages: 5,
        nextRank: '—',
        progressPercentage: 0,
        requirements: [],
        achievedRanks: []
      };
    });
  }

  getCpvSummary() {
    return computed<CpvSummary>(() => {
      const cpv = this.earningsService.cpvSummary();
      const totalCpv = cpv.personalCpv + cpv.teamCpv;
      return {
        totalCpv,
        personalCpv: cpv.personalCpv,
        teamCpv: cpv.teamCpv,
        nextMilestoneCpv: cpv.requiredCpv || 1,
        nextMilestoneReward: cpv.requiredCpv ? `Next milestone at ${cpv.requiredCpv} CPV` : '—'
      };
    });
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

