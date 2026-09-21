import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { LegacyClubService } from '../../../services/legacy-club.service';
import { LEGACY_ERROR_CODES, LegacyPackage, LegacyPackageCode } from '../../../core/models/legacy-club.models';
import { LegacyClubHttpError } from '../../../core/mocks/legacy-club.mock';
import { formatLegacyMoney } from '../../../core/utils/legacy-money.util';
import { legacyErrorMessage } from '../../../core/utils/legacy-error.util';

@Component({
  selector: 'app-legacy-join',
  imports: [CommonModule, FormsModule, RouterLink, ButtonModule, InputTextModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-mlm-background">
      <main class="py-8">
        <div class="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
      <a routerLink="/legacy/packages" class="text-sm font-medium text-mlm-primary hover:underline">← Packages</a>
      <h1 class="text-2xl font-bold text-mlm-text">Join Legacy Club</h1>

      @if (selectedPackage(); as pkg) {
        <div class="grid gap-5 lg:grid-cols-2">
        <div class="rounded-2xl border border-gray-100 bg-white p-6 sm:p-7">
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="text-xs font-bold uppercase tracking-[.15em] text-mlm-secondary">Package</p>
              <p class="mt-2 text-xl font-bold text-mlm-text">{{ pkg.name }}</p>
              <p class="text-sm text-mlm-secondary">{{ money(pkg.purchaseAmount) }} product purchase</p>
              <p class="mt-2 text-sm text-emerald-800">
                Instant {{ money(pkg.instantCommission) }} into your Legacy account
              </p>
            </div>
            <a routerLink="/legacy/packages" class="text-xs font-semibold text-mlm-primary hover:underline"
              >Change</a
            >
          </div>
        </div>

        <div class="rounded-2xl border border-gray-100 bg-white p-6 sm:p-7 space-y-3">
          <h2 class="text-base font-semibold text-mlm-text">Who is registering you?</h2>

          @if (isAuto()) {
            <p class="text-sm text-mlm-text">
              You will join under &#64;{{ me()?.defaultSponsor?.username }}.
            </p>
            <p class="text-sm text-mlm-secondary">
              This is your Segulah sponsor. They are already in Legacy Club, so you are placed under
              them automatically.
            </p>
          } @else {
            <p class="text-sm text-mlm-secondary">
              Your Segulah sponsor is not in Legacy Club. Enter the username of a member who is. You
              may call your sponsor and ask them to join first so you stay under them.
            </p>
            <label class="block text-sm font-medium text-mlm-text" for="sponsor">
              Legacy sponsor username
            </label>
            <input
              id="sponsor"
              pInputText
              class="w-full"
              [(ngModel)]="sponsorUsername"
              (blur)="onValidate()"
              placeholder="username"
            />
            @if (sponsorError()) {
              <p class="text-sm text-red-600">{{ sponsorError() }}</p>
            }
            @if (sponsorOk()) {
              <p class="text-sm text-emerald-700">
                Valid — &#64;{{ sponsorOk()?.username }} ({{ sponsorOk()?.legacyPackage }})
              </p>
            }
          }
        </div>
        </div>

        <p-button
          label="Continue to marketplace"
          styleClass="w-full sm:w-auto"
          [loading]="submitting()"
          [disabled]="!canContinue()"
          (onClick)="onContinue()"
        />
      } @else {
        <p class="text-sm text-mlm-secondary">Select a package first.</p>
        <a routerLink="/legacy/packages">
          <p-button label="View packages" />
        </a>
      }
        </div>
      </main>
    </div>
  `,
})
export class LegacyJoinComponent implements OnInit {
  private legacyClub = inject(LegacyClubService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private messages = inject(MessageService);

  me = this.legacyClub.me;
  packages = signal<LegacyPackage[]>([]);
  selectedCode = signal<LegacyPackageCode | null>(null);
  sponsorUsername = '';
  sponsorError = signal<string | null>(null);
  sponsorOk = signal<{ username: string; legacyPackage: string } | null>(null);
  submitting = signal(false);

  selectedPackage = computed(() => {
    const code = this.selectedCode();
    return this.packages().find((p) => p.code === code) ?? null;
  });

  isAuto = computed(() => this.me()?.sponsorResolution === 'AUTO');

  canContinue = computed(() => {
    if (!this.selectedPackage()) return false;
    if (this.isAuto()) return true;
    return !!this.sponsorOk();
  });

  ngOnInit(): void {
    const code = (this.route.snapshot.queryParamMap.get('package') ?? 'VIP').toUpperCase() as LegacyPackageCode;
    this.selectedCode.set(code);
    this.legacyClub.loadMe().subscribe({
      next: (me) => {
        if (me?.status === 'ACTIVE') {
          void this.router.navigate(['/legacy']);
        }
      },
    });
    this.legacyClub.getPackages().subscribe({
      next: (res) => this.packages.set(res.packages),
    });
  }

  money(amount: number): string {
    return formatLegacyMoney(amount, this.me()?.currency ?? 'NGN');
  }

  onValidate(): void {
    if (this.isAuto()) return;
    const username = this.sponsorUsername.trim();
    if (!username) {
      this.sponsorError.set('Enter a Legacy Club username.');
      this.sponsorOk.set(null);
      return;
    }
    this.legacyClub.validateSponsor(username).subscribe({
      next: (res) => {
        this.sponsorError.set(null);
        this.sponsorOk.set({ username: res.username, legacyPackage: res.legacyPackage });
      },
      error: (err: LegacyClubHttpError) => {
        this.sponsorOk.set(null);
        this.sponsorError.set(this.sponsorMessage(err));
      },
    });
  }

  onContinue(): void {
    const pkg = this.selectedPackage();
    if (!pkg || this.submitting()) return;
    this.submitting.set(true);
    const sponsor = this.isAuto() ? undefined : this.sponsorOk()?.username;
    this.legacyClub.startJoin(pkg.code, sponsor).subscribe({
      next: () => {
        this.submitting.set(false);
        void this.router.navigate(['/legacy/shop']);
      },
      error: (err: LegacyClubHttpError) => {
        this.submitting.set(false);
        if (err.code === LEGACY_ERROR_CODES.ALREADY_ACTIVE) {
          void this.router.navigate(['/legacy']);
          return;
        }
        this.sponsorError.set(legacyErrorMessage(err));
        this.messages.add({
          severity: 'error',
          summary: 'Join failed',
          detail: legacyErrorMessage(err),
        });
      },
    });
  }

  private sponsorMessage(err: LegacyClubHttpError): string {
    return legacyErrorMessage(err);
  }
}
