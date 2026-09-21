import { Component, ChangeDetectionStrategy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { LegacyClubService } from '../../../services/legacy-club.service';
import { LegacyPackage } from '../../../core/models/legacy-club.models';
import { formatLegacyMoney } from '../../../core/utils/legacy-money.util';

@Component({
  selector: 'app-legacy-packages',
  imports: [CommonModule, RouterLink, ButtonModule, SkeletonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-mlm-background">
      <main class="py-8">
        <div class="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between gap-3">
        <div>
          <a routerLink="/legacy" class="text-sm font-medium text-mlm-primary hover:underline">← Legacy Club</a>
          <h1 class="mt-1 text-2xl font-bold text-mlm-text">Choose your package</h1>
        </div>
      </div>

      @if (loading()) {
        <div class="grid gap-5 md:grid-cols-3">
          @for (_ of [1, 2, 3]; track $index) {
            <p-skeleton height="18rem" styleClass="rounded-2xl" />
          }
        </div>
      } @else {
        <div class="grid gap-5 md:grid-cols-3">
          @for (pkg of packages(); track pkg.code) {
            <article class="rounded-2xl border border-gray-100 bg-white p-6 sm:p-7">
              <h2 class="text-lg font-bold text-mlm-text">{{ pkg.name }}</h2>
              <p class="mt-3 text-3xl font-extrabold tracking-tight text-mlm-text">{{ money(pkg.purchaseAmount) }}</p>
              <ul class="mt-5 space-y-2 text-sm text-mlm-text">
                <li>Instant {{ money(pkg.instantCommission) }} → Legacy account</li>
                <li class="text-mlm-secondary">Monthly {{ money(pkg.monthlyCommission) }}</li>
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
        </div>
      </main>
    </div>
  `,
})
export class LegacyPackagesComponent implements OnInit {
  private legacyClub = inject(LegacyClubService);
  private router = inject(Router);

  packages = signal<LegacyPackage[]>([]);
  loading = signal(true);
  currency = signal<'NGN' | 'USD'>('NGN');

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
    void this.router.navigate(['/legacy/join'], { queryParams: { package: pkg.code } });
  }
}
