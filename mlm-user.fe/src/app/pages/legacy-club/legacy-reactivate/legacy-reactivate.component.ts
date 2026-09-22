import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';
import { LegacyClubService } from '../../../services/legacy-club.service';
import { LegacyCartService } from '../../../services/legacy-cart.service';
import { LegacyPackage, LegacyPackagesResponse } from '../../../core/models/legacy-club.models';
import { formatLegacyMoney } from '../../../core/utils/legacy-money.util';
import { LegacyClubHttpError } from '../../../core/mocks/legacy-club.mock';
import { LegacyPageShellComponent } from '../components/legacy-page-shell.component';
import { LegacyPageHeaderComponent } from '../components/legacy-page-header.component';
import { LegacyPanelComponent } from '../components/legacy-panel.component';

@Component({
  selector: 'app-legacy-reactivate',
  imports: [
    CommonModule,
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
        title="Reactivate Legacy Club"
        subtitle="Start a new 24-week cycle on your current package."
        backLink="/legacy"
        backLabel="Legacy Club"
      />

      @if (loading()) {
        <p-skeleton height="12rem" styleClass="rounded-xl" />
      } @else {
        <app-legacy-panel title="What happens next">
          <p class="text-sm leading-relaxed text-mlm-text">
            Buy products worth
            <span class="font-semibold">{{ money(purchaseAmount()) }}</span>
            again for {{ packageCode() }}. Full Instant
            <span class="font-semibold">{{ money(instantAmount()) }}</span>
            goes to your Legacy account.
          </p>
          @if (isQualified()) {
            <p class="text-sm text-emerald-800">
              You keep the increased weekly rate. You do not need 3 new Successlines.
            </p>
          } @else {
            <p class="text-sm text-mlm-secondary">
              Refer 3 Successlines to raise weekly on this new cycle. You can already cash out.
            </p>
          }
          <p class="text-sm text-mlm-secondary">
            New week 1 starts in 7 days after you reactivate. Pay with your Legacy product voucher.
          </p>
          <p-button
            label="Start reactivate"
            styleClass="w-full sm:w-auto"
            [loading]="starting()"
            (onClick)="start()"
          />
        </app-legacy-panel>
        @if (error()) {
          <app-legacy-panel>
            <p class="text-sm text-red-800">{{ error() }}</p>
          </app-legacy-panel>
        }
      }
    </app-legacy-page-shell>
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
          error: () => this.loading.set(false),
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
    this.legacyClub.startReactivate().subscribe({
      next: () => {
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
