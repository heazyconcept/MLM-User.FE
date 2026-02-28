import { Injectable, inject, computed } from '@angular/core';
import { EarningsService, StageBonusDto } from './earnings.service';

export type CommissionStatus = 'Pending' | 'Approved' | 'Locked';
export type CommissionType =
  | 'Direct Referral' | 'Community Bonus' | 'Product Bonus'
  | 'Matching Bonus' | 'Level Commission' | 'Bonus'
  | 'Leadership Bonus' | 'Merchant Bonus' | 'PDPA' | 'CDPA'
  | 'Personal Product Commission' | 'Direct Referral Product Commission'
  | 'Community Product Commission' | 'Repeat Purchase Bonus'
  | 'Ranking Bonus' | 'CPV Cash Bonus' | 'CPV Milestone'
  | 'Merchant Personal Product' | 'Merchant Direct Referral Product'
  | 'Merchant Community Product' | 'Merchant Delivery Bonus';

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
  stageBonuses?: StageBonusDto[];
}

export interface MilestoneInfo {
  id: string;
  name: string;
  description: string;
  cpvRequired: number;
  reward: string;
  rewardAmount?: number;
  materialReward?: string;
  achieved: boolean;
  achievedDate?: string;
  progressPercent?: number;
}

export interface CpvSummary {
  totalCpv: number;
  personalCpv: number;
  teamCpv: number;
  currentStage: number;
  totalStages: number;
  cpvCashBonus: number;
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
        pdpaEarnings: approved.filter((e) => e.type === 'PDPA').reduce((acc, curr) => acc + curr.amount, 0),
        cdpaEarnings: approved.filter((e) => e.type === 'CDPA').reduce((acc, curr) => acc + curr.amount, 0),
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

  // Bonus-related methods — derived from earnings summary
  getBonuses() {
    return computed<BonusInfo[]>(() => {
      const summary = this.earningsService.earningsSummary();
      const matchingStatus = this.earningsService.matchingBonusStatus();
      const bonuses: BonusInfo[] = [];

      if (summary.directReferralBonus) {
        bonuses.push({
          id: 'b-direct',
          name: 'Direct Referral Bonus',
          description: 'Earn a percentage of each direct referral\'s registration fee.',
          qualificationStatus: 'Qualified',
          earnedStatus: 'Earned',
          amount: summary.directReferralBonus,
          currency: 'NGN',
          requirements: ['Active account', 'At least 1 direct referral']
        });
      }

      if (summary.communityBonus) {
        bonuses.push({
          id: 'b-community',
          name: 'Community Bonus',
          description: 'Share in the global community pool based on your activity level.',
          qualificationStatus: 'Qualified',
          earnedStatus: 'Earned',
          amount: summary.communityBonus,
          currency: 'NGN',
          requirements: ['Active account', 'Minimum 100 CPV']
        });
      }

      if (summary.productBonus) {
        bonuses.push({
          id: 'b-product',
          name: 'Product Purchase Bonus',
          description: 'Earn from every product purchase in your downline.',
          qualificationStatus: 'Qualified',
          earnedStatus: 'Earned',
          amount: summary.productBonus,
          currency: 'NGN',
          requirements: ['Active account', 'Downline purchases']
        });
      }

      if (summary.matchingBonus || matchingStatus) {
        const amount = matchingStatus?.totalAmount ?? summary.matchingBonus ?? 0;
        const qualified = matchingStatus?.qualified ?? false;
        const currency = matchingStatus?.currency ?? 'NGN';

        const requirements: string[] = [];
        if (matchingStatus?.message) {
          requirements.push(matchingStatus.message);
        } else if (
          matchingStatus?.requiredSameOrHigherPackage != null &&
          matchingStatus.currentDirectReferrals != null
        ) {
          requirements.push(
            `Direct referrals with paid registration: ${matchingStatus.currentDirectReferrals}/${matchingStatus.requiredSameOrHigherPackage}`
          );
        }
        if (requirements.length === 0) {
          requirements.push('Refer 3 accounts with paid registration (same or higher package)');
        }

        const qualificationStatus: BonusInfo['qualificationStatus'] =
          qualified ? 'Qualified' : amount > 0 ? 'In Progress' : 'Not Qualified';
        const earnedStatus: BonusInfo['earnedStatus'] =
          amount > 0 && qualified ? 'Earned' : amount > 0 ? 'Pending' : 'Locked';

        bonuses.push({
          id: 'b-matching',
          name: 'Matching Bonus',
          description: 'Match a percentage of your direct referrals\' earnings. Requires 3 direct referrals with paid registration.',
          qualificationStatus,
          earnedStatus,
          amount,
          currency,
          requirements
        });
      }

      const cpv = this.earningsService.cpvSummary();
      if (cpv.cpvCashBonus) {
        bonuses.push({
          id: 'b-cpv-cash',
          name: 'CPV Cash Bonus',
          description: 'Cash bonus earned from reaching CPV milestones.',
          qualificationStatus: 'Qualified',
          earnedStatus: 'Earned',
          amount: cpv.cpvCashBonus,
          currency: 'NGN',
          requirements: ['Reach CPV milestones']
        });
      }

      // If no bonuses earned yet, show placeholder cards
      if (bonuses.length === 0) {
        bonuses.push(
          {
            id: 'b-direct-locked',
            name: 'Direct Referral Bonus',
            description: 'Earn a percentage of each direct referral\'s registration fee.',
            qualificationStatus: 'Not Qualified',
            earnedStatus: 'Locked',
            requirements: ['Active account', 'At least 1 direct referral']
          },
          {
            id: 'b-community-locked',
            name: 'Community Bonus',
            description: 'Share in the global community pool based on your activity level.',
            qualificationStatus: 'Not Qualified',
            earnedStatus: 'Locked',
            requirements: ['Active account', 'Minimum 100 CPV']
          },
          {
            id: 'b-matching-locked',
            name: 'Matching Bonus',
            description: 'Match a percentage of your direct referrals\' earnings.',
            qualificationStatus: 'Not Qualified',
            earnedStatus: 'Locked',
            requirements: ['Silver rank or higher', '5+ active direct referrals']
          }
        );
      }

      return bonuses;
    });
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
          achievedRanks: r.achievedRanks,
          stageBonuses: r.stageBonuses
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

  getCpvHistory() {
    return computed(() => this.earningsService.cpvSummary().history);
  }

  getCpvSummary() {
    return computed<CpvSummary>(() => {
      const cpv = this.earningsService.cpvSummary();
      const totalCpv = cpv.personalCpv + cpv.teamCpv;
      // Find the next unachieved milestone
      const nextMilestone = cpv.milestones.find((m) => !m.achieved);
      return {
        totalCpv,
        personalCpv: cpv.personalCpv,
        teamCpv: cpv.teamCpv,
        currentStage: cpv.currentStage,
        totalStages: cpv.totalStages,
        cpvCashBonus: cpv.cpvCashBonus,
        nextMilestoneCpv: nextMilestone?.cpvRequired ?? (cpv.requiredCpv || 1),
        nextMilestoneReward: nextMilestone
          ? `${nextMilestone.name} — ${nextMilestone.reward}`
          : (cpv.nextMilestoneName || (cpv.requiredCpv ? `Next milestone at ${cpv.requiredCpv} CPV` : '—'))
      };
    });
  }

  getMilestones() {
    return computed<MilestoneInfo[]>(() => {
      const cpv = this.earningsService.cpvSummary();
      if (cpv.milestones.length > 0) {
        return cpv.milestones.map((m, i) => ({
          id: `m-${i}`,
          name: m.name,
          description: m.achieved
            ? `Achieved — ${m.reward}`
            : `Reach ${m.cpvRequired} CPV to unlock ${m.reward}`,
          cpvRequired: m.cpvRequired,
          reward: m.reward,
          rewardAmount: m.rewardAmount,
          materialReward: m.materialReward,
          achieved: m.achieved,
          achievedDate: m.achievedDate,
          progressPercent: m.progressPercent
        }));
      }
      // Fallback: no milestones from API yet
      return [];
    });
  }
}

