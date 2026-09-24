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
import { LegacyClubService } from '../../../services/legacy-club.service';
import {
  LegacyPvHistoryItem,
  formatLegacyPvAmount,
  legacyPvHistoryRowTitle,
} from '../../../core/models/legacy-club.models';
import { formatLegacyMoney } from '../../../core/utils/legacy-money.util';
import { LegacyPageShellComponent } from '../components/legacy-page-shell.component';
import { LegacyPageHeaderComponent } from '../components/legacy-page-header.component';
import { LegacyPanelComponent } from '../components/legacy-panel.component';

@Component({
  selector: 'app-legacy-pv-history',
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
        title="Legacy PV history"
        subtitle="Product volume from Legacy marketplace purchases — yours and from Successlines."
        backLink="/legacy/home"
        backLabel="Legacy Club"
      />

      @if (loading()) {
        <div class="space-y-3">
          @for (_ of [1, 2, 3]; track $index) {
            <p-skeleton height="5rem" styleClass="rounded-xl" />
          }
        </div>
      } @else if (error()) {
        <app-legacy-panel>
          <p class="text-sm text-red-800">{{ error() }}</p>
        </app-legacy-panel>
      } @else if (items().length === 0) {
        <app-legacy-panel>
          <p class="text-sm text-mlm-secondary">
            No Legacy PV yet. Shop the Legacy marketplace to earn PV that also counts toward your
            network totals.
          </p>
          <a routerLink="/legacy/shop" class="mt-4 inline-block">
            <p-button label="Shop Legacy marketplace" size="small" />
          </a>
        </app-legacy-panel>
      } @else {
        <div class="space-y-3">
          @for (item of items(); track item.id) {
            <article class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <p class="font-semibold text-mlm-text">{{ rowTitle(item) }}</p>
                  <p class="mt-1 text-sm text-mlm-secondary">{{ item.productSummary }}</p>
                  <p class="mt-1 text-xs text-mlm-secondary">
                    {{ item.at | date: 'medium' }}
                    @if (item.orderReference) {
                      · {{ item.orderReference }}
                    }
                  </p>
                </div>
                <div class="text-right">
                  <p class="font-semibold text-mlm-text">{{ formatPv(item.pvAmount) }}</p>
                  @if (item.kind === 'OWN_PURCHASE' && item.orderTotal != null) {
                    <p class="text-xs text-mlm-secondary">
                      {{ money(item.orderTotal, item.currency) }} paid
                    </p>
                  }
                </div>
              </div>
            </article>
          }
        </div>

        @if (nextCursor()) {
          <div class="mt-6 flex justify-center">
            <p-button
              label="Load more"
              [outlined]="true"
              [loading]="loadingMore()"
              (onClick)="loadMore()"
            />
          </div>
        }
      }
    </app-legacy-page-shell>
  `,
})
export class LegacyPvHistoryComponent implements OnInit {
  private legacyClub = inject(LegacyClubService);
  private router = inject(Router);

  loading = signal(true);
  loadingMore = signal(false);
  error = signal<string | null>(null);
  items = signal<LegacyPvHistoryItem[]>([]);
  nextCursor = signal<string | null>(null);

  readonly formatPv = formatLegacyPvAmount;
  readonly rowTitle = legacyPvHistoryRowTitle;

  ngOnInit(): void {
    this.legacyClub.loadMe().subscribe({
      next: (me) => {
        if (me?.status !== 'ACTIVE') {
          void this.router.navigate(['/legacy']);
          return;
        }
        this.fetchHistory();
      },
    });
  }

  loadMore(): void {
    const cursor = this.nextCursor();
    if (!cursor || this.loadingMore()) return;
    this.loadingMore.set(true);
    this.legacyClub.getPvHistory({ cursor, limit: 20 }).subscribe({
      next: (res) => {
        this.items.update((current) => [...current, ...(res.items ?? [])]);
        this.nextCursor.set(res.nextCursor ?? null);
        this.loadingMore.set(false);
      },
      error: () => {
        this.error.set('Could not load more history.');
        this.loadingMore.set(false);
      },
    });
  }

  money(amount: number, currency: LegacyPvHistoryItem['currency']): string {
    return formatLegacyMoney(amount, currency ?? this.legacyClub.me()?.currency ?? 'NGN');
  }

  private fetchHistory(): void {
    this.legacyClub.getPvHistory({ limit: 20 }).subscribe({
      next: (res) => {
        this.items.set(res.items ?? []);
        this.nextCursor.set(res.nextCursor ?? null);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load PV history.');
        this.loading.set(false);
      },
    });
  }
}
