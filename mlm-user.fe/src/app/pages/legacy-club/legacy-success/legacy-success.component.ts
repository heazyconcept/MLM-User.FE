import { Component, ChangeDetectionStrategy, OnInit, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { LegacyClubService } from '../../../services/legacy-club.service';
import { formatLegacyMoney } from '../../../core/utils/legacy-money.util';
import { resolveLegacyShopMode } from '../../../core/models/legacy-club.models';

@Component({
  selector: 'app-legacy-success',
  imports: [CommonModule, RouterLink, ButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-mlm-background">
      <main class="py-8">
        <div class="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
          <div class="mx-auto max-w-xl space-y-6 text-center">
      <div
        class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"
      >
        <i class="pi pi-check text-3xl"></i>
      </div>
      <h1 class="text-3xl font-bold text-mlm-text">{{ title() }}</h1>
      @if (me()?.membership; as m) {
        <p class="text-lg font-semibold text-mlm-text">{{ m.package }}</p>
      }
      <p class="text-sm leading-relaxed text-mlm-secondary">{{ body() }}</p>
      <div class="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <a routerLink="/legacy">
          <p-button label="Go to Legacy Club" styleClass="w-full sm:w-auto" />
        </a>
        <a routerLink="/legacy/cashout">
          <p-button label="Open Legacy account" [outlined]="true" styleClass="w-full sm:w-auto" />
        </a>
      </div>
          </div>
        </div>
      </main>
    </div>
  `,
})
export class LegacySuccessComponent implements OnInit {
  private legacyClub = inject(LegacyClubService);
  me = this.legacyClub.me;

  title = computed(() => {
    const intent = this.me()?.intent;
    if (intent === 'UPGRADE') return 'Upgrade complete';
    if (intent === 'REACTIVATE') return 'Welcome back to Legacy Club';
    if (this.me()?.status === 'ACTIVE' && resolveLegacyShopMode(this.me()) === 'AUTOSHIP') {
      return 'Autoship paid';
    }
    return 'Welcome to Legacy Club';
  });

  body = computed(() => {
    const me = this.me();
    const instant = this.money(me?.instantReceived ?? 0);
    const intent = me?.intent;
    if (intent === 'UPGRADE' || intent === 'REACTIVATE') {
      return `Instant Membership Commission ${instant} is in your Legacy account. You can cash it out now.`;
    }
    if (me?.status === 'ACTIVE' && me.cycle && resolveLegacyShopMode(me) !== 'JOIN') {
      const pending = me.cycle.pendingAmount ?? 0;
      if (pending === 0 && (me.cycle.droppedCount ?? 0) > 0) {
        return 'Pending monthly commission has dropped into your Legacy account where available. You can cash out anytime.';
      }
      return 'Your Legacy marketplace payment is complete. Pending monthly commission drops into your Legacy account when Autoship qualifies.';
    }
    return `Instant Membership Commission ${instant} is in your Legacy account. You can cash it out now.`;
  });

  ngOnInit(): void {
    this.legacyClub.loadMe().subscribe();
  }

  money(amount: number): string {
    return formatLegacyMoney(amount, this.me()?.currency ?? 'NGN');
  }
}
