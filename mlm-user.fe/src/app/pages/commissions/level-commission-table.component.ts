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
  templateUrl: './level-commission-table.component.html'
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
