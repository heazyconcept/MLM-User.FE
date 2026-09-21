import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SkeletonModule } from 'primeng/skeleton';
import { LegacyClubService } from '../../../services/legacy-club.service';
import {
  LegacyHistoryItem,
  LegacyHistoryKind,
} from '../../../core/models/legacy-club.models';
import { formatLegacyMoney } from '../../../core/utils/legacy-money.util';
import { LegacyPageShellComponent } from '../components/legacy-page-shell.component';
import { LegacyPageHeaderComponent } from '../components/legacy-page-header.component';
import { LegacyPanelComponent } from '../components/legacy-panel.component';

@Component({
  selector: 'app-legacy-history',
  imports: [
    CommonModule,
    SkeletonModule,
    LegacyPageShellComponent,
    LegacyPageHeaderComponent,
    LegacyPanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-legacy-page-shell>
      <app-legacy-page-header
        title="Legacy history"
        subtitle="Joined, upgrades, and reactivations — newest first."
        backLink="/legacy"
        backLabel="Legacy Club"
      />

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
      } @else if (items().length === 0) {
        <app-legacy-panel>
          <p class="text-sm text-mlm-secondary">No history yet.</p>
        </app-legacy-panel>
      } @else {
        <div class="space-y-3">
          @for (item of items(); track item.id) {
            <article class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <div class="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p class="font-semibold text-mlm-text">{{ kindLabel(item) }}</p>
                  <p class="mt-0.5 text-sm text-mlm-secondary">
                    {{ item.at | date: 'medium' }}
                  </p>
                </div>
                <div class="text-right">
                  <p class="font-semibold text-mlm-text">{{ money(item) }}</p>
                  <p class="text-xs text-mlm-secondary">Instant to Legacy account</p>
                </div>
              </div>
            </article>
          }
        </div>
      }
    </app-legacy-page-shell>
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
