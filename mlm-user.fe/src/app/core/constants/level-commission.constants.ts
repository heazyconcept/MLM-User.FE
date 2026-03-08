/**
 * Level Commission Table - hardcoded from level-table.md
 * Commission percentages by level and package; ranking bonuses in USD (convert to NGN for NGN users).
 */
import { NGN_TO_USD_RATE } from './registration.constants';

export interface LevelCommissionRow {
  level: number;
  stageLabel: string;
  rank: string;
  percentages: Record<string, number>;
  /** Ranking bonus in USD; null for Level 1 (Matching Bonus) */
  rankingBonusUsd: number | null;
}

/** Level 1 = Direct Referral; Levels 2-13 = team commissions. Ranking bonus paid on stage completion. */
export const LEVEL_COMMISSION_TABLE: LevelCommissionRow[] = [
  { level: 1, stageLabel: 'Entry Level', rank: 'Stakeholder', percentages: { NICKEL: 10, SILVER: 10, GOLD: 12, PLATINUM: 15, RUBY: 18, DIAMOND: 20 }, rankingBonusUsd: null },
  { level: 2, stageLabel: 'Stage 1, Level 1', rank: 'Mentor', percentages: { NICKEL: 3, SILVER: 3, GOLD: 3, PLATINUM: 3, RUBY: 3, DIAMOND: 3 }, rankingBonusUsd: 65 },
  { level: 3, stageLabel: 'Stage 1, Level 2', rank: 'Mentor', percentages: { NICKEL: 3, SILVER: 3, GOLD: 3, PLATINUM: 3, RUBY: 3, DIAMOND: 3 }, rankingBonusUsd: null },
  { level: 4, stageLabel: 'Stage 2, Level 1', rank: 'Manager', percentages: { NICKEL: 2, SILVER: 2, GOLD: 2, PLATINUM: 2, RUBY: 2, DIAMOND: 2 }, rankingBonusUsd: 650 },
  { level: 5, stageLabel: 'Stage 2, Level 2', rank: 'Manager', percentages: { NICKEL: 2, SILVER: 2, GOLD: 2, PLATINUM: 2, RUBY: 2, DIAMOND: 2 }, rankingBonusUsd: null },
  { level: 6, stageLabel: 'Stage 3, Level 1', rank: 'Senior Manager', percentages: { NICKEL: 2, SILVER: 2, GOLD: 2, PLATINUM: 2, RUBY: 2, DIAMOND: 2 }, rankingBonusUsd: 6000 },
  { level: 7, stageLabel: 'Stage 3, Level 2', rank: 'Senior Manager', percentages: { NICKEL: 2, SILVER: 2, GOLD: 2, PLATINUM: 2, RUBY: 2, DIAMOND: 2 }, rankingBonusUsd: null },
  { level: 8, stageLabel: 'Stage 4, Level 1', rank: 'Director', percentages: { NICKEL: 2, SILVER: 2, GOLD: 2, PLATINUM: 2, RUBY: 2, DIAMOND: 2 }, rankingBonusUsd: 50000 },
  { level: 9, stageLabel: 'Stage 4, Level 2', rank: 'Director', percentages: { NICKEL: 2, SILVER: 2, GOLD: 2, PLATINUM: 2, RUBY: 2, DIAMOND: 2 }, rankingBonusUsd: null },
  { level: 10, stageLabel: 'Stage 5, Level 1', rank: 'Senior Director', percentages: { NICKEL: 2, SILVER: 2, GOLD: 2, PLATINUM: 2, RUBY: 2, DIAMOND: 2 }, rankingBonusUsd: 500000 },
  { level: 11, stageLabel: 'Stage 5, Level 2', rank: 'Senior Director', percentages: { NICKEL: 2, SILVER: 2, GOLD: 2, PLATINUM: 2, RUBY: 2, DIAMOND: 2 }, rankingBonusUsd: null },
  { level: 12, stageLabel: 'Stage 6, Level 1', rank: 'Consultant', percentages: { NICKEL: 1, SILVER: 1, GOLD: 1, PLATINUM: 1, RUBY: 1, DIAMOND: 1 }, rankingBonusUsd: 4000000 },
  { level: 13, stageLabel: 'Stage 6, Level 2', rank: 'Consultant', percentages: { NICKEL: 1, SILVER: 1, GOLD: 1, PLATINUM: 1, RUBY: 1, DIAMOND: 1 }, rankingBonusUsd: null }
];

/**
 * Format ranking bonus for display based on user currency.
 * Level 1 returns 'Matching Bonus' (no fixed amount).
 */
export function formatRankingBonus(rankingBonusUsd: number | null, currency: 'NGN' | 'USD'): string {
  if (rankingBonusUsd == null) return '';
  if (currency === 'NGN') {
    const ngn = Math.round(rankingBonusUsd * NGN_TO_USD_RATE);
    if (ngn >= 1_000_000_000) return `₦${(ngn / 1_000_000_000).toFixed(1)}B`;
    if (ngn >= 1_000_000) return `₦${(ngn / 1_000_000).toFixed(1)}M`;
    return `₦${ngn.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  }
  if (rankingBonusUsd >= 1_000_000) return `$${(rankingBonusUsd / 1_000_000).toFixed(1)}M`;
  return `$${rankingBonusUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}
