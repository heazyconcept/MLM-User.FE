import { Component, ChangeDetectionStrategy, OnInit, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { LegacyClubService } from '../../../services/legacy-club.service';
import { formatLegacyMoney } from '../../../core/utils/legacy-money.util';
import { resolveLegacyShopMode } from '../../../core/models/legacy-club.models';
import { LegacyPageShellComponent } from '../components/legacy-page-shell.component';
import { LegacyPanelComponent } from '../components/legacy-panel.component';

@Component({
  selector: 'app-legacy-success',
  imports: [CommonModule, RouterLink, ButtonModule, LegacyPageShellComponent, LegacyPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-legacy-page-shell>
      <div class="mx-auto max-w-xl">
        <app-legacy-panel>
          <div class="space-y-6 py-4 text-center">
            <div
              class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"
            >
              <i class="pi pi-check text-3xl"></i>
            </div>
            <div>
              <h1 class="text-2xl font-bold text-mlm-text">{{ title() }}</h1>
              @if (me()?.membership; as m) {
                <p class="mt-2 text-lg font-semibold text-mlm-text">{{ m.package }}</p>
              }
            </div>
            <p class="text-sm leading-relaxed text-mlm-secondary">{{ body() }}</p>
            <div class="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <a routerLink="/legacy">
                <p-button label="Go to Legacy Club" styleClass="w-full sm:w-auto" />
              </a>
              <a routerLink="/legacy/cashout">
                <p-button
                  label="Open Legacy account"
                  [outlined]="true"
                  styleClass="w-full sm:w-auto"
                />
              </a>
            </div>
          </div>
        </app-legacy-panel>
      </div>
    </app-legacy-page-shell>
  `,
})
export class LegacySuccessComponent implements OnInit {
  private legacyClub = inject(LegacyClubService);
  me = this.legacyClub.me;

  title = computed(() => {
    const intent = this.me()?.intent;
    if (intent === 'UPGRADE') return 'Upgrade complete';
    if (intent === 'REACTIVATE') return 'Welcome back to Legacy Club';
    const mode = resolveLegacyShopMode(this.me());
    if (this.me()?.status === 'ACTIVE' && (mode === 'AUTOSHIP' || mode === 'NONE')) {
      return 'Payment complete';
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
    const mode = resolveLegacyShopMode(me);
    if (me?.status === 'ACTIVE' && (mode === 'AUTOSHIP' || mode === 'NONE') && me.cycle) {
      return 'Your Legacy marketplace payment is complete. Weekly membership commission drops into your Legacy account and voucher automatically every 7 days — shopping does not unlock extra commission.';
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
