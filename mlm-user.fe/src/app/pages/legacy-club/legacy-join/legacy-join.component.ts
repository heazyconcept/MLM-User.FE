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
import { LegacyPageShellComponent } from '../components/legacy-page-shell.component';
import { LegacyPageHeaderComponent } from '../components/legacy-page-header.component';
import { LegacyPanelComponent } from '../components/legacy-panel.component';

@Component({
  selector: 'app-legacy-join',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ButtonModule,
    InputTextModule,
    LegacyPageShellComponent,
    LegacyPageHeaderComponent,
    LegacyPanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-legacy-page-shell>
      <app-legacy-page-header
        title="Join Legacy Club"
        subtitle="Confirm your package and sponsor before payment."
        backLink="/legacy/join"
        backLabel="Packages"
      />

      @if (selectedPackage(); as pkg) {
        <div class="grid gap-6 lg:grid-cols-2">
          <app-legacy-panel title="Package">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-xl font-bold text-mlm-text">{{ pkg.name }}</p>
                <p class="mt-1 text-sm text-mlm-secondary">
                  {{ money(pkg.purchaseAmount) }} product purchase
                </p>
                <p class="mt-2 text-sm text-emerald-800">
                  Instant {{ money(pkg.instantCommission) }} into your Legacy account
                </p>
              </div>
              <a
                routerLink="/legacy/join"
                class="text-xs font-semibold text-mlm-primary hover:underline"
              >
                Change
              </a>
            </div>
          </app-legacy-panel>

          <app-legacy-panel title="Who is registering you?">
            @if (isAuto()) {
              <p class="text-sm text-mlm-text">
                You will join under &#64;{{ me()?.defaultSponsor?.username }}.
              </p>
              <p class="text-sm text-mlm-secondary">
                This is your Segulah sponsor. They are already in Legacy Club, so you are placed
                under them automatically.
              </p>
            } @else {
              <p class="text-sm text-mlm-secondary">
                Your Segulah sponsor is not in Legacy Club. Enter the username of a member who is.
                You may call your sponsor and ask them to join first so you stay under them.
              </p>
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-semibold text-gray-700" for="sponsor">
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
              </div>
              @if (sponsorError()) {
                <p class="text-sm text-red-600">{{ sponsorError() }}</p>
              }
              @if (sponsorOk()) {
                <p class="text-sm text-emerald-700">
                  Valid — &#64;{{ sponsorOk()?.username }} ({{ sponsorOk()?.legacyPackage }})
                </p>
              }
            }
          </app-legacy-panel>
        </div>

        <p-button
          label="Continue to marketplace"
          styleClass="w-full sm:w-auto"
          [loading]="submitting()"
          [disabled]="!canContinue()"
          (onClick)="onContinue()"
        />
      } @else {
        <app-legacy-panel>
          <p class="text-sm text-mlm-secondary">Select a package first.</p>
          <a routerLink="/legacy/packages" class="mt-4 inline-block">
            <p-button label="View packages" />
          </a>
        </app-legacy-panel>
      }
    </app-legacy-page-shell>
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
          void this.router.navigate(['/legacy/home']);
        }
        if (me?.status === 'PENDING_JOIN') {
          void this.router.navigate(['/legacy/pay/JOIN']);
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
        void this.router.navigate(['/legacy/pay/JOIN']);
      },
      error: (err: LegacyClubHttpError) => {
        this.submitting.set(false);
        if (err.code === LEGACY_ERROR_CODES.ALREADY_ACTIVE) {
          void this.router.navigate(['/legacy/home']);
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
