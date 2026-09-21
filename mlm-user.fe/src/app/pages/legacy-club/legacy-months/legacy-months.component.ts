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

@Component({
  selector: 'app-legacy-months',
  imports: [CommonModule, RouterLink, ButtonModule, SkeletonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-mlm-background">
      <main class="py-8">
        <div class="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
      <a routerLink="/legacy" class="text-sm font-medium text-mlm-primary hover:underline">← Legacy Club</a>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-mlm-text">Your 6-month cycle</h1>
          @if (data()?.cycleStartedAt; as started) {
            <p class="mt-1 text-sm text-mlm-secondary">
              This cycle, from {{ started | date: 'mediumDate' }}. Each month is 30 days.
            </p>
          } @else {
            <p class="mt-1 text-sm text-mlm-secondary">Each month is 30 days.</p>
          }
        </div>
        <a routerLink="/legacy/history" class="text-sm font-medium font-semibold text-mlm-primary hover:underline">
          View history
        </a>
      </div>

      @if (loading()) {
        <p-skeleton height="16rem" styleClass="rounded-2xl" />
      } @else if (error()) {
        <p class="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{{ error() }}</p>
      } @else {
        @if (qualifyBanner()) {
          <div class="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
            {{ qualifyBanner() }}
          </div>
        }

        @if (firstMonthHint(); as hint) {
          <p class="text-sm text-mlm-secondary">{{ hint }}</p>
        }

        <div class="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table class="min-w-full text-left text-sm">
            <thead class="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th class="px-5 py-4 font-semibold sm:px-6">Month</th>
                <th class="px-5 py-4 font-semibold sm:px-6">Due</th>
                <th class="px-5 py-4 font-semibold sm:px-6">Amount</th>
                <th class="px-5 py-4 font-semibold sm:px-6">Rate</th>
                <th class="px-5 py-4 font-semibold sm:px-6">Status</th>
              </tr>
            </thead>
            <tbody>
              @for (row of months(); track row.periodIndex) {
                <tr class="border-b border-gray-50 last:border-0">
                  <td class="px-4 py-3 font-medium text-gray-900">{{ row.periodIndex }}</td>
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

        @if (priorPending().length > 0) {
          <div class="space-y-3">
            <h2 class="text-lg font-semibold text-gray-900">Waiting from previous cycle</h2>
            <div class="overflow-x-auto rounded-2xl border border-amber-100 bg-amber-50/40 shadow-sm">
              <table class="min-w-full text-left text-sm">
                <thead class="border-b border-amber-100 text-xs uppercase tracking-wide text-amber-800">
                  <tr>
                    <th class="px-4 py-3 font-semibold">Package</th>
                    <th class="px-4 py-3 font-semibold">Month</th>
                    <th class="px-4 py-3 font-semibold">Due</th>
                    <th class="px-4 py-3 font-semibold">Amount</th>
                    <th class="px-4 py-3 font-semibold">Rate</th>
                    <th class="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of priorPending(); track row.cyclePackage + '-' + row.periodIndex + '-' + row.dueAt) {
                    <tr class="border-b border-amber-50 last:border-0">
                      <td class="px-4 py-3 font-medium text-gray-900">{{ row.cyclePackage }}</td>
                      <td class="px-4 py-3 text-gray-700">{{ row.periodIndex }}</td>
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

        <div
          class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white px-5 py-4 shadow-sm"
        >
          <div>
            <p class="text-sm text-mlm-secondary">Pending total</p>
            <p class="text-lg font-bold text-gray-900">{{ money(pendingTotal()) }}</p>
          </div>
          @if (shopMode() === 'AUTOSHIP') {
            <a routerLink="/legacy/shop">
              <p-button label="Do Autoship" />
            </a>
          }
        </div>
      }
        </div>
      </main>
    </div>
  `,
})
export class LegacyMonthsComponent implements OnInit {
  private legacyClub = inject(LegacyClubService);
  private router = inject(Router);

  loading = signal(true);
  error = signal<string | null>(null);
  data = signal<LegacyMonthsResponse | null>(null);
  shopMode = this.legacyClub.shopMode;

  months = computed(() => this.data()?.months ?? []);
  priorPending = computed(() => this.data()?.priorPending ?? []);

  pendingTotal = computed(() => {
    const current = this.months()
      .filter((m) => m.status === 'PENDING')
      .reduce((sum, m) => sum + m.amount, 0);
    const prior = this.priorPending()
      .filter((m) => m.status === 'PENDING')
      .reduce((sum, m) => sum + m.amount, 0);
    return current + prior;
  });

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
            this.error.set('Could not load your 6-month cycle.');
            this.loading.set(false);
          },
        });
      },
    });
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
        return 'Waiting for Autoship';
      case 'DROPPED':
        return 'In Legacy account';
      case 'SCHEDULED':
        return 'Not due yet';
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
    return 'Future months use the increased commission. Months already waiting keep their amount.';
  }

  firstMonthHint(): string | null {
    const months = this.months();
    if (months.length === 0) return null;
    const first = months.find((m) => m.periodIndex === 1) ?? months[0];
    if (first.status !== 'SCHEDULED') return null;
    const now = Date.now();
    const due = new Date(first.dueAt).getTime();
    if (Number.isNaN(due) || due <= now) return null;
    return `Your first monthly is due on ${new Date(first.dueAt).toLocaleDateString()}. Instant is already in your Legacy account.`;
  }
}
