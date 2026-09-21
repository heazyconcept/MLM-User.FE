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
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { LegacyClubService } from '../../../services/legacy-club.service';
import { UserService } from '../../../services/user.service';
import {
  LegacyMemberLookup,
  LegacyPackage,
  LegacyPackagesResponse,
  LegacyRateTier,
} from '../../../core/models/legacy-club.models';
import { formatLegacyMoney } from '../../../core/utils/legacy-money.util';

type LookupResultKind = 'ready' | 'already' | 'not-member' | null;

@Component({
  selector: 'app-legacy-home',
  imports: [CommonModule, FormsModule, RouterLink, ButtonModule, InputTextModule, SkeletonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-mlm-background">
      <main class="py-8">
        <div class="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
      @if (loading()) {
        <p-skeleton height="8rem" styleClass="rounded-2xl" />
        <div class="grid gap-5 md:grid-cols-3">
          @for (_ of [1, 2, 3]; track $index) {
            <p-skeleton height="16rem" styleClass="rounded-2xl" />
          }
        </div>
      } @else if (status() === 'ACTIVE') {
        <!-- Member home -->
        <header class="rounded-2xl bg-mlm-primary px-6 py-6 sm:px-8 sm:py-7">
          <div class="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0">
              <p class="mb-2 text-xs font-bold uppercase tracking-[.15em] text-white/60">Legacy Club</p>
              <h1 class="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                {{ me()?.membership?.package }} Member
              </h1>
              <p class="mt-2 text-sm text-white/70">
                Joined {{ me()?.membership?.joinedAt | date: 'mediumDate' }}
              </p>
              <p class="mt-1 text-sm text-white/80">
                Registered by &#64;{{ me()?.membership?.sponsorUsername }}
                <span
                  class="ml-2 inline-flex rounded-full bg-white/15 px-2 py-0.5 text-xs font-medium text-white"
                >
                  {{ me()?.membership?.sponsorSource === 'AUTO' ? 'Automatic' : 'Chosen' }}
                </span>
              </p>
            </div>
            <a
              routerLink="/legacy/history"
              class="inline-flex shrink-0 items-center rounded-xl bg-white/15 px-4 py-2.5 text-xs font-bold tracking-wide text-white whitespace-nowrap hover:bg-white/25"
            >
              View history
            </a>
          </div>
        </header>

        <div class="grid gap-5 md:grid-cols-3">
          <div class="rounded-2xl border border-gray-100 bg-white p-6 sm:p-7">
            <p class="text-xs font-bold uppercase tracking-[.15em] text-mlm-secondary">Legacy account</p>
            <p class="mt-3 text-3xl font-extrabold tracking-tight text-mlm-text">
              {{ money(me()?.legacyCashout?.balance ?? 0) }}
            </p>
            <p class="mt-2 text-sm text-mlm-secondary">You can cash out or move this money at any time.</p>
            <a routerLink="/legacy/cashout" class="mt-5 block">
              <p-button label="Open Legacy account" styleClass="w-full" />
            </a>
          </div>

          <div class="rounded-2xl border border-gray-100 bg-white p-6 sm:p-7">
            <p class="text-xs font-bold uppercase tracking-[.15em] text-mlm-secondary">
              Legacy product voucher
            </p>
            <p class="mt-3 text-3xl font-extrabold tracking-tight text-mlm-text">
              {{ money(me()?.legacyVoucher?.balance ?? 0) }}
            </p>
            <a routerLink="/legacy/voucher" class="mt-5 block">
              <p-button label="Fund voucher" [outlined]="true" styleClass="w-full" />
            </a>
          </div>

          <div class="rounded-2xl border border-gray-100 bg-white p-6 sm:p-7">
            <p class="text-xs font-bold uppercase tracking-[.15em] text-mlm-secondary">My Successlines</p>
            <p class="mt-3 text-3xl font-extrabold tracking-tight text-mlm-text">{{ me()?.directSuccesslineCount ?? 0 }}</p>
            <p class="mt-2 text-sm text-mlm-secondary">
              3 Successlines will raise your monthly commission later.
            </p>
            <div class="mt-5 flex flex-col gap-2">
              <a routerLink="/legacy/successlines">
                <p-button label="View Successlines" [outlined]="true" styleClass="w-full" />
              </a>
              <p-button
                label="Register someone"
                [text]="true"
                styleClass="w-full"
                (onClick)="showRegisterHint.set(!showRegisterHint())"
              />
            </div>
          </div>
        </div>

        @if (cycle(); as cycle) {
          <div class="grid gap-5 lg:grid-cols-2">
            <div class="rounded-2xl border border-gray-100 bg-white p-6 sm:p-7">
              <p class="text-xs font-bold uppercase tracking-[.15em] text-mlm-secondary">
                Monthly Membership Commission
              </p>
              @if (cycle.pendingCount > 0) {
                <p class="mt-3 text-3xl font-extrabold tracking-tight text-mlm-text">
                  {{ money(cycle.pendingAmount) }} pending
                </p>
                <span
                  class="mt-3 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  [class]="
                    cycle.nextDueRateTier === 'INCREASED'
                      ? 'bg-emerald-50 text-emerald-800'
                      : 'bg-gray-100 text-gray-700'
                  "
                >
                  {{ rateLabel(cycle.nextDueRateTier) }}
                </span>
                <p class="mt-2 text-sm text-mlm-secondary">
                  This waits until you complete Autoship. It will not cancel.
                </p>
              } @else if (cycle.isCycleComplete) {
                <p class="mt-3 text-lg font-semibold text-mlm-text">
                  {{ cycle.cycleMonths }} of {{ cycle.cycleMonths }} months paid into your Legacy
                  account
                </p>
              } @else if (cycle.nextDueAt) {
                <p class="mt-3 text-lg font-semibold text-mlm-text">
                  Next month {{ money(cycle.nextDueAmount) }} on
                  {{ cycle.nextDueAt | date: 'mediumDate' }}
                </p>
                <span
                  class="mt-3 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  [class]="
                    cycle.nextDueRateTier === 'INCREASED'
                      ? 'bg-emerald-50 text-emerald-800'
                      : 'bg-gray-100 text-gray-700'
                  "
                >
                  {{ rateLabel(cycle.nextDueRateTier) }}
                </span>
              } @else {
                <p class="mt-3 text-sm text-mlm-secondary">No monthly due right now.</p>
              }
              <p class="mt-3 text-sm text-mlm-secondary">{{ qualifyHint() }}</p>
              <a routerLink="/legacy/months" class="mt-5 block">
                <p-button label="View 6-month cycle" [outlined]="true" styleClass="w-full" />
              </a>
            </div>

            <div class="rounded-2xl border border-gray-100 bg-white p-6 sm:p-7">
              <p class="text-xs font-bold uppercase tracking-[.15em] text-mlm-secondary">Autoship</p>
              <p class="mt-3 text-sm leading-relaxed text-mlm-text">
                Buy products of your choice from the Legacy marketplace, worth at least
                {{ money(me()?.autoship?.requiredAmount ?? 0) }}. Pay with your Legacy product
                voucher.
              </p>
              @if (shopMode() === 'AUTOSHIP') {
                <a routerLink="/legacy/shop" class="mt-5 block">
                  <p-button label="Shop Autoship" styleClass="w-full" />
                </a>
              } @else if (cycle.nextDueAt && !cycle.isCycleComplete) {
                <p class="mt-5 text-sm text-emerald-800">
                  You are up to date. Shop again after {{ cycle.nextDueAt | date: 'mediumDate' }}.
                </p>
                <p class="mt-1 text-xs text-mlm-secondary">Extra shop = PV only.</p>
              } @else {
                <p class="mt-5 text-sm text-mlm-secondary">Autoship is not required right now.</p>
              }
              <p class="mt-3 text-xs text-mlm-secondary">
                This is not the Segulah Autoship wallet or the network Product Voucher.
              </p>
            </div>
          </div>

          @if (cycle.isCycleComplete) {
            <div class="rounded-2xl border border-mlm-secondary/15 bg-white px-6 py-5">
              <p class="font-semibold text-mlm-text">Your 6-month cycle is complete.</p>
              <p class="mt-1 text-sm text-mlm-secondary">
                Pending still drops when you do Autoship.
              </p>
              @if (me()?.monthlyQualify?.isQualified) {
                <p class="mt-1 text-sm text-mlm-secondary">
                  When you reactivate, you keep the increased monthly.
                </p>
              }
            </div>
          }

          @if ((me()?.upgradeTargets?.length ?? 0) > 0 || me()?.canReactivate) {
            <div class="grid gap-5 lg:grid-cols-2">
              @if ((me()?.upgradeTargets?.length ?? 0) > 0) {
                <div class="rounded-2xl border border-gray-100 bg-white p-6 sm:p-7">
                  <p class="text-xs font-bold uppercase tracking-[.15em] text-mlm-secondary">Upgrade</p>
                  <p class="mt-3 text-sm leading-relaxed text-mlm-text">
                    Pay the difference in products only (Legacy voucher). Your 6 months start again
                    from month 1. Instant goes to your Legacy account.
                  </p>
                  <a routerLink="/legacy/upgrade" class="mt-5 block">
                    <p-button label="Upgrade" styleClass="w-full" />
                  </a>
                </div>
              }
              @if (me()?.canReactivate) {
                <div class="rounded-2xl border border-gray-100 bg-white p-6 sm:p-7">
                  <p class="text-xs font-bold uppercase tracking-[.15em] text-mlm-secondary">
                    Reactivate
                  </p>
                  <p class="mt-3 text-sm leading-relaxed text-mlm-text">
                    Buy products worth your full package again. Full Instant goes to your Legacy
                    account.
                  </p>
                  @if (me()?.monthlyQualify?.isQualified) {
                    <p class="mt-2 text-sm text-emerald-800">
                      You keep the increased monthly. You do not need 3 new Successlines.
                    </p>
                  } @else {
                    <p class="mt-2 text-sm text-mlm-secondary">
                      Refer 3 Successlines to raise monthly on this new cycle. You can already cash
                      out.
                    </p>
                  }
                  <a routerLink="/legacy/reactivate" class="mt-5 block">
                    <p-button label="Reactivate" styleClass="w-full" />
                  </a>
                </div>
              }
            </div>
            @if ((me()?.upgradeTargets?.length ?? 0) > 0 && me()?.canReactivate) {
              <p class="text-sm text-mlm-secondary">
                To move up, use Upgrade. To stay on this package, use Reactivate.
              </p>
            }
          }
        }

        @if (showRegisterHint()) {
          <div class="rounded-2xl border border-gray-100 bg-white p-6 sm:p-7">
            <h2 class="text-lg font-bold text-mlm-text">Register a Successline</h2>
            <p class="mt-2 text-sm leading-relaxed text-mlm-secondary">
              If you are their Segulah sponsor and you are in Legacy Club, they will join under you
              automatically — they will not type a username.
            </p>
            <p class="mt-2 text-sm leading-relaxed text-mlm-secondary">
              If you are not their Segulah sponsor, or you join after they do, they will need your
              username only when their own sponsor is not in Legacy Club.
            </p>
            <div class="mt-5 flex flex-wrap items-center gap-3">
              <span class="rounded-xl border border-gray-100 bg-mlm-background px-4 py-2.5 text-lg font-bold text-mlm-text">
                &#64;{{ username() }}
              </span>
              <p-button label="Copy username" [outlined]="true" size="small" (onClick)="copyUsername()" />
            </div>
            <p class="mt-3 text-xs text-mlm-secondary">
              They still complete join on their own login. You cannot pay their pack from this screen.
            </p>

            <div class="mt-6 border-t border-gray-100 pt-5">
              <p class="text-sm font-medium text-mlm-text">Check if someone can join Legacy</p>
              <div class="mt-3 flex flex-wrap gap-2">
                <input
                  pInputText
                  class="min-w-[14rem] flex-1"
                  placeholder="Username"
                  [(ngModel)]="lookupUsername"
                  (keydown.enter)="lookupMember()"
                />
                <p-button
                  label="Look up"
                  [outlined]="true"
                  size="small"
                  [loading]="lookupLoading()"
                  (onClick)="lookupMember()"
                />
              </div>
              @if (lookupKind() === 'ready') {
                <p class="mt-2 text-sm font-medium text-emerald-800">Ready</p>
              } @else if (lookupKind() === 'already') {
                <p class="mt-2 text-sm font-medium text-mlm-text">Already in Legacy</p>
              } @else if (lookupKind() === 'not-member') {
                <p class="mt-2 text-sm font-medium text-mlm-secondary">Not a Segulah member</p>
              }
              @if (lookupError()) {
                <p class="mt-2 text-sm text-red-700">{{ lookupError() }}</p>
              }
            </div>
          </div>
        }
      } @else {
        <!-- Marketing / not joined -->
        <header class="rounded-2xl bg-mlm-primary px-6 py-7 sm:px-8 sm:py-8">
          <p class="text-xs font-bold uppercase tracking-[.15em] text-white/60">
            Segulah Global Legacy Club
          </p>
          <h1 class="mt-3 max-w-3xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Buy Products · Build Your Successline · Earn Your Legacy
          </h1>
          <p class="mt-4 max-w-2xl text-sm leading-relaxed text-white/75">
            You must already be a Segulah Global member. Choose a package, pick products of your
            choice, and start your 6-month legacy.
          </p>
          @if (me()?.sponsorResolution === 'AUTO' && me()?.defaultSponsor) {
            <p class="mt-4 text-sm font-medium text-white">
              You will join under &#64;{{ me()?.defaultSponsor?.username }} (your Segulah sponsor is
              already in Legacy Club).
            </p>
          } @else if (me()?.sponsorResolution === 'MANUAL') {
            <p class="mt-4 text-sm font-medium text-white/90">
              Your Segulah sponsor is not in Legacy Club yet. You will need a Legacy Club username.
              You may want to ask them to join first.
            </p>
          }
        </header>

        @if (status() === 'PENDING_JOIN' && me()?.pendingJoin; as pending) {
          <div
            class="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white px-6 py-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p class="font-semibold text-mlm-text">Finish your Legacy join</p>
              <p class="text-sm text-mlm-secondary">
                {{ money(pending.remainingToJoin) }} remaining for {{ pending.package }}
              </p>
            </div>
            <a routerLink="/legacy/shop">
              <p-button label="Continue shopping" />
            </a>
          </div>
        }

        <div class="grid gap-5 md:grid-cols-3">
          @for (pkg of packages(); track pkg.code) {
            <article class="flex flex-col rounded-2xl border border-gray-100 bg-white p-6 sm:p-7">
              <div class="flex items-center gap-2">
                <i class="pi pi-crown text-mlm-primary"></i>
                <h2 class="text-lg font-bold text-mlm-text">{{ pkg.name }}</h2>
              </div>
              <p class="mt-4 text-3xl font-extrabold tracking-tight text-mlm-text">{{ money(pkg.purchaseAmount) }}</p>
              <p class="text-sm text-mlm-secondary">Product purchase</p>
              <ul class="mt-5 flex-1 space-y-2.5 text-sm text-mlm-text">
                <li>
                  Instant Membership Commission {{ money(pkg.instantCommission) }} —
                  <span class="font-medium">into your Legacy account</span>
                </li>
                <li class="text-mlm-secondary">
                  Monthly {{ money(pkg.monthlyCommission) }} × 6 — Starts after you join
                </li>
                <li>Successline {{ pkg.successlineBonusPercent }}% of your directs' Instant</li>
                <li class="font-medium">6-month total {{ money(pkg.sixMonthTotal) }}</li>
              </ul>
              <div class="mt-4 flex flex-wrap gap-1.5">
                <span class="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-800">
                  Cash out Legacy account anytime
                </span>
                <span class="rounded-full bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-mlm-secondary">
                  Autoship unlocks monthly
                </span>
              </div>
              <p-button
                class="mt-5"
                styleClass="w-full"
                [label]="'Join as ' + pkg.code"
                (onClick)="joinPackage(pkg)"
              />
            </article>
          }
        </div>

        <p class="text-center text-xs text-mlm-secondary">
          USD members: ₦1,000 = $1, same as the network.
        </p>

        <div class="text-center">
          <a routerLink="/legacy/packages" class="text-sm font-semibold text-mlm-primary hover:underline">
            Compare packages
          </a>
        </div>
      }
        </div>
      </main>
    </div>
  `,
})
export class LegacyHomeComponent implements OnInit {
  private legacyClub = inject(LegacyClubService);
  private userService = inject(UserService);
  private router = inject(Router);

  me = this.legacyClub.me;
  loading = this.legacyClub.loading;
  status = this.legacyClub.status;
  shopMode = this.legacyClub.shopMode;
  packages = signal<LegacyPackage[]>([]);
  showRegisterHint = signal(false);
  username = computed(() => this.userService.currentUser()?.username ?? '');
  cycle = computed(() => this.me()?.cycle ?? null);

  lookupUsername = '';
  lookupLoading = signal(false);
  lookupKind = signal<LookupResultKind>(null);
  lookupError = signal<string | null>(null);

  ngOnInit(): void {
    this.legacyClub.loadMe().subscribe();
    this.legacyClub.getPackages().subscribe({
      next: (res: LegacyPackagesResponse) => this.packages.set(res.packages.filter((p) => p.isActive)),
    });
  }

  money(amount: number): string {
    return formatLegacyMoney(amount, this.me()?.currency ?? 'NGN');
  }

  rateLabel(tier: LegacyRateTier): string {
    return tier === 'INCREASED' ? 'Increased' : 'Base';
  }

  qualifyHint(): string {
    const q = this.me()?.monthlyQualify;
    const required = q?.required ?? this.me()?.minDirectsToIncreaseMonthly ?? 3;
    const count = q?.directSuccesslineCount ?? this.me()?.directSuccesslineCount ?? 0;
    if (q?.isQualified || count >= required) {
      return 'Your next monthly uses the increased amount.';
    }
    const need = Math.max(0, required - count);
    return `Refer ${need} more Successline${need === 1 ? '' : 's'} to raise your next monthly. You can already cash out.`;
  }

  joinPackage(pkg: LegacyPackage): void {
    void this.router.navigate(['/legacy/join'], { queryParams: { package: pkg.code } });
  }

  copyUsername(): void {
    const name = this.username();
    if (!name || !navigator.clipboard) return;
    void navigator.clipboard.writeText(name);
  }

  lookupMember(): void {
    const username = this.lookupUsername.trim();
    this.lookupKind.set(null);
    this.lookupError.set(null);
    if (!username) {
      this.lookupError.set('Enter a username.');
      return;
    }
    this.lookupLoading.set(true);
    this.legacyClub.lookupMember(username).subscribe({
      next: (res: LegacyMemberLookup) => {
        this.lookupLoading.set(false);
        if (!res.exists || !res.isRegistrationPaid) {
          this.lookupKind.set('not-member');
          return;
        }
        if (res.legacyStatus === 'ACTIVE' || res.legacyStatus === 'PENDING_JOIN') {
          this.lookupKind.set('already');
          return;
        }
        this.lookupKind.set('ready');
      },
      error: () => {
        this.lookupLoading.set(false);
        this.lookupError.set('Lookup failed. Try again.');
      },
    });
  }
}
