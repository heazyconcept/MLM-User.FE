import { Injectable, inject, signal } from '@angular/core';
import { Observable, of, forkJoin } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { SettingsService } from './settings.service';

export interface EarningsEntryDto {
  id: string;
  date: string;
  type: string;
  amount: number;
  currency: 'NGN' | 'USD';
  status: string;
  source: string;
  level?: number;
}

export interface StageBonusDto {
  stage: number;
  rankName: string;
  bonusAmount: number;
  earned: number;
  paidAt: string | null;
}

export interface RankingDto {
  currentRank: string;
  currentStage: number;
  totalStages: number;
  nextRank: string;
  progressPercentage: number;
  requirements: { label: string; current: number; required: number; completed: boolean }[];
  achievedRanks: { rank: string; achievedDate: string }[];
  stageBonuses?: StageBonusDto[];
}

export interface CpvMilestoneDto {
  name: string;
  cpvRequired: number;
  reward: string;
  rewardAmount?: number;
  materialReward?: string;
  achieved: boolean;
  achievedDate?: string;
  progressPercent?: number;
}

export interface CpvHistoryDto {
  date: string;
  personalCpv: number;
  teamCpv: number;
  totalCpv: number;
  source?: string;
  pvType?: string;
}

export interface CpvSummaryDto {
  personalCpv: number;
  teamCpv: number;
  requiredCpv: number;
  cycle: string;
  currentStage: number;
  totalStages: number;
  cpvCashBonus: number;
  nextMilestoneName: string;
  milestones: CpvMilestoneDto[];
  history: CpvHistoryDto[];
}

export interface MatchingBonusStatusDto {
  qualified: boolean;
  totalAmount: number;
  currency: 'NGN' | 'USD';
  message?: string;
  currentDirectReferrals?: number;
  requiredDirectReferrals?: number;
  currentSameOrHigherPackage?: number;
  requiredSameOrHigherPackage?: number;
}

export interface CommunityBonusLevel {
  level: number;
  amount: number;
  currency: 'NGN' | 'USD';
}

export interface EarningsSummaryDto {
  totalEarnings: number;
  directReferralBonus: number;
  communityBonus?: number;
  productBonus?: number;
  matchingBonus?: number;
  pdpaEarnings?: number;
  cdpaEarnings?: number;
  fromDirectReferrals?: number;
  fromTeamCpv?: number;
  personalSales?: number;
  pppcEarnings?: number;
  drppcEarnings?: number;
  cppcEarnings?: number;
  repeatProductPurchase?: number;
  leadershipBonus?: number;
  rankingBonus?: number;
  cpvCashBonus?: number;
  cpvMilestoneIncentive?: number;
  instantRegistrationPv?: number;
  communityRegistrationPv?: number;
  productVoucherBalance?: number;
  cashoutEligible?: number;
  autoshipBalance?: number;
  cashoutPercentage?: number;
  autoshipPercentage?: number;
  monthlyAutoshipAmountUsd?: number;
  communityBonusByLevel?: CommunityBonusLevel[];
  byType?: Record<string, number>;
}

@Injectable({
  providedIn: 'root'
})
export class EarningsService {
  private api = inject(ApiService);
  private settingsService = inject(SettingsService);

  private cpvSignal = signal<CpvSummaryDto>({
    personalCpv: 0,
    teamCpv: 0,
    requiredCpv: 0,
    cycle: '',
    currentStage: 0,
    totalStages: 0,
    cpvCashBonus: 0,
    nextMilestoneName: '',
    milestones: [],
    history: []
  });

  private earningsSummarySignal = signal<EarningsSummaryDto>({
    totalEarnings: 0,
    directReferralBonus: 0
  });

  private matchingBonusStatusSignal = signal<MatchingBonusStatusDto | null>(null);

  readonly cpvSummary = this.cpvSignal.asReadonly();
  readonly earningsSummary = this.earningsSummarySignal.asReadonly();
  readonly matchingBonusStatus = this.matchingBonusStatusSignal.asReadonly();

  private earningsListSignal = signal<EarningsEntryDto[]>([]);
  private rankingSignal = signal<RankingDto | null>(null);
  readonly earningsList = this.earningsListSignal.asReadonly();
  readonly ranking = this.rankingSignal.asReadonly();
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  /** Orchestrated fetch for commissions section (list + summary + cpv + ranking) */
  fetchEarningsSectionData(): void {
    this.isLoading.set(true);
    this.error.set(null);
    forkJoin({
      list: this.fetchEarningsList(50, 0),
      summary: this.fetchEarningsSummary(),
      cpv: this.fetchCpvSummary(),
      ranking: this.fetchRanking(),
      matching: this.fetchMatchingBonusStatus(),
      settings: this.settingsService.fetchAll()
    }).subscribe({
      next: () => this.isLoading.set(false),
      error: (err) => {
        this.error.set('Failed to load earnings data. Please try again.');
        this.isLoading.set(false);
        if (typeof ngDevMode !== 'undefined' && ngDevMode) {
          console.error('[EarningsService] fetchEarningsSectionData failed:', err);
        }
      }
    });
  }

  fetchEarningsList(limit = 50, offset = 0): Observable<EarningsEntryDto[]> {
    const params = { limit: String(limit), offset: String(offset) };
    return this.api.get<Record<string, unknown>[] | Record<string, unknown>>('earnings', params).pipe(
      map((res) => this.mapEarningsListResponse(res)),
      tap((list) => this.earningsListSignal.set(list)),
      catchError((err: { status?: number }) => {
        this.error.set((err as { status?: number })?.status === 403 ? 'Registration payment required.' : 'Failed to load earnings data.');
        this.earningsListSignal.set([]);
        return of([]);
      })
    );
  }

  fetchRanking(): Observable<RankingDto | null> {
    return this.api.get<Record<string, unknown>>('earnings/ranking').pipe(
      map((res) => this.mapRankingResponse(res)),
      tap((r) => this.rankingSignal.set(r)),
      catchError((err: { status?: number }) => {
        this.error.set((err as { status?: number })?.status === 403 ? 'Registration payment required.' : 'Failed to load earnings data.');
        this.rankingSignal.set(null);
        return of(null);
      })
    );
  }

  fetchCpvSummary(): Observable<CpvSummaryDto> {
    return this.api.get<Record<string, unknown>>('earnings/cpv').pipe(
      tap((res) => console.log('[EarningsService] Raw CPV response:', JSON.stringify(res, null, 2))),
      map((res) => this.mapCpvResponse(res)),
      tap((cpv) => this.cpvSignal.set(cpv)),
      catchError(() => {
        this.cpvSignal.set({
          personalCpv: 0, teamCpv: 0, requiredCpv: 0, cycle: '',
          currentStage: 0, totalStages: 0, cpvCashBonus: 0,
          nextMilestoneName: '', milestones: [], history: []
        });
        return of(this.cpvSignal());
      })
    );
  }

  fetchEarningsSummary(): Observable<EarningsSummaryDto> {
    return this.api.get<Record<string, unknown>>('earnings/summary').pipe(
      map((res) => this.mapEarningsResponse(res)),
      tap((summary) => this.earningsSummarySignal.set(summary)),
      catchError(() => {
        this.earningsSummarySignal.set({ totalEarnings: 0, directReferralBonus: 0 });
        return of(this.earningsSummarySignal());
      })
    );
  }

  fetchMatchingBonusStatus(): Observable<MatchingBonusStatusDto | null> {
    return this.api.get<Record<string, unknown>>('earnings/matching-bonus-status').pipe(
      map((raw) => this.mapMatchingBonusStatus(raw)),
      tap((status) => this.matchingBonusStatusSignal.set(status)),
      catchError(() => {
        this.matchingBonusStatusSignal.set(null);
        return of(null);
      })
    );
  }

  private mapCpvResponse(raw: Record<string, unknown>): CpvSummaryDto {
    // API shape: { totalCpv, lastUpdated, transactions[], milestones[], milestonesAchieved[], cpvCashBonus }
    const totalCpv = Number(raw['totalCpv'] ?? 0);

    // API doesn't split into personal/team — put totalCpv as personal for now
    const personalCpv = totalCpv;
    const teamCpv = 0;

    const requiredCpv = Number(raw['requiredCpv'] ?? raw['required_cpv'] ?? 0);
    const cycle = String(raw['cycle'] ?? raw['lastUpdated'] ?? '');
    const currentStage = Number(raw['currentStage'] ?? raw['stage'] ?? 0);
    const totalStages = Number(raw['totalStages'] ?? 0);
    const cpvCashBonus = Number(raw['cpvCashBonus'] ?? raw['cashBonus'] ?? 0);
    const nextMilestoneName = String(raw['nextMilestoneName'] ?? '');

    // Map milestones — API returns milestones[] with progressPercent, materialDescription
    const rawMilestones = (raw['milestones'] ?? []) as Record<string, unknown>[];
    const milestones: CpvMilestoneDto[] = rawMilestones.map((m) => ({
      name: String(m['name'] ?? m['title'] ?? ''),
      cpvRequired: Number(m['cpvRequired'] ?? m['requiredCpv'] ?? m['threshold'] ?? 0),
      reward: String(m['reward'] ?? m['rewardName'] ?? m['rewardType'] ?? ''),
      rewardAmount: m['rewardAmount'] != null ? Number(m['rewardAmount']) : undefined,
      materialReward: m['materialDescription'] ? String(m['materialDescription']) : undefined,
      achieved: Boolean(m['achieved'] ?? m['completed'] ?? false),
      achievedDate: m['achievedDate'] ? String(m['achievedDate']) : undefined,
      progressPercent: m['progressPercent'] != null ? Number(m['progressPercent']) : undefined
    }));

    // Map transactions as history (API returns transactions[])
    const rawTxns = (raw['transactions'] ?? raw['history'] ?? []) as Record<string, unknown>[];
    const history: CpvHistoryDto[] = rawTxns.map((t) => ({
      date: String(t['createdAt'] ?? t['date'] ?? ''),
      personalCpv: Number(t['amount'] ?? 0),
      teamCpv: 0,
      totalCpv: Number(t['amount'] ?? 0),
      source: t['source'] ? String(t['source']) : undefined,
      pvType: t['pvType'] ? String(t['pvType']) : undefined
    }));

    return {
      personalCpv,
      teamCpv,
      requiredCpv,
      cycle,
      currentStage,
      totalStages,
      cpvCashBonus,
      nextMilestoneName,
      milestones,
      history
    };
  }

  private mapEarningsResponse(raw: Record<string, unknown>): EarningsSummaryDto {
    const earnings = raw['earnings'] as Record<string, unknown> | undefined;
    const byType = (raw['byType'] ?? raw['breakdown'] ?? earnings?.['byType'] ?? {}) as Record<string, number>;

    // Map communityBonusByLevel array
    const rawCommunityLevels = (raw['communityBonusByLevel'] ?? earnings?.['communityBonusByLevel'] ?? []) as Record<string, unknown>[];
    const communityBonusByLevel: CommunityBonusLevel[] = rawCommunityLevels.map((l) => ({
      level: Number(l['level'] ?? 0),
      amount: Number(l['amount'] ?? 0),
      currency: (String(l['currency'] ?? 'NGN') === 'USD' ? 'USD' : 'NGN') as 'NGN' | 'USD'
    }));

    return {
      totalEarnings: Number(raw['totalEarned'] ?? earnings?.['totalEarned'] ?? raw['totalEarnings'] ?? 0),
      directReferralBonus: Number(
        byType['DIRECT_REFERRAL'] ?? raw['directReferralBonus'] ?? earnings?.['directReferralBonus'] ?? 0
      ),
      communityBonus: Number(
        byType['COMMUNITY_REFERRAL'] ?? raw['communityBonus'] ?? earnings?.['communityBonus'] ?? 0
      ),
      productBonus: Number(raw['productBonus'] ?? 0),
      matchingBonus: Number(byType['MATCHING_BONUS'] ?? raw['matchingBonus'] ?? 0),
      pdpaEarnings: Number(byType['PDPA'] ?? raw['pdpaEarnings'] ?? 0),
      cdpaEarnings: Number(byType['CDPA'] ?? raw['cdpaEarnings'] ?? 0),
      pppcEarnings: Number(byType['PERSONAL_PRODUCT_PURCHASE'] ?? raw['pppcEarnings'] ?? 0),
      drppcEarnings: Number(byType['DIRECT_REFERRAL_PRODUCT_PURCHASE'] ?? raw['drppcEarnings'] ?? 0),
      cppcEarnings: Number(byType['COMMUNITY_PRODUCT_PURCHASE'] ?? raw['cppcEarnings'] ?? 0),
      repeatProductPurchase: Number(byType['REPEAT_PRODUCT_PURCHASE'] ?? 0),
      leadershipBonus: Number(byType['LEADERSHIP_BONUS'] ?? raw['leadershipBonus'] ?? 0),
      rankingBonus: Number(byType['RANKING_BONUS'] ?? raw['rankingBonus'] ?? 0),
      cpvCashBonus: Number(byType['CPV_CASH_BONUS'] ?? raw['cpvCashBonus'] ?? 0),
      cpvMilestoneIncentive: Number(byType['CPV_MILESTONE_INCENTIVE'] ?? 0),
      fromDirectReferrals: Number(raw['fromDirectReferrals'] ?? 0),
      fromTeamCpv: Number(raw['fromTeamCpv'] ?? 0),
      personalSales: Number(raw['personalSales'] ?? 0),
      instantRegistrationPv: Number(raw['instantRegistrationPv'] ?? earnings?.['instantRegistrationPv'] ?? 0),
      communityRegistrationPv: Number(raw['communityRegistrationPv'] ?? earnings?.['communityRegistrationPv'] ?? 0),
      productVoucherBalance: Number(raw['productVoucherBalance'] ?? earnings?.['productVoucherBalance'] ?? 0),
      cashoutEligible: Number(raw['cashoutEligible'] ?? 0),
      autoshipBalance: Number(raw['autoshipBalance'] ?? 0),
      cashoutPercentage: Number(raw['cashoutPercentage'] ?? 65),
      autoshipPercentage: Number(raw['autoshipPercentage'] ?? 35),
      monthlyAutoshipAmountUsd: Number(raw['monthlyAutoshipAmountUsd'] ?? 10),
      communityBonusByLevel,
      byType
    };
  }

  private mapMatchingBonusStatus(raw: Record<string, unknown>): MatchingBonusStatusDto {
    const qualified = Boolean(raw['qualified'] ?? raw['isQualified'] ?? raw['eligible'] ?? false);
    const currency = String(raw['currency'] ?? 'NGN') === 'USD' ? 'USD' : 'NGN';
    const totalAmount = Number(
      raw['totalAmount'] ?? raw['total'] ?? raw['amount'] ?? raw['totalMatchingBonus'] ?? 0
    );
    const message = raw['message'] ? String(raw['message']) : undefined;

    // API returns: directReferralsCount, requiredSameOrHigherPackage
    const directReferralsCount = raw['directReferralsCount'] ?? raw['currentDirectReferrals'] ?? raw['directReferrals'];
    const requiredSameOrHigherPackage = raw['requiredSameOrHigherPackage'] ?? raw['requiredDirectReferrals'] ?? raw['required'];

    return {
      qualified,
      totalAmount,
      currency,
      message,
      currentDirectReferrals: directReferralsCount != null ? Number(directReferralsCount) : undefined,
      requiredDirectReferrals: requiredSameOrHigherPackage != null ? Number(requiredSameOrHigherPackage) : undefined,
      currentSameOrHigherPackage: directReferralsCount != null ? Number(directReferralsCount) : undefined,
      requiredSameOrHigherPackage: requiredSameOrHigherPackage != null ? Number(requiredSameOrHigherPackage) : undefined
    };
  }

  private mapEarningsListResponse(
    res: Record<string, unknown>[] | Record<string, unknown>
  ): EarningsEntryDto[] {
    const arr = Array.isArray(res)
      ? res
      : (res['data'] ?? res['items'] ?? res['earnings'] ?? []) as Record<string, unknown>[];
    return arr.map((raw) => this.mapEarningsEntry(raw));
  }

  private mapEarningsEntry(raw: Record<string, unknown>): EarningsEntryDto {
    const type =
      String(raw['earningType'] ?? raw['type'] ?? raw['ledgerEarningType'] ?? raw['source'] ?? 'Bonus');
    const level = raw['level'] != null ? Number(raw['level']) : undefined;

    // For community referral, use level in source display
    let source = String(
      raw['source'] ?? raw['narrative'] ?? raw['description'] ?? raw['reference'] ?? '—'
    );
    if (type.toUpperCase() === 'COMMUNITY_REFERRAL' && level != null) {
      source = `Level ${level}`;
    }

    const status = String(raw['status'] ?? raw['earningStatus'] ?? 'Approved');
    const currency = (raw['currency'] ?? raw['displayCurrency'] ?? 'NGN') as 'NGN' | 'USD';
    const date = raw['createdAt'] ?? raw['creditedAt'] ?? raw['date'] ?? raw['timestamp'] ?? new Date().toISOString();
    return {
      id: String(raw['id'] ?? raw['ledgerEntryId'] ?? crypto.randomUUID()),
      date: String(date),
      type: this.normalizeEarningType(type),
      amount: Number(raw['amount'] ?? raw['credit'] ?? 0),
      currency: currency === 'USD' ? 'USD' : 'NGN',
      status: this.normalizeEarningStatus(status),
      source,
      level
    };
  }

  /** Map canonical LedgerEarningType enum values to display labels */
  private normalizeEarningType(type: string): string {
    const t = type.toUpperCase().trim();
    // Canonical LedgerEarningType enum matches
    switch (t) {
      case 'PDPA': return 'PDPA';
      case 'CDPA': return 'CDPA';
      case 'DIRECT_REFERRAL': return 'Direct Referral';
      case 'COMMUNITY_REFERRAL': return 'Community Bonus';
      case 'PERSONAL_PRODUCT_PURCHASE': return 'Personal Product Commission';
      case 'DIRECT_REFERRAL_PRODUCT_PURCHASE': return 'Direct Referral Product Commission';
      case 'COMMUNITY_PRODUCT_PURCHASE': return 'Community Product Commission';
      case 'REPEAT_PRODUCT_PURCHASE': return 'Repeat Purchase Bonus';
      case 'MATCHING_BONUS': return 'Matching Bonus';
      case 'RANKING_BONUS': return 'Ranking Bonus';
      case 'CPV_CASH_BONUS': return 'CPV Cash Bonus';
      case 'CPV_MILESTONE_INCENTIVE': return 'CPV Milestone';
      case 'LEADERSHIP_BONUS': return 'Leadership Bonus';
      case 'MERCHANT_PERSONAL_PRODUCT': return 'Merchant Personal Product';
      case 'MERCHANT_DIRECT_REFERRAL_PRODUCT': return 'Merchant Direct Referral Product';
      case 'MERCHANT_COMMUNITY_PRODUCT': return 'Merchant Community Product';
      case 'MERCHANT_DELIVERY_BONUS': return 'Merchant Delivery Bonus';
      default: break;
    }
    // Fallback: fuzzy matching for any non-canonical strings
    if (t.includes('DIRECT_REFERRAL') || t.includes('DIRECT REFERRAL')) return 'Direct Referral';
    if (t.includes('PERSONAL_PRODUCT') || t.includes('PERSONAL PRODUCT')) return 'Personal Product Commission';
    if (t.includes('COMMUNITY_PRODUCT') || t.includes('COMMUNITY PRODUCT')) return 'Community Product Commission';
    if (t.includes('COMMUNITY')) return 'Community Bonus';
    if (t.includes('MATCHING')) return 'Matching Bonus';
    if (t.includes('LEADERSHIP')) return 'Leadership Bonus';
    if (t.includes('MERCHANT')) return 'Merchant Bonus';
    if (t.includes('CPV') || t.includes('RANKING')) return 'Level Commission';
    if (t.includes('PRODUCT')) return 'Product Bonus';
    return 'Bonus';
  }

  private normalizeEarningStatus(status: string): string {
    const s = status.toUpperCase();
    if (s.includes('PENDING') || s === 'PENDING') return 'Pending';
    if (s.includes('APPROVED') || s.includes('CREDITED') || s === 'SUCCESS') return 'Approved';
    if (s.includes('LOCKED')) return 'Locked';
    return 'Approved';
  }

  private mapRankingResponse(raw: Record<string, unknown>): RankingDto | null {
    if (!raw || Object.keys(raw).length === 0) return null;
    const rank = raw['rank'] as Record<string, unknown> | undefined;
    const rawStageBonuses = (raw['stageBonuses'] ?? []) as Record<string, unknown>[];

    // Map stageBonuses from API: { stage, rankName, bonusAmount, earned, paidAt }
    const stageBonuses: StageBonusDto[] = rawStageBonuses.map((s) => ({
      stage: Number(s['stage'] ?? 0),
      rankName: String(s['rankName'] ?? s['rank'] ?? '—'),
      bonusAmount: Number(s['bonusAmount'] ?? s['bonus'] ?? 0),
      earned: Number(s['earned'] ?? 0),
      paidAt: s['paidAt'] != null ? String(s['paidAt']) : null
    }));

    const currentRank = String(raw['currentRank'] ?? rank?.['currentRank'] ?? raw['rank'] ?? '—');
    const currentStage = Number(raw['currentStage'] ?? rank?.['currentStage'] ?? raw['stage'] ?? 0);
    const totalStages =
      stageBonuses.length > 0
        ? stageBonuses.length
        : Number(raw['totalStages'] ?? rank?.['totalStages'] ?? 5);

    // Derive requirements and achievedRanks from stageBonuses when available
    let requirements: { label: string; current: number; required: number; completed: boolean }[];
    let achievedRanks: { rank: string; achievedDate: string }[];
    let nextRank: string;
    let progressPercentage: number;

    if (stageBonuses.length > 0) {
      requirements = stageBonuses.map((s) => {
        const completed = s.earned >= s.bonusAmount || s.paidAt != null;
        return {
          label: s.rankName,
          current: s.earned,
          required: s.bonusAmount,
          completed
        };
      });
      achievedRanks = stageBonuses
        .filter((s) => s.paidAt != null || s.earned >= s.bonusAmount)
        .map((s) => ({
          rank: s.rankName,
          achievedDate: s.paidAt ?? ''
        }));
      const nextStage = stageBonuses.find((s) => s.earned < s.bonusAmount && s.paidAt == null);
      nextRank = nextStage ? nextStage.rankName : (stageBonuses[stageBonuses.length - 1]?.rankName ?? '—');
      progressPercentage = totalStages > 0 ? Math.min(100, (currentStage / totalStages) * 100) : 0;
    } else {
      const reqs = (raw['requirements'] ?? rank?.['requirements'] ?? []) as Record<string, unknown>[];
      const achieved = (raw['achievedRanks'] ?? raw['milestonesAchieved'] ?? rank?.['achievedRanks'] ?? []) as Record<string, unknown>[];
      requirements = reqs.map((r) => ({
        label: String(r['label'] ?? r['name'] ?? '—'),
        current: Number(r['current'] ?? r['value'] ?? 0),
        required: Number(r['required'] ?? r['target'] ?? 0),
        completed: Boolean(r['completed'] ?? r['achieved'])
      }));
      achievedRanks = achieved.map((a) => ({
        rank: String(a['rank'] ?? a['name'] ?? '—'),
        achievedDate: String(a['achievedDate'] ?? a['date'] ?? a['achievedAt'] ?? '')
      }));
      nextRank = String(raw['nextRank'] ?? rank?.['nextRank'] ?? '—');
      progressPercentage = Number(raw['progressPercentage'] ?? rank?.['progressPercentage'] ?? 0);
    }

    return {
      currentRank,
      currentStage,
      totalStages,
      nextRank,
      progressPercentage,
      requirements,
      achievedRanks,
      stageBonuses: stageBonuses.length > 0 ? stageBonuses : undefined
    };
  }
}
