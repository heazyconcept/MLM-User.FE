import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SkeletonModule } from 'primeng/skeleton';
import { UserService } from '../../services/user.service';
import { EarningsTabsComponent } from './earnings-tabs.component';
import {
  LEVEL_COMMISSION_TABLE,
  formatRankingBonus
} from '../../core/constants/level-commission.constants';

interface LevelRow {
  level: number;
  stageLabel: string;
  rank: string;
  nickel: number;
  silver: number;
  gold: number;
  platinum: number;
  ruby: number;
  diamond: number;
  rankingBonus: string;
}

@Component({
  selector: 'app-level-commission-table',
  standalone: true,
  imports: [CommonModule, RouterModule, EarningsTabsComponent, SkeletonModule],
  template: `
    <div class="p-6 lg:p-10 space-y-8 mx-auto">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Earnings</h1>
          <p class="text-sm text-gray-500 mt-1">Level commission percentages by package</p>
        </div>
      </div>

      <app-earnings-tabs></app-earnings-tabs>

      @if (isLoading()) {
        <div class="bg-white rounded-xl border border-gray-200 p-6">
          <p-skeleton width="100%" height="400px" borderRadius="8px"></p-skeleton>
        </div>
      } @else {
        @if (dataSource()) {
          <div class="text-xs text-gray-400 text-right">
            Source: {{ dataSource() }}
          </div>
        }

        @if (currentPackage) {
          <div class="bg-mlm-primary/5 border border-mlm-primary/20 rounded-xl px-4 py-3 text-sm">
            Your package: <span class="font-semibold text-mlm-primary">{{ currentPackage }}</span> —
            your column is highlighted below.
          </div>
        }

        @if (!hasLevels()) {
          <div class="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-500 text-center">
            No commission rules available from API. Please configure commission rules on the backend.
          </div>
        } @else {
          <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="bg-gray-50 border-b border-gray-200">
                    <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Lvl</th>
                    <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stage</th>
                    <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rank</th>
                    @for (pkg of packageColumns; track pkg) {
                      <th class="text-center px-3 py-3 text-xs font-semibold uppercase tracking-wide"
                          [class.text-mlm-primary]="isCurrentPkg(pkg)"
                          [class.bg-mlm-primary/5]="isCurrentPkg(pkg)"
                          [class.text-gray-500]="!isCurrentPkg(pkg)">
                        {{ pkg }}
                      </th>
                    }
                    <th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ranking Bonus ({{ displayCurrency() }})</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  @for (row of levels(); track row.level) {
                    <tr class="hover:bg-gray-50/50 transition-colors">
                      <td class="px-4 py-3 font-medium text-gray-900">{{ row.level }}</td>
                      <td class="px-4 py-3 text-gray-500 text-xs">{{ row.stageLabel }}</td>
                      <td class="px-4 py-3 text-gray-700 font-medium">{{ row.rank }}</td>
                      <td class="text-center px-3 py-3"
                          [class.bg-mlm-primary/5]="isCurrentPkg('Nickel')"
                          [class.font-bold]="isCurrentPkg('Nickel')"
                          [class.text-mlm-primary]="isCurrentPkg('Nickel')">
                        {{ row.nickel }}%
                      </td>
                      <td class="text-center px-3 py-3"
                          [class.bg-mlm-primary/5]="isCurrentPkg('Silver')"
                          [class.font-bold]="isCurrentPkg('Silver')"
                          [class.text-mlm-primary]="isCurrentPkg('Silver')">
                        {{ row.silver }}%
                      </td>
                      <td class="text-center px-3 py-3"
                          [class.bg-mlm-primary/5]="isCurrentPkg('Gold')"
                          [class.font-bold]="isCurrentPkg('Gold')"
                          [class.text-mlm-primary]="isCurrentPkg('Gold')">
                        {{ row.gold }}%
                      </td>
                      <td class="text-center px-3 py-3"
                          [class.bg-mlm-primary/5]="isCurrentPkg('Platinum')"
                          [class.font-bold]="isCurrentPkg('Platinum')"
                          [class.text-mlm-primary]="isCurrentPkg('Platinum')">
                        {{ row.platinum }}%
                      </td>
                      <td class="text-center px-3 py-3"
                          [class.bg-mlm-primary/5]="isCurrentPkg('Ruby')"
                          [class.font-bold]="isCurrentPkg('Ruby')"
                          [class.text-mlm-primary]="isCurrentPkg('Ruby')">
                        {{ row.ruby }}%
                      </td>
                      <td class="text-center px-3 py-3"
                          [class.bg-mlm-primary/5]="isCurrentPkg('Diamond')"
                          [class.font-bold]="isCurrentPkg('Diamond')"
                          [class.text-mlm-primary]="isCurrentPkg('Diamond')">
                        {{ row.diamond }}%
                      </td>
                      <td class="text-right px-4 py-3 font-semibold"
                          [class.text-amber-600]="row.rankingBonus">
                        {{ row.rankingBonus || '—' }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>

          <div class="bg-gray-50 border border-gray-200 rounded-xl p-5 text-sm text-gray-600 space-y-2">
            <p><strong>Level 1</strong> is your Direct Referral Commission — the percentage varies by package.</p>
            <p><strong>Levels 2–13</strong> are team commissions earned from your downline's activity at each level in the matrix.</p>
            <p><strong>Ranking Bonus</strong> is a one-time cash reward paid when you complete each stage.</p>
          </div>
        }
      }
    </div>
  `
})
export class LevelCommissionTableComponent implements OnInit {
  private userService = inject(UserService);

  isLoading = signal(false);
  dataSource = signal<string>('Hardcoded (level-table.md)');
  packageColumns = ['Nickel', 'Silver', 'Gold', 'Platinum', 'Ruby', 'Diamond'];

  displayCurrency = this.userService.displayCurrency;

  levels = computed(() => {
    const currency = this.displayCurrency();
    return LEVEL_COMMISSION_TABLE.map((r) => {
      const bonus =
        r.rankingBonusUsd != null
          ? formatRankingBonus(r.rankingBonusUsd, currency)
          : r.level === 1
            ? 'Matching Bonus'
            : '';
      return {
        level: r.level,
        stageLabel: r.stageLabel,
        rank: r.rank,
        nickel: r.percentages['NICKEL'] ?? 0,
        silver: r.percentages['SILVER'] ?? 0,
        gold: r.percentages['GOLD'] ?? 0,
        platinum: r.percentages['PLATINUM'] ?? 0,
        ruby: r.percentages['RUBY'] ?? 0,
        diamond: r.percentages['DIAMOND'] ?? 0,
        rankingBonus: bonus
      };
    });
  });

  hasLevels = computed(() => this.levels().length > 0);

  currentPackage = (() => {
    const pkg = this.userService.currentUser()?.package;
    if (!pkg) return '';
    return pkg.charAt(0).toUpperCase() + pkg.slice(1).toLowerCase();
  })();

  ngOnInit(): void {
    // Table uses hardcoded data from level-commission.constants; currency from user preferences
  }

  isCurrentPkg(label: string): boolean {
    return this.currentPackage === label;
  }
}
