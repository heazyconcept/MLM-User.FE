import { Injectable, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { of } from 'rxjs';
import { ApiService } from './api.service';

export interface CpvSummaryDto {
  personalCpv: number;
  teamCpv: number;
  requiredCpv: number;
  cycle: string;
}

export interface EarningsSummaryDto {
  totalEarnings: number;
  directReferralBonus: number;
  communityBonus?: number;
  productBonus?: number;
  matchingBonus?: number;
  fromDirectReferrals?: number;
  fromTeamCpv?: number;
  personalSales?: number;
}

@Injectable({
  providedIn: 'root'
})
export class EarningsService {
  private api = inject(ApiService);

  private cpvSignal = signal<CpvSummaryDto>({
    personalCpv: 0,
    teamCpv: 0,
    requiredCpv: 0,
    cycle: ''
  });

  private earningsSummarySignal = signal<EarningsSummaryDto>({
    totalEarnings: 0,
    directReferralBonus: 0
  });

  readonly cpvSummary = this.cpvSignal.asReadonly();
  readonly earningsSummary = this.earningsSummarySignal.asReadonly();

  fetchCpvSummary(): Observable<CpvSummaryDto> {
    return this.api.get<Record<string, unknown>>('earnings/cpv').pipe(
      map((res) => this.mapCpvResponse(res)),
      tap((cpv) => this.cpvSignal.set(cpv)),
      catchError(() => {
        this.cpvSignal.set({ personalCpv: 0, teamCpv: 0, requiredCpv: 0, cycle: '' });
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

  private mapCpvResponse(raw: Record<string, unknown>): CpvSummaryDto {
    const cpv = raw['cpv'] as Record<string, unknown> | undefined;
    const personal = cpv?.['personal'] ?? raw['personalCpv'] ?? raw['personal_cpv'] ?? 0;
    const team = raw['teamCpv'] ?? raw['team_cpv'] ?? cpv?.['community'] ?? cpv?.['team'] ?? 0;
    const required = raw['requiredCpv'] ?? raw['required_cpv'] ?? raw['nextMilestoneCpv'] ?? 0;
    const cycle = raw['cycle'] ?? raw['currentCycle'] ?? raw['current_cycle'] ?? '';
    return {
      personalCpv: Number(personal),
      teamCpv: Number(team),
      requiredCpv: Number(required),
      cycle: String(cycle)
    };
  }

  private mapEarningsResponse(raw: Record<string, unknown>): EarningsSummaryDto {
    const earnings = raw['earnings'] as Record<string, unknown> | undefined;
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
      fromDirectReferrals: Number(raw['fromDirectReferrals'] ?? raw['from_direct_referrals'] ?? 0),
      fromTeamCpv: Number(raw['fromTeamCpv'] ?? raw['from_team_cpv'] ?? 0),
      personalSales: Number(raw['personalSales'] ?? raw['personal_sales'] ?? 0)
    };
  }
}
