import { Injectable, inject, signal } from '@angular/core';
import { Observable, of, forkJoin } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { ApiService } from './api.service';

export interface LevelCommissionRule {
  level: number;
  stage: number;
  rank: string;
  percentages: Record<string, number>;
  rankingBonusUsd: number | null;
}

export interface CommissionRulesDto {
  levels: LevelCommissionRule[];
  pdpaRates?: Record<string, number>;
  cdpaRates?: Record<string, number>;
  cashoutSplit?: Record<string, number>;
  autoshipSplit?: Record<string, number>;
}

export interface RankingRule {
  stage: number;
  rank: string;
  bonusUsd: number;
  requirements?: Record<string, unknown>;
}

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private api = inject(ApiService);

  private commissionRulesSignal = signal<CommissionRulesDto | null>(null);
  private rankingRulesSignal = signal<RankingRule[]>([]);
  private earningTypesSignal = signal<string[]>([]);
  private loadedSignal = signal(false);

  readonly commissionRules = this.commissionRulesSignal.asReadonly();
  readonly rankingRules = this.rankingRulesSignal.asReadonly();
  readonly earningTypes = this.earningTypesSignal.asReadonly();
  readonly loaded = this.loadedSignal.asReadonly();

  fetchAll(): Observable<boolean> {
    return forkJoin({
      commission: this.fetchCommissionRules(),
      ranking: this.fetchRankingRules(),
      types: this.fetchEarningTypes()
    }).pipe(
      map(() => {
        this.loadedSignal.set(true);
        return true;
      }),
      catchError(() => {
        this.loadedSignal.set(true);
        return of(false);
      })
    );
  }

  fetchCommissionRules(): Observable<CommissionRulesDto | null> {
    return this.api.get<Record<string, unknown>>('settings/commission-rules').pipe(
      map((res) => this.mapCommissionRules(res)),
      tap((rules) => this.commissionRulesSignal.set(rules)),
      catchError(() => {
        this.commissionRulesSignal.set(null);
        return of(null);
      })
    );
  }

  fetchRankingRules(): Observable<RankingRule[]> {
    return this.api.get<Record<string, unknown>>('settings/ranking-rules').pipe(
      map((res) => this.mapRankingRules(res)),
      tap((rules) => this.rankingRulesSignal.set(rules)),
      catchError(() => {
        this.rankingRulesSignal.set([]);
        return of([]);
      })
    );
  }

  fetchEarningTypes(): Observable<string[]> {
    return this.api.get<unknown>('earnings/types').pipe(
      map((res) => {
        if (Array.isArray(res)) return res.map(String);
        if (typeof res === 'object' && res !== null) {
          const obj = res as Record<string, unknown>;
          const types = obj['types'] ?? obj['data'] ?? obj['earningTypes'];
          if (Array.isArray(types)) return types.map(String);
        }
        return [];
      }),
      tap((types) => this.earningTypesSignal.set(types)),
      catchError(() => {
        this.earningTypesSignal.set([]);
        return of([]);
      })
    );
  }

  private mapCommissionRules(raw: Record<string, unknown>): CommissionRulesDto | null {
    if (!raw) return null;

    const levels: LevelCommissionRule[] = [];

    const rawLevels = (raw['levels'] ?? raw['commissionLevels'] ?? raw['levelCommissions'] ?? raw['rules']) as unknown;
    if (Array.isArray(rawLevels)) {
      for (const item of rawLevels) {
        const r = item as Record<string, unknown>;
        const percentages: Record<string, number> = {};
        const rawPct = r['percentages'] ?? r['commissionPercent'] ?? r['rates'];
        if (typeof rawPct === 'object' && rawPct !== null) {
          for (const [k, v] of Object.entries(rawPct as Record<string, unknown>)) {
            percentages[k.toUpperCase()] = Number(v);
          }
        } else {
          const pct = Number(r['percentage'] ?? r['percent'] ?? r['rate'] ?? 0);
          for (const pkg of ['NICKEL', 'SILVER', 'GOLD', 'PLATINUM', 'RUBY', 'DIAMOND']) {
            percentages[pkg] = Number(r[pkg.toLowerCase()] ?? r[pkg] ?? pct);
          }
        }

        levels.push({
          level: Number(r['level'] ?? 0),
          stage: Number(r['stage'] ?? 0),
          rank: String(r['rank'] ?? r['rankName'] ?? ''),
          percentages,
          rankingBonusUsd: r['rankingBonusUsd'] != null ? Number(r['rankingBonusUsd']) : null
        });
      }
    }

    const extractRateMap = (key: string): Record<string, number> | undefined => {
      const val = raw[key];
      if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        const out: Record<string, number> = {};
        for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
          out[k.toUpperCase()] = Number(v);
        }
        return out;
      }
      return undefined;
    };

    return {
      levels,
      pdpaRates: extractRateMap('pdpaRates') ?? extractRateMap('pdpa'),
      cdpaRates: extractRateMap('cdpaRates') ?? extractRateMap('cdpa'),
      cashoutSplit: extractRateMap('cashoutSplit') ?? extractRateMap('cashout'),
      autoshipSplit: extractRateMap('autoshipSplit') ?? extractRateMap('autoship')
    };
  }

  private mapRankingRules(raw: Record<string, unknown>): RankingRule[] {
    const arr = (raw['rules'] ?? raw['ranks'] ?? raw['stages'] ?? raw['data']) as unknown;
    if (!Array.isArray(arr)) {
      if (Array.isArray(raw)) {
        return (raw as Record<string, unknown>[]).map(r => this.mapSingleRankingRule(r));
      }
      return [];
    }
    return arr.map((r: Record<string, unknown>) => this.mapSingleRankingRule(r));
  }

  private mapSingleRankingRule(r: Record<string, unknown>): RankingRule {
    return {
      stage: Number(r['stage'] ?? r['level'] ?? 0),
      rank: String(r['rank'] ?? r['name'] ?? r['rankName'] ?? ''),
      bonusUsd: Number(r['bonusUsd'] ?? r['bonus'] ?? r['rankingBonus'] ?? r['reward'] ?? 0),
      requirements: (r['requirements'] ?? r['criteria']) as Record<string, unknown> | undefined
    };
  }
}
