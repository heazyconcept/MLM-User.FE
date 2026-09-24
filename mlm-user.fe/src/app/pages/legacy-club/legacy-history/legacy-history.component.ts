import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { LegacyClubService } from '../../../services/legacy-club.service';
import {
  LegacyHistoryFilter,
  LegacyHistoryItem,
  isLegacyMember,
} from '../../../core/models/legacy-club.models';
import { formatLegacyMoney } from '../../../core/utils/legacy-money.util';
import {
  filterLegacyHistoryItems,
  isMembershipHistoryKind,
  ledgerItemToHistoryItem,
  legacyHistoryAmountPrefix,
  mergeLegacyHistoryItems,
} from '../../../core/utils/legacy-history.util';
import { LegacyPageShellComponent } from '../components/legacy-page-shell.component';
import { LegacyPageHeaderComponent } from '../components/legacy-page-header.component';
import { LegacyPanelComponent } from '../components/legacy-panel.component';

const HISTORY_FILTERS: { id: LegacyHistoryFilter; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'MEMBERSHIP', label: 'Membership' },
  { id: 'ACCOUNT', label: 'Account' },
];

@Component({
  selector: 'app-legacy-history',
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
        title="Membership history"
        subtitle="All Legacy account activity — membership, commissions, transfers, and withdrawals. PV stays on PV history."
        backLink="/legacy/home"
        backLabel="Legacy Club"
      />

      <div class="mb-5 flex flex-wrap gap-2">
        @for (chip of filters; track chip.id) {
          <button
            type="button"
            class="rounded-full px-4 py-2 text-sm font-semibold transition-colors"
            [class]="
              filter() === chip.id
                ? 'bg-mlm-primary text-white'
                : 'border border-gray-200 bg-white text-mlm-text hover:bg-gray-50'
            "
            (click)="setFilter(chip.id)"
          >
            {{ chip.label }}
          </button>
        }
      </div>

      @if (loading()) {
        <div class="space-y-3">
          @for (_ of [1, 2, 3]; track $index) {
            <p-skeleton height="4.5rem" styleClass="rounded-xl" />
          }
        </div>
      } @else if (error()) {
        <app-legacy-panel>
          <p class="text-sm text-red-800">{{ error() }}</p>
        </app-legacy-panel>
      } @else if (visibleItems().length === 0) {
        <app-legacy-panel>
          <p class="text-sm text-mlm-secondary">No history yet.</p>
          <a routerLink="/legacy/pv/history" class="mt-3 inline-block text-sm font-semibold text-mlm-primary">
            View PV history
          </a>
        </app-legacy-panel>
      } @else {
        <div class="space-y-3">
          @for (item of visibleItems(); track item.id) {
            <article class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <div class="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p class="font-semibold text-mlm-text">{{ item.title }}</p>
                  <p class="mt-0.5 text-sm text-mlm-secondary">{{ item.at | date: 'medium' }}</p>
                  @if (item.subtitle) {
                    <p class="mt-1 text-xs text-mlm-secondary">{{ item.subtitle }}</p>
                  }
                </div>
                <div class="text-right">
                  <p
                    class="font-semibold tabular-nums"
                    [class]="item.direction === 'CREDIT' ? 'text-emerald-700' : 'text-mlm-text'"
                  >
                    {{ amountPrefix(item) }}{{ money(item) }}
                  </p>
                </div>
              </div>
            </article>
          }
        </div>

        @if (nextCursor()) {
          <div class="mt-5 flex justify-center">
            <p-button
              label="Load more"
              [outlined]="true"
              [loading]="loadingMore()"
              (onClick)="loadMore()"
            />
          </div>
        }

        <p class="mt-6 text-center text-sm text-mlm-secondary">
          Product PV is tracked separately on
          <a routerLink="/legacy/pv/history" class="font-semibold text-mlm-primary">PV history</a>.
        </p>
      }
    </app-legacy-page-shell>
  `,
})
export class LegacyHistoryComponent implements OnInit {
  private legacyClub = inject(LegacyClubService);
  private router = inject(Router);

  readonly filters = HISTORY_FILTERS;

  loading = signal(true);
  loadingMore = signal(false);
  error = signal<string | null>(null);
  filter = signal<LegacyHistoryFilter>('ALL');
  membershipItems = signal<LegacyHistoryItem[]>([]);
  ledgerItems = signal<LegacyHistoryItem[]>([]);
  nextCursor = signal<string | null>(null);
  unifiedFeed = signal(false);

  displayItems = computed(() =>
    this.unifiedFeed()
      ? this.membershipItems()
      : mergeLegacyHistoryItems(this.membershipItems(), this.ledgerItems()),
  );

  visibleItems = computed(() => filterLegacyHistoryItems(this.displayItems(), this.filter()));

  ngOnInit(): void {
    this.legacyClub.loadMe().subscribe({
      next: (me) => {
        if (!isLegacyMember(me)) {
          void this.router.navigate(['/legacy']);
          return;
        }
        this.loadInitial();
      },
    });
  }

  setFilter(value: LegacyHistoryFilter): void {
    this.filter.set(value);
  }

  money(item: LegacyHistoryItem): string {
    return formatLegacyMoney(item.amount, item.currency);
  }

  amountPrefix(item: LegacyHistoryItem): string {
    return legacyHistoryAmountPrefix(item.direction);
  }

  loadMore(): void {
    const cursor = this.nextCursor();
    if (!cursor || this.loadingMore() || this.unifiedFeed()) {
      return;
    }
    this.loadingMore.set(true);
    this.legacyClub.getCashout({ limit: 20, cursor }).subscribe({
      next: (res) => {
        this.ledgerItems.update((items) => [
          ...items,
          ...res.items.map((row) => ledgerItemToHistoryItem(row)),
        ]);
        this.nextCursor.set(res.nextCursor);
        this.loadingMore.set(false);
      },
      error: () => {
        this.error.set('Could not load more history.');
        this.loadingMore.set(false);
      },
    });
  }

  private loadInitial(): void {
    this.loading.set(true);
    this.error.set(null);

    this.legacyClub.getHistory().subscribe({
      next: (membership) => {
        const hasUnifiedLedger = membership.items.some(
          (item) => item.title && !isMembershipHistoryKind(item.kind),
        );

        if (hasUnifiedLedger) {
          this.unifiedFeed.set(true);
          this.membershipItems.set(membership.items);
          this.ledgerItems.set([]);
          this.nextCursor.set(membership.nextCursor ?? null);
          this.loading.set(false);
          return;
        }

        this.membershipItems.set(membership.items);
        this.legacyClub.getCashout({ limit: 50 }).subscribe({
          next: (cashout) => {
            this.ledgerItems.set(cashout.items.map((row) => ledgerItemToHistoryItem(row)));
            this.nextCursor.set(cashout.nextCursor);
            this.loading.set(false);
          },
          error: () => {
            this.ledgerItems.set([]);
            this.loading.set(false);
          },
        });
      },
      error: () => {
        this.error.set('Could not load history.');
        this.loading.set(false);
      },
    });
  }
}
