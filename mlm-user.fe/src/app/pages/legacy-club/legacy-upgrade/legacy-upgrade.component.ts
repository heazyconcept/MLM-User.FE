import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';
import { LegacyClubService } from '../../../services/legacy-club.service';
import { LegacyCartService } from '../../../services/legacy-cart.service';
import {
  LegacyPackageCode,
  LegacyUpgradeQuote,
} from '../../../core/models/legacy-club.models';
import { formatLegacyMoney } from '../../../core/utils/legacy-money.util';
import { LegacyClubHttpError } from '../../../core/mocks/legacy-club.mock';
import { LegacyPageShellComponent } from '../components/legacy-page-shell.component';
import { LegacyPageHeaderComponent } from '../components/legacy-page-header.component';
import { LegacyPanelComponent } from '../components/legacy-panel.component';

@Component({
  selector: 'app-legacy-upgrade',
  imports: [
    CommonModule,
    RouterLink,
    ButtonModule,
    SkeletonModule,
    LegacyPageShellComponent,
    LegacyPageHeaderComponent,
    LegacyPanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-legacy-page-shell>
      <app-legacy-page-header
        title="Upgrade package"
        subtitle="Pay the difference only. Your weekly cycle starts again from week 1. Instant goes to your Legacy account."
        backLink="/legacy"
        backLabel="Legacy Club"
      />

      @if (loading()) {
        <div class="space-y-4">
          @for (_ of [1, 2]; track $index) {
            <p-skeleton height="10rem" styleClass="rounded-xl" />
          }
        </div>
      } @else if (targets().length === 0) {
        <app-legacy-panel>
          <div class="py-2 text-center">
            <p class="font-semibold text-mlm-text">You are on the highest package.</p>
            <p class="mt-2 text-sm text-mlm-secondary">
              Reactivate when your 24-week cycle is complete.
            </p>
            <a routerLink="/legacy" class="mt-4 inline-block">
              <p-button label="Back to Legacy Club" />
            </a>
          </div>
        </app-legacy-panel>
      } @else {
        <div class="grid gap-5 lg:grid-cols-2">
          @for (quote of quotes(); track quote.toPackage) {
            <article class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 class="text-lg font-bold text-gray-900">
                {{ quote.fromPackage }} → {{ quote.toPackage }}
              </h2>
              <ul class="mt-3 space-y-1.5 text-sm text-gray-700">
                <li>
                  <span class="font-semibold">You pay</span> {{ money(quote.payAmount) }} (Legacy
                  voucher)
                </li>
                <li>
                  <span class="font-semibold">Instant</span> {{ money(quote.instantCommission) }}
                  to your Legacy account
                </li>
                <li>
                  New monthly: base {{ money(quote.newMonthlyBase) }} · increased
                  {{ money(quote.newMonthlyIncreased) }}
                  ({{ money(quote.newMonthlyIncreased / 4) }} / week increased)
                </li>
                <li>
                  Weekly voucher slice {{ money(quote.newAutoshipAmount / 4) }}
                  (flyer Autoship {{ money(quote.newAutoshipAmount) }} / month)
                </li>
              </ul>
              <p class="mt-3 text-xs text-gray-500">
                Waiting weeks from the old cycle keep their amounts until catch-up drop. The new
                list shows only the new package weeks. If you already have 3 Successlines, new weeks
                use the increased {{ quote.toPackage }} rate.
              </p>
              <p-button
                class="mt-4"
                styleClass="w-full"
                [label]="'Upgrade to ' + quote.toPackage"
                [loading]="starting() === quote.toPackage"
                [disabled]="starting() !== null"
                (onClick)="start(quote)"
              />
            </article>
          }
        </div>
      }

      @if (error()) {
        <app-legacy-panel>
          <p class="text-sm text-red-800">{{ error() }}</p>
        </app-legacy-panel>
      }
    </app-legacy-page-shell>
  `,
})
export class LegacyUpgradeComponent implements OnInit {
  private legacyClub = inject(LegacyClubService);
  private cart = inject(LegacyCartService);
  private router = inject(Router);
  private messages = inject(MessageService);

  loading = signal(true);
  error = signal<string | null>(null);
  targets = signal<LegacyPackageCode[]>([]);
  quotes = signal<LegacyUpgradeQuote[]>([]);
  starting = signal<LegacyPackageCode | null>(null);

  ngOnInit(): void {
    this.legacyClub.loadMe().subscribe({
      next: (me) => {
        if (me?.status !== 'ACTIVE') {
          void this.router.navigate(['/legacy']);
          return;
        }
        const targets = me.upgradeTargets ?? [];
        this.targets.set(targets);
        if (targets.length === 0) {
          this.loading.set(false);
          return;
        }
        let remaining = targets.length;
        const collected: LegacyUpgradeQuote[] = [];
        for (const code of targets) {
          this.legacyClub.getUpgradeQuote(code).subscribe({
            next: (quote) => {
              collected.push(quote);
              remaining -= 1;
              if (remaining === 0) {
                this.quotes.set(
                  collected.sort(
                    (a, b) => targets.indexOf(a.toPackage) - targets.indexOf(b.toPackage),
                  ),
                );
                this.loading.set(false);
              }
            },
            error: (err: LegacyClubHttpError) => {
              remaining -= 1;
              this.error.set(err.message ?? 'Could not load upgrade quotes.');
              if (remaining === 0) this.loading.set(false);
            },
          });
        }
      },
    });
  }

  money(amount: number): string {
    return formatLegacyMoney(amount, this.legacyClub.me()?.currency ?? 'NGN');
  }

  start(quote: LegacyUpgradeQuote): void {
    if (this.starting()) return;
    this.starting.set(quote.toPackage);
    this.error.set(null);
    this.legacyClub.startUpgrade(quote.toPackage).subscribe({
      next: () => {
        this.cart.setUpgradeFloor(quote.payAmount);
        this.starting.set(null);
        void this.router.navigate(['/legacy/shop']);
      },
      error: (err: LegacyClubHttpError) => {
        this.starting.set(null);
        this.error.set(err.message ?? 'Could not start upgrade.');
        this.messages.add({
          severity: 'error',
          summary: 'Upgrade',
          detail: err.message ?? 'Could not start upgrade.',
        });
      },
    });
  }
}
