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
  LegacyMonthsResponse,
  LegacyMonthStatus,
  LegacyRateTier,
} from '../../../core/models/legacy-club.models';
import { formatLegacyMoney } from '../../../core/utils/legacy-money.util';
import {
  cyclePeriodCount,
  isWeeklyCycle,
  periodColumnHeader,
  periodLabel,
} from '../../../core/utils/legacy-cycle.util';
import { LegacyPageShellComponent } from '../components/legacy-page-shell.component';
import { LegacyPageHeaderComponent } from '../components/legacy-page-header.component';
import { LegacyPanelComponent } from '../components/legacy-panel.component';

@Component({
  selector: 'app-legacy-months',
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
        [title]="pageTitle()"
        [subtitle]="cycleSubtitle()"
        backLink="/legacy"
        backLabel="Legacy Club"
      >
        <a
          actions
          routerLink="/legacy/history"
          class="inline-flex min-h-10 items-center justify-center rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-mlm-text transition-colors hover:bg-gray-50"
        >
          View history
        </a>
      </app-legacy-page-header>

      @if (loading()) {
        <p-skeleton height="16rem" styleClass="rounded-2xl" />
      } @else if (error()) {
        <p class="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{{ error() }}</p>
      } @else {
        @if (qualifyBanner()) {
          <app-legacy-panel>
            <p class="text-sm text-emerald-900">{{ qualifyBanner() }}</p>
          </app-legacy-panel>
        }

        @if (firstPeriodHint(); as hint) {
          <p class="text-sm text-mlm-secondary">{{ hint }}</p>
        }

        <div class="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table class="min-w-full text-left text-sm">
            <thead class="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th class="px-5 py-4 font-semibold sm:px-6">{{ columnHeader() }}</th>
                <th class="px-5 py-4 font-semibold sm:px-6">Due</th>
                <th class="px-5 py-4 font-semibold sm:px-6">Amount</th>
                @if (showSplitColumns()) {
                  <th class="px-5 py-4 font-semibold sm:px-6">Cashout</th>
                  <th class="px-5 py-4 font-semibold sm:px-6">Voucher (net)</th>
                }
                <th class="px-5 py-4 font-semibold sm:px-6">Rate</th>
                <th class="px-5 py-4 font-semibold sm:px-6">Status</th>
              </tr>
            </thead>
            <tbody>
              @for (row of months(); track row.periodIndex) {
                <tr class="border-b border-gray-50 last:border-0">
                  <td class="px-4 py-3 font-medium text-gray-900">
                    {{ rowPeriodLabel(row.periodIndex) }}
                  </td>
                  <td class="px-4 py-3 text-gray-700">{{ row.dueAt | date: 'mediumDate' }}</td>
                  <td class="px-4 py-3 font-semibold text-gray-900">{{ money(row.amount) }}</td>
                  @if (showSplitColumns()) {
                    <td class="px-4 py-3 text-gray-700">
                      {{ row.cashoutAmount != null ? money(row.cashoutAmount) : '—' }}
                    </td>
                    <td class="px-4 py-3 text-gray-700">
                      {{ row.voucherNet != null ? money(row.voucherNet) : '—' }}
                    </td>
                  }
                  <td class="px-4 py-3">
                    <span
                      class="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold"
                      [class]="
                        row.rateTier === 'INCREASED'
                          ? 'bg-emerald-50 text-emerald-800'
                          : 'bg-gray-100 text-gray-700'
                      "
                    >
                      {{ rateLabel(row.rateTier) }}
                    </span>
                  </td>
                  <td class="px-4 py-3">
                    <span
                      class="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold"
                      [class]="statusChipClass(row.status)"
                    >
                      {{ statusLabel(row.status) }}
                    </span>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (priorPending().length > 0) {
          <div class="space-y-3">
            <h2 class="text-lg font-semibold text-gray-900">
              Waiting weeks from an old cycle
            </h2>
            <p class="text-sm text-mlm-secondary">
              These are catch-up periods from before your upgrade. They drop automatically — you do
              not need to place an order.
            </p>
            <div class="overflow-x-auto rounded-2xl border border-amber-100 bg-amber-50/40 shadow-sm">
              <table class="min-w-full text-left text-sm">
                <thead class="border-b border-amber-100 text-xs uppercase tracking-wide text-amber-800">
                  <tr>
                    <th class="px-4 py-3 font-semibold">Package</th>
                    <th class="px-4 py-3 font-semibold">{{ columnHeader() }}</th>
                    <th class="px-4 py-3 font-semibold">Due</th>
                    <th class="px-4 py-3 font-semibold">Amount</th>
                    <th class="px-4 py-3 font-semibold">Rate</th>
                    <th class="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  @for (
                    row of priorPending();
                    track row.cyclePackage + '-' + row.periodIndex + '-' + row.dueAt
                  ) {
                    <tr class="border-b border-amber-50 last:border-0">
                      <td class="px-4 py-3 font-medium text-gray-900">{{ row.cyclePackage }}</td>
                      <td class="px-4 py-3 text-gray-700">{{ rowPeriodLabel(row.periodIndex) }}</td>
                      <td class="px-4 py-3 text-gray-700">{{ row.dueAt | date: 'mediumDate' }}</td>
                      <td class="px-4 py-3 font-semibold text-gray-900">{{ money(row.amount) }}</td>
                      <td class="px-4 py-3">
                        <span
                          class="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold"
                          [class]="
                            row.rateTier === 'INCREASED'
                              ? 'bg-emerald-50 text-emerald-800'
                              : 'bg-gray-100 text-gray-700'
                          "
                        >
                          {{ rateLabel(row.rateTier) }}
                        </span>
                      </td>
                      <td class="px-4 py-3">
                        <span
                          class="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold"
                          [class]="statusChipClass(row.status)"
                        >
                          {{ statusLabel(row.status) }}
                        </span>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }

        @if (pendingTotal() > 0) {
          <app-legacy-panel>
            <p class="text-sm text-mlm-secondary">Processing total</p>
            <p class="text-lg font-bold text-mlm-text">{{ money(pendingTotal()) }}</p>
            <p class="mt-1 text-xs text-mlm-secondary">
              These periods are due and will drop automatically.
            </p>
          </app-legacy-panel>
        }
      }
    </app-legacy-page-shell>
  `,
})
export class LegacyMonthsComponent implements OnInit {
  private legacyClub = inject(LegacyClubService);
  private router = inject(Router);

  loading = signal(true);
  error = signal<string | null>(null);
  data = signal<LegacyMonthsResponse | null>(null);

  months = computed(() => this.data()?.months ?? []);
  priorPending = computed(() => this.data()?.priorPending ?? []);

  pendingTotal = computed(() => {
    const fromApi = this.data()?.pendingTotal;
    if (typeof fromApi === 'number') return fromApi;
    const current = this.months()
      .filter((m) => m.status === 'PENDING')
      .reduce((sum, m) => sum + m.amount, 0);
    const prior = this.priorPending()
      .filter((m) => m.status === 'PENDING')
      .reduce((sum, m) => sum + m.amount, 0);
    return current + prior;
  });

  showSplitColumns = computed(() =>
    this.months().some((m) => m.cashoutAmount != null || m.voucherNet != null),
  );

  pageTitle = computed(() =>
    isWeeklyCycle(this.data()) ? 'Your weekly cycle' : 'Your cycle',
  );

  columnHeader = computed(() => periodColumnHeader(this.data()));

  ngOnInit(): void {
    this.legacyClub.loadMe().subscribe({
      next: (me) => {
        if (me?.status !== 'ACTIVE') {
          void this.router.navigate(['/legacy']);
          return;
        }
        this.legacyClub.getMonths().subscribe({
          next: (res) => {
            this.data.set(res);
            this.loading.set(false);
          },
          error: () => {
            this.error.set('Could not load your weekly cycle.');
            this.loading.set(false);
          },
        });
      },
    });
  }

  cycleSubtitle(): string {
    const data = this.data();
    const started = data?.cycleStartedAt;
    const total = cyclePeriodCount(data);
    if (isWeeklyCycle(data)) {
      const base = started
        ? `This cycle, from ${new Date(started).toLocaleDateString(undefined, { dateStyle: 'medium' })}.`
        : '';
      return `${base} ${total} weeks · every 7 days.`.trim();
    }
    if (started) {
      return `This cycle, from ${new Date(started).toLocaleDateString(undefined, { dateStyle: 'medium' })}.`;
    }
    return '';
  }

  rowPeriodLabel(index: number): string {
    return periodLabel(index, this.data());
  }

  money(amount: number): string {
    return formatLegacyMoney(amount, this.data()?.currency ?? this.legacyClub.me()?.currency ?? 'NGN');
  }

  rateLabel(tier: LegacyRateTier): string {
    return tier === 'INCREASED' ? 'Increased' : 'Base';
  }

  statusLabel(status: LegacyMonthStatus): string {
    switch (status) {
      case 'PENDING':
        return 'Processing';
      case 'DROPPED':
        return 'Paid';
      case 'SCHEDULED':
        return 'Scheduled';
      default: {
        const _exhaustive: never = status;
        return _exhaustive;
      }
    }
  }

  statusChipClass(status: LegacyMonthStatus): string {
    switch (status) {
      case 'PENDING':
        return 'bg-amber-100 text-amber-900';
      case 'DROPPED':
        return 'bg-emerald-50 text-emerald-800';
      case 'SCHEDULED':
        return 'bg-gray-100 text-gray-600';
      default: {
        const _exhaustive: never = status;
        return _exhaustive;
      }
    }
  }

  qualifyBanner(): string | null {
    const q = this.data()?.monthlyQualify ?? this.legacyClub.me()?.monthlyQualify;
    if (!q?.isQualified) return null;
    return 'You now earn the increased weekly rate. Future weeks use the increased amount.';
  }

  firstPeriodHint(): string | null {
    const months = this.months();
    if (months.length === 0) return null;
    const first = months.find((m) => m.periodIndex === 1) ?? months[0];
    if (first.status !== 'SCHEDULED') return null;
    const now = Date.now();
    const due = new Date(first.dueAt).getTime();
    if (Number.isNaN(due) || due <= now) return null;
    const label = isWeeklyCycle(this.data()) ? 'first weekly' : 'first period';
    return `Your ${label} is due on ${new Date(first.dueAt).toLocaleDateString()}. Instant is already in your Legacy account.`;
  }
}
