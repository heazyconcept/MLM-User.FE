import { Component, ChangeDetectionStrategy, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { LegacyClubService } from '../../../services/legacy-club.service';
import { LegacyPackage } from '../../../core/models/legacy-club.models';
import { formatLegacyMoney } from '../../../core/utils/legacy-money.util';
import { formatLegacyJoinCancellationMessage } from '../../../core/utils/legacy-join-cancellation.util';
import { LegacyPageShellComponent } from '../components/legacy-page-shell.component';
import { LegacyPageHeaderComponent } from '../components/legacy-page-header.component';

@Component({
  selector: 'app-legacy-packages',
  imports: [
    CommonModule,
    ButtonModule,
    SkeletonModule,
    LegacyPageShellComponent,
    LegacyPageHeaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-legacy-page-shell>
      <app-legacy-page-header
        title="Choose your package"
        subtitle="Compare Legacy Club tiers and start your join flow."
        backLink="/legacy"
        backLabel="Legacy Club"
      />

      @if (cancellationMessage()) {
        <div
          class="mb-6 rounded-xl border border-amber-200 bg-amber-50/80 px-5 py-4 sm:px-6"
          role="alert">
          <p class="font-semibold text-mlm-text">Previous registration cancelled</p>
          <p class="mt-2 text-sm leading-relaxed text-mlm-secondary">
            {{ cancellationMessage() }}
          </p>
        </div>
      }

      @if (loading()) {
        <div class="grid gap-5 md:grid-cols-3">
          @for (_ of [1, 2, 3]; track $index) {
            <p-skeleton height="18rem" styleClass="rounded-xl" />
          }
        </div>
      } @else {
        <div class="grid gap-5 md:grid-cols-3">
          @for (pkg of packages(); track pkg.code) {
            <article
              class="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6"
            >
              <div class="flex items-center gap-2">
                <i class="pi pi-crown text-mlm-primary"></i>
                <h2 class="text-lg font-bold text-mlm-text">{{ pkg.name }}</h2>
              </div>
              <p class="mt-4 text-3xl font-extrabold tracking-tight text-mlm-text">
                {{ money(pkg.purchaseAmount) }}
              </p>
              <p class="text-sm text-mlm-secondary">Product purchase</p>
              <ul class="mt-5 flex-1 space-y-2 text-sm text-mlm-text">
                <li>Instant {{ money(pkg.instantCommission) }} → Legacy account</li>
                <li class="text-mlm-secondary">
                  Monthly {{ money(pkg.monthlyCommission) }}
                  ({{ money(pkg.monthlyCommission / 4) }} / week)
                </li>
                <li>Successline {{ pkg.successlineBonusPercent }}%</li>
                <li class="font-medium">6-month total {{ money(pkg.sixMonthTotal) }}</li>
              </ul>
              <p-button
                class="mt-6"
                styleClass="w-full"
                [label]="'Join as ' + pkg.code"
                (onClick)="select(pkg)"
              />
            </article>
          }
        </div>
      }
    </app-legacy-page-shell>
  `,
})
export class LegacyPackagesComponent implements OnInit {
  private legacyClub = inject(LegacyClubService);
  private router = inject(Router);

  packages = signal<LegacyPackage[]>([]);
  loading = signal(true);
  currency = signal<'NGN' | 'USD'>('NGN');
  me = this.legacyClub.me;

  cancellationMessage = computed(() => {
    const notice = this.me()?.joinCancellationNotice;
    if (!notice) return null;
    return formatLegacyJoinCancellationMessage(notice.reason);
  });

  ngOnInit(): void {
    this.legacyClub.loadMe().subscribe();
    this.legacyClub.getPackages().subscribe({
      next: (res) => {
        this.packages.set(res.packages.filter((p) => p.isActive));
        this.currency.set(res.currency);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  money(amount: number): string {
    return formatLegacyMoney(amount, this.currency());
  }

  select(pkg: LegacyPackage): void {
    if (this.me()?.joinCancellationNotice) {
      this.legacyClub.ackJoinCancellation().subscribe();
    }
    void this.router.navigate(['/legacy/join/sponsor'], { queryParams: { package: pkg.code } });
  }
}
