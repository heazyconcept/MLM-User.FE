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
}

export interface RankingDto {
  currentRank: string;
  currentStage: number;
  totalStages: number;
  nextRank: string;
  progressPercentage: number;
  requirements: { label: string; current: number; required: number; completed: boolean }[];
  achievedRanks: { rank: string; achievedDate: string }[];
}

export interface CpvMilestoneDto {
  name: string;
  cpvRequired: number;
  reward: string;
  rewardAmount?: number;
  achieved: boolean;
  achievedDate?: string;
}

export interface CpvHistoryDto {
  date: string;
  personalCpv: number;
  teamCpv: number;
  totalCpv: number;
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
  currentDirectReferrals?: number;
  requiredDirectReferrals?: number;
  currentSameOrHigherPackage?: number;
  requiredSameOrHigherPackage?: number;
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
    // Actual API shape: { totalCpv, lastUpdated, transactions[] }
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

    // Map milestones if present
    const rawMilestones = (raw['milestones'] ?? []) as Record<string, unknown>[];
    const milestones: CpvMilestoneDto[] = rawMilestones.map((m) => ({
      name: String(m['name'] ?? m['title'] ?? ''),
      cpvRequired: Number(m['cpvRequired'] ?? m['requiredCpv'] ?? m['threshold'] ?? 0),
      reward: String(m['reward'] ?? m['rewardName'] ?? ''),
      rewardAmount: m['rewardAmount'] != null ? Number(m['rewardAmount']) : undefined,
      achieved: Boolean(m['achieved'] ?? m['completed'] ?? false),
      achievedDate: m['achievedDate'] ? String(m['achievedDate']) : undefined
    }));

    // Map transactions as history (API returns transactions[], not history[])
    const rawTxns = (raw['transactions'] ?? raw['history'] ?? []) as Record<string, unknown>[];
    const history: CpvHistoryDto[] = rawTxns.map((t) => ({
      date: String(t['createdAt'] ?? t['date'] ?? ''),
      personalCpv: Number(t['amount'] ?? 0),
      teamCpv: 0,
      totalCpv: Number(t['amount'] ?? 0)
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
    const byType = (raw['byType'] ?? raw['breakdown'] ?? earnings?.['byType']) as Record<string, unknown> | undefined;
    return {
      totalEarnings: Number(earnings?.['totalEarned'] ?? raw['totalEarnings'] ?? raw['total_earnings'] ?? 0),
      directReferralBonus: Number(
        earnings?.['directReferralBonus'] ?? raw['directReferralBonus'] ?? raw['direct_referral_bonus'] ?? 0
      ),
      communityBonus: Number(
        earnings?.['communityBonus'] ?? raw['communityBonus'] ?? raw['community_bonus'] ?? 0
      ),
      productBonus: Number(raw['productBonus'] ?? raw['product_bonus'] ?? 0),
      matchingBonus: Number(raw['matchingBonus'] ?? raw['matching_bonus'] ?? 0),
      pdpaEarnings: Number(
        byType?.['PDPA'] ?? raw['pdpaEarnings'] ?? raw['pdpa'] ?? earnings?.['pdpa'] ?? 0
      ),
      cdpaEarnings: Number(
        byType?.['CDPA'] ?? raw['cdpaEarnings'] ?? raw['cdpa'] ?? earnings?.['cdpa'] ?? 0
      ),
      fromDirectReferrals: Number(raw['fromDirectReferrals'] ?? raw['from_direct_referrals'] ?? 0),
      fromTeamCpv: Number(raw['fromTeamCpv'] ?? raw['from_team_cpv'] ?? 0),
      personalSales: Number(raw['personalSales'] ?? raw['personal_sales'] ?? 0)
    };
  }

  private mapMatchingBonusStatus(raw: Record<string, unknown>): MatchingBonusStatusDto {
    const qualified = Boolean(raw['qualified'] ?? raw['isQualified'] ?? raw['eligible'] ?? false);
    const currency = String(raw['currency'] ?? 'NGN') === 'USD' ? 'USD' : 'NGN';
    const totalAmount = Number(
      raw['totalAmount'] ?? raw['total'] ?? raw['amount'] ?? raw['totalMatchingBonus'] ?? 0
    );

    const currentDirectReferrals = raw['currentDirectReferrals'] ?? raw['directReferrals'] ?? raw['current'] ?? undefined;
    const requiredDirectReferrals = raw['requiredDirectReferrals'] ?? raw['required'] ?? undefined;
    const currentSameOrHigherPackage = raw['currentSameOrHigherPackage'] ?? raw['sameOrHigherPackageCount'] ?? undefined;
    const requiredSameOrHigherPackage = raw['requiredSameOrHigherPackage'] ?? raw['sameOrHigherPackageRequired'] ?? undefined;

    return {
      qualified,
      totalAmount,
      currency,
      currentDirectReferrals: currentDirectReferrals != null ? Number(currentDirectReferrals) : undefined,
      requiredDirectReferrals: requiredDirectReferrals != null ? Number(requiredDirectReferrals) : undefined,
      currentSameOrHigherPackage: currentSameOrHigherPackage != null ? Number(currentSameOrHigherPackage) : undefined,
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
      String(raw['type'] ?? raw['earningType'] ?? raw['ledgerEarningType'] ?? raw['source'] ?? 'Bonus');
    const source = String(
      raw['source'] ?? raw['narrative'] ?? raw['description'] ?? raw['reference'] ?? '—'
    );
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
      source
    };
  }

  private normalizeEarningType(type: string): string {
    const t = type.toUpperCase();
    if (t.includes('DIRECT_REFERRAL') || t.includes('DIRECT REFERRAL')) return 'Direct Referral';
    if (t === 'PDPA' || t.includes('PERSONAL_DAILY') || t.includes('PERSONAL DAILY')) return 'PDPA';
    if (t === 'CDPA' || t.includes('COMMUNITY_DAILY') || t.includes('COMMUNITY DAILY')) return 'CDPA';
    if (t.includes('COMMUNITY')) return 'Community Bonus';
    if (t.includes('PRODUCT')) return 'Product Bonus';
    if (t.includes('MATCHING')) return 'Matching Bonus';
    if (t.includes('LEADERSHIP')) return 'Leadership Bonus';
    if (t.includes('MERCHANT')) return 'Merchant Bonus';
    if (t.includes('CPV') || t.includes('RANKING')) return 'Level Commission';
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
    const reqs = (raw['requirements'] ?? rank?.['requirements'] ?? []) as Record<string, unknown>[];
    const achieved = (raw['achievedRanks'] ?? raw['milestonesAchieved'] ?? rank?.['achievedRanks'] ?? []) as Record<string, unknown>[];
    return {
      currentRank: String(raw['currentRank'] ?? rank?.['currentRank'] ?? raw['rank'] ?? '—'),
      currentStage: Number(raw['currentStage'] ?? rank?.['currentStage'] ?? raw['stage'] ?? 0),
      totalStages: Number(raw['totalStages'] ?? rank?.['totalStages'] ?? 5),
      nextRank: String(raw['nextRank'] ?? rank?.['nextRank'] ?? '—'),
      progressPercentage: Number(raw['progressPercentage'] ?? rank?.['progressPercentage'] ?? 0),
      requirements: reqs.map((r) => ({
        label: String(r['label'] ?? r['name'] ?? '—'),
        current: Number(r['current'] ?? r['value'] ?? 0),
        required: Number(r['required'] ?? r['target'] ?? 0),
        completed: Boolean(r['completed'] ?? r['achieved'])
      })),
      achievedRanks: achieved.map((a) => ({
        rank: String(a['rank'] ?? a['name'] ?? '—'),
        achievedDate: String(a['achievedDate'] ?? a['date'] ?? a['achievedAt'] ?? '')
      }))
    };
  }
}
