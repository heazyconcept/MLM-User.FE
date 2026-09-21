import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { SkeletonModule } from 'primeng/skeleton';
import { LegacyClubService } from '../../../services/legacy-club.service';
import {
  LegacyHistoryItem,
  LegacyHistoryKind,
} from '../../../core/models/legacy-club.models';
import { formatLegacyMoney } from '../../../core/utils/legacy-money.util';

@Component({
  selector: 'app-legacy-history',
  imports: [CommonModule, RouterLink, SkeletonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-mlm-background">
      <main class="py-8">
        <div class="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
      <a routerLink="/legacy" class="text-sm font-medium text-mlm-primary hover:underline">← Legacy Club</a>
      <h1 class="text-2xl font-bold text-mlm-text">Legacy history</h1>
      <p class="text-sm text-mlm-secondary">Joined, upgrades, and reactivations — newest first.</p>

      @if (loading()) {
        <div class="space-y-3">
          @for (_ of [1, 2, 3]; track $index) {
            <p-skeleton height="4.5rem" styleClass="rounded-xl" />
          }
        </div>
      } @else if (error()) {
        <p class="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{{ error() }}</p>
      } @else if (items().length === 0) {
        <p class="text-gray-500">No history yet.</p>
      } @else {
        <div class="space-y-3">
          @for (item of items(); track item.id) {
            <article class="rounded-2xl border border-gray-100 bg-white p-5 sm:p-6">
              <div class="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p class="font-semibold text-gray-900">{{ kindLabel(item) }}</p>
                  <p class="mt-0.5 text-sm text-mlm-secondary">
                    {{ item.at | date: 'medium' }}
                  </p>
                </div>
                <div class="text-right">
                  <p class="font-semibold text-gray-900">{{ money(item) }}</p>
                  <p class="text-xs text-gray-500">Instant to Legacy account</p>
                </div>
              </div>
            </article>
          }
        </div>
      }
        </div>
      </main>
    </div>
  `,
})
export class LegacyHistoryComponent implements OnInit {
  private legacyClub = inject(LegacyClubService);
  private router = inject(Router);

  loading = signal(true);
  error = signal<string | null>(null);
  items = signal<LegacyHistoryItem[]>([]);

  ngOnInit(): void {
    this.legacyClub.loadMe().subscribe({
      next: (me) => {
        if (me?.status !== 'ACTIVE') {
          void this.router.navigate(['/legacy']);
          return;
        }
        this.legacyClub.getHistory().subscribe({
          next: (res) => {
            this.items.set(res.items ?? []);
            this.loading.set(false);
          },
          error: () => {
            this.error.set('Could not load history.');
            this.loading.set(false);
          },
        });
      },
    });
  }

  money(item: LegacyHistoryItem): string {
    return formatLegacyMoney(item.instantAmount, item.currency);
  }

  kindLabel(item: LegacyHistoryItem): string {
    const kind: LegacyHistoryKind = item.kind;
    switch (kind) {
      case 'JOIN':
        return `Joined ${item.package}`;
      case 'UPGRADE':
        return item.fromPackage
          ? `Upgraded ${item.fromPackage} → ${item.package}`
          : `Upgraded to ${item.package}`;
      case 'REACTIVATE':
        return `Reactivated ${item.package}`;
      case 'SEED':
        return `Joined ${item.package} (admin seed)`;
      default: {
        const _exhaustive: never = kind;
        return _exhaustive;
      }
    }
  }
}
