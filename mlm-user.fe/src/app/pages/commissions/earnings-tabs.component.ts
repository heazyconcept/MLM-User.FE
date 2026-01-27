import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-earnings-tabs',
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <div class="border-b border-gray-200 mb-8">
      <nav class="flex gap-8 -mb-px">
        <a routerLink="/commissions" 
           routerLinkActive="border-mlm-primary text-mlm-primary" 
           [routerLinkActiveOptions]="{ exact: true }"
           class="py-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors">
          Overview
        </a>
        <a routerLink="/commissions/breakdown" 
           routerLinkActive="border-mlm-primary text-mlm-primary"
           class="py-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors">
          Breakdown
        </a>
        <a routerLink="/commissions/bonuses" 
           routerLinkActive="border-mlm-primary text-mlm-primary"
           class="py-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors">
          Bonuses
        </a>
        <a routerLink="/commissions/ranking" 
           routerLinkActive="border-mlm-primary text-mlm-primary"
           class="py-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors">
          Ranking
        </a>
        <a routerLink="/commissions/cpv" 
           routerLinkActive="border-mlm-primary text-mlm-primary"
           class="py-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors">
          CPV
        </a>
      </nav>
    </div>
  `
})
export class EarningsTabsComponent {}
