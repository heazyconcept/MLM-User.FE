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
import { MessageService } from 'primeng/api';
import { LegacyClubService } from '../../../services/legacy-club.service';
import { LegacyCartService } from '../../../services/legacy-cart.service';
import { LegacyPackage, LegacyPackagesResponse } from '../../../core/models/legacy-club.models';
import { formatLegacyMoney } from '../../../core/utils/legacy-money.util';
import { LegacyClubHttpError } from '../../../core/mocks/legacy-club.mock';

@Component({
  selector: 'app-legacy-reactivate',
  imports: [CommonModule, RouterLink, ButtonModule, SkeletonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-mlm-background">
      <main class="py-8">
        <div class="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
      <a routerLink="/legacy" class="text-sm font-medium text-mlm-primary hover:underline">← Legacy Club</a>
      <h1 class="text-2xl font-bold text-mlm-text">Reactivate Legacy Club</h1>

      @if (loading()) {
        <p-skeleton height="12rem" styleClass="rounded-2xl" />
      } @else {
        <div class="rounded-2xl border border-gray-100 bg-white p-6 sm:p-8 space-y-4">
          <p class="text-sm leading-relaxed text-mlm-text">
            Buy products worth
            <span class="font-semibold">{{ money(purchaseAmount()) }}</span>
            again for {{ packageCode() }}. Full Instant
            <span class="font-semibold">{{ money(instantAmount()) }}</span>
            goes to your Legacy account.
          </p>
          @if (isQualified()) {
            <p class="text-sm text-emerald-800">
              You keep the increased monthly. You do not need 3 new Successlines.
            </p>
          } @else {
            <p class="text-sm text-mlm-secondary">
              Refer 3 Successlines to raise monthly on this new cycle. You can already cash out.
            </p>
          }
          <p class="text-sm text-mlm-secondary">
            Waiting months are not cancelled. Pay with your Legacy product voucher.
          </p>
          <p-button
            class="mt-2"
            label="Start reactivate"
            styleClass="w-full sm:w-auto"
            [loading]="starting()"
            (onClick)="start()"
          />
        </div>
        @if (error()) {
          <p class="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{{ error() }}</p>
        }
      }
        </div>
      </main>
    </div>
  `,
})
export class LegacyReactivateComponent implements OnInit {
  private legacyClub = inject(LegacyClubService);
  private cart = inject(LegacyCartService);
  private router = inject(Router);
  private messages = inject(MessageService);

  loading = signal(true);
  starting = signal(false);
  error = signal<string | null>(null);
  packageInfo = signal<LegacyPackage | null>(null);

  packageCode = computed(() => this.legacyClub.me()?.membership?.package ?? 'VIP');
  purchaseAmount = computed(() => this.packageInfo()?.purchaseAmount ?? 0);
  instantAmount = computed(() => this.packageInfo()?.instantCommission ?? 0);
  isQualified = computed(() => !!this.legacyClub.me()?.monthlyQualify?.isQualified);

  ngOnInit(): void {
    this.legacyClub.loadMe().subscribe({
      next: (me) => {
        if (me?.status !== 'ACTIVE' || !me.canReactivate) {
          void this.router.navigate(['/legacy']);
          return;
        }
        this.legacyClub.getPackages().subscribe({
          next: (res: LegacyPackagesResponse) => {
            const pkg = res.packages.find((p) => p.code === me.membership?.package) ?? null;
            this.packageInfo.set(pkg);
            if (pkg) this.cart.setReactivateFloor(pkg.purchaseAmount);
            this.loading.set(false);
          },
          error: () => {
            this.error.set('Could not load package details.');
            this.loading.set(false);
          },
        });
      },
    });
  }

  money(amount: number): string {
    return formatLegacyMoney(amount, this.legacyClub.me()?.currency ?? 'NGN');
  }

  start(): void {
    if (this.starting()) return;
    this.starting.set(true);
    this.error.set(null);
    const floor = this.purchaseAmount();
    this.legacyClub.startReactivate().subscribe({
      next: () => {
        if (floor > 0) this.cart.setReactivateFloor(floor);
        this.starting.set(false);
        void this.router.navigate(['/legacy/shop']);
      },
      error: (err: LegacyClubHttpError) => {
        this.starting.set(false);
        this.error.set(err.message ?? 'Could not start reactivate.');
        this.messages.add({
          severity: 'error',
          summary: 'Reactivate',
          detail: err.message ?? 'Could not start reactivate.',
        });
      },
    });
  }
}
