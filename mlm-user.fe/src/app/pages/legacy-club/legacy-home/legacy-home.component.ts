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
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { DialogModule } from 'primeng/dialog';
import { DialogService } from 'primeng/dynamicdialog';
import { LegacyClubService } from '../../../services/legacy-club.service';
import { UserService } from '../../../services/user.service';
import { RegistrationService } from '../../../services/registration.service';
import { ModalService } from '../../../services/modal.service';
import {
  LegacyPackage,
  LegacyPackageCode,
  LegacyRateTier,
  LegacyCycle,
  isLegacyMember,
  formatLegacyPvAmount,
  legacyPvCardDescription,
} from '../../../core/models/legacy-club.models';
import { formatLegacyMoney } from '../../../core/utils/legacy-money.util';
import { legacyErrorMessage } from '../../../core/utils/legacy-error.util';
import {
  interpretLegacyMemberLookup,
  LegacyMemberLookupUiResult,
} from '../../../core/utils/legacy-member-lookup.util';
import { RegistrationFundingComponent } from '../../wallet/registration-funding/registration-funding.component';
import {
  cyclePeriodCount,
  cycleProgressLabel,
  isWeeklyCycle,
} from '../../../core/utils/legacy-cycle.util';
import { LegacyPageShellComponent } from '../components/legacy-page-shell.component';
import { LegacyPageHeaderComponent } from '../components/legacy-page-header.component';
import { LegacyPanelComponent } from '../components/legacy-panel.component';
import { LegacyMetricCardComponent } from '../components/legacy-metric-card.component';

@Component({
  selector: 'app-legacy-home',
  providers: [DialogService],
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ButtonModule,
    InputTextModule,
    SelectModule,
    SkeletonModule,
    DialogModule,
    LegacyPageShellComponent,
    LegacyPageHeaderComponent,
    LegacyPanelComponent,
    LegacyMetricCardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-legacy-page-shell>
      @if (loading()) {
        <p-skeleton height="8rem" styleClass="rounded-2xl" />
        <div class="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          @for (_ of [1, 2, 3, 4]; track $index) {
            <p-skeleton height="16rem" styleClass="rounded-2xl" />
          }
        </div>
      } @else if (isMemberView()) {
        @if (status() === 'REACTIVATION_DUE') {
          <div
            class="mb-5 rounded-xl border border-amber-200 bg-amber-50/80 px-5 py-4 text-sm text-amber-950"
          >
            <p class="font-semibold">Reactivation period</p>
            <p class="mt-1">
              Reactivate before
              {{ lifecycle()?.suspensionDueAt | date: 'mediumDate' }} to keep earning and cash out.
            </p>
            @if (graceCountdown()) {
              <p class="mt-1 text-xs">{{ graceCountdown() }}</p>
            }
            @if (canReactivate()) {
              <a routerLink="/legacy/reactivate" class="mt-3 inline-block">
                <p-button label="Reactivate now" size="small" />
              </a>
            }
          </div>
        } @else if (status() === 'SUSPENDED') {
          <div
            class="mb-5 rounded-xl border border-red-200 bg-red-50/80 px-5 py-4 text-sm text-red-900"
          >
            <p class="font-semibold">Membership suspended</p>
            <p class="mt-1">Reactivate to earn and cash out again.</p>
            <a routerLink="/legacy/reactivate" class="mt-3 inline-block">
              <p-button label="Reactivate" size="small" severity="danger" />
            </a>
          </div>
        } @else if (cycle(); as c) {
          <p class="mb-4 text-sm text-mlm-secondary">
            Week {{ c.issuedCount + 1 }} of {{ cyclePeriodCount(c) }}
          </p>
        }

        <app-legacy-page-header
          eyebrow="Legacy Club"
          [title]="(me()?.membership?.package ?? '') + ' Member'"
          [subtitle]="memberSubtitle()"
        >
          <a
            actions
            routerLink="/legacy/history"
            class="inline-flex min-h-10 items-center justify-center rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-mlm-text transition-colors hover:bg-gray-50"
          >
            Membership history
          </a>
        </app-legacy-page-header>

        <div class="flex flex-col gap-6">
        <div class="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <app-legacy-metric-card
            label="Legacy cashout"
            [value]="money(me()?.legacyCashout?.balance ?? 0)"
            [description]="cashoutCardHint()"
          >
            <a footer routerLink="/legacy/account">
              <p-button label="Open Legacy cashout" styleClass="w-full" />
            </a>
          </app-legacy-metric-card>

          <app-legacy-metric-card
            label="Legacy product voucher"
            [value]="money(me()?.legacyVoucher?.balance ?? 0)"
            description="Voucher credit for Legacy marketplace."
          >
            @if (canShop()) {
              <a footer routerLink="/legacy/shop">
                <p-button label="Shop marketplace" styleClass="w-full" />
              </a>
            } @else {
              <a footer routerLink="/legacy/voucher">
                <p-button label="View voucher" [outlined]="true" styleClass="w-full" />
              </a>
            }
          </app-legacy-metric-card>

          <app-legacy-metric-card
            label="Legacy PV"
            [value]="legacyPvTotal()"
            [description]="legacyPvDescription()"
          >
            <a footer routerLink="/legacy/pv/history">
              <p-button label="View PV history" styleClass="w-full" />
            </a>
          </app-legacy-metric-card>

          <app-legacy-metric-card
            label="My Successlines"
            [value]="'' + (me()?.directSuccesslineCount ?? 0)"
            description="3 Successlines will raise your weekly commission later."
          >
            <a footer routerLink="/legacy/successlines">
              <p-button label="View Successlines" [outlined]="true" styleClass="w-full" />
            </a>
            <p-button
              footer
              label="Register someone"
              [text]="true"
              styleClass="w-full"
              (onClick)="openRegisterModal()"
            />
          </app-legacy-metric-card>
        </div>

        @if (cycle(); as cycle) {
          <div class="grid gap-5 lg:grid-cols-2">
            <app-legacy-panel>
              <p class="text-xs font-bold uppercase tracking-[.15em] text-mlm-secondary">
                Weekly membership commission
              </p>
              <p class="mt-1 text-xs text-mlm-secondary">Same membership commission — every 7 days.</p>
              @if (cycle.isCycleComplete) {
                <p class="mt-3 text-lg font-semibold text-mlm-text">
                  {{ cycleProgress() }} paid into your Legacy account and voucher
                </p>
              } @else if (cycle.nextDueAt) {
                <p class="mt-3 text-lg font-semibold text-mlm-text">
                  Next week {{ money(cycle.nextDueAmount) }} on
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
                @if (hasWeeklySplit(cycle)) {
                  <ul class="mt-4 space-y-2 text-sm text-mlm-text">
                    <li>
                      <span class="font-semibold">{{ money(cycle.nextDueCashoutAmount!) }}</span>
                      to Legacy account (cashable)
                    </li>
                    <li>
                      <span class="font-semibold">{{ money(cycle.nextDueVoucherNet!) }}</span>
                      to Legacy product voucher
                    </li>
                  </ul>
                  <p class="mt-2 text-xs text-mlm-secondary">
                    Part funds your Legacy product voucher (10% fee). The rest is in your Legacy
                    account to cash out.
                  </p>
                }
                <p class="mt-3 text-sm text-mlm-secondary">{{ cycleProgress() }}</p>
              } @else {
                <p class="mt-3 text-sm text-mlm-secondary">No weekly due right now.</p>
              }
              <p class="mt-3 text-sm text-mlm-secondary">{{ qualifyHint() }}</p>
              <a routerLink="/legacy/weeks" class="mt-5 block">
                <p-button [label]="cycleLinkLabel()" [outlined]="true" styleClass="w-full" />
              </a>
            </app-legacy-panel>

            <app-legacy-panel>
              <p class="text-xs font-bold uppercase tracking-[.15em] text-mlm-secondary">
                Legacy marketplace
              </p>
              <p class="mt-3 text-sm leading-relaxed text-mlm-text">
                @if (cycle.nextDueVoucherNet != null && cycle.nextDueVoucherNet > 0) {
                  Your weekly voucher credit is {{ money(cycle.nextDueVoucherNet) }} — shop whenever
                  you want.
                } @else {
                  Spend your Legacy product voucher in the marketplace anytime. Shopping does not
                  unlock commission — drops happen automatically every 7 days.
                }
              </p>
              @if (canShop()) {
                <a routerLink="/legacy/shop" class="mt-5 block">
                  <p-button label="Shop Legacy marketplace" styleClass="w-full" />
                </a>
              }
              <p class="mt-3 text-xs text-mlm-secondary">
                Pay with Legacy product voucher only — not the network Product Voucher.
              </p>
            </app-legacy-panel>
          </div>

          @if (cycle.isCycleComplete) {
            <app-legacy-panel>
              <p class="font-semibold text-mlm-text">Your weekly cycle is complete.</p>
              <p class="mt-1 text-sm text-mlm-secondary">
                Reactivate to start a new week 1 in 7 days.
              </p>
              @if (me()?.monthlyQualify?.isQualified) {
                <p class="mt-1 text-sm text-mlm-secondary">
                  When you reactivate, you keep the increased weekly rate.
                </p>
              }
            </app-legacy-panel>
          }

          @if ((me()?.upgradeTargets?.length ?? 0) > 0 || me()?.canReactivate) {
            <div class="grid gap-5 lg:grid-cols-2">
              @if ((me()?.upgradeTargets?.length ?? 0) > 0) {
                <app-legacy-panel>
                  <p class="text-xs font-bold uppercase tracking-[.15em] text-mlm-secondary">Upgrade</p>
                  <p class="mt-3 text-sm leading-relaxed text-mlm-text">
                    Pay the package difference from your registration wallet or manual bank. Your
                    weekly cycle starts again from week 1.
                  </p>
                  <a routerLink="/legacy/upgrade" class="mt-5 block">
                    <p-button label="Upgrade" styleClass="w-full" />
                  </a>
                </app-legacy-panel>
              }
              @if (canReactivate()) {
                <app-legacy-panel>
                  <p class="text-xs font-bold uppercase tracking-[.15em] text-mlm-secondary">
                    Reactivate
                  </p>
                  <p class="mt-3 text-sm leading-relaxed text-mlm-text">
                    Pay your full package amount again. Full Instant goes to your Legacy account.
                  </p>
                  @if (me()?.monthlyQualify?.isQualified) {
                    <p class="mt-2 text-sm text-emerald-800">
                      You keep the increased weekly rate. You do not need 3 new Successlines.
                    </p>
                  } @else {
                    <p class="mt-2 text-sm text-mlm-secondary">
                      Refer 3 Successlines to raise weekly on this new cycle. You can already cash
                      out.
                    </p>
                  }
                  <a routerLink="/legacy/reactivate" class="mt-5 block">
                    <p-button label="Reactivate" styleClass="w-full" />
                  </a>
                </app-legacy-panel>
              }
            </div>
            @if ((me()?.upgradeTargets?.length ?? 0) > 0 && me()?.canReactivate) {
              <p class="text-sm text-mlm-secondary">
                To move up, use Upgrade. To stay on this package, use Reactivate.
              </p>
            }
          }
        }
        </div>

        <p-dialog
          header="Register a Successline"
          [visible]="registerModalVisible()"
          (visibleChange)="onRegisterModalVisibleChange($event)"
          [modal]="true"
          [draggable]="false"
          [resizable]="false"
          [style]="{ width: '90vw', maxWidth: '480px' }"
          styleClass="legacy-register-modal"
        >
          <div class="space-y-4">
            <p class="text-sm leading-relaxed text-mlm-secondary">
              If you are their Segulah sponsor and you are in Legacy Club, they will join under you
              automatically — they will not type a username.
            </p>
            <p class="text-sm leading-relaxed text-mlm-secondary">
              If you are not their Segulah sponsor, or you join after they do, they will need your
              username only when their own sponsor is not in Legacy Club.
            </p>
            <div class="flex flex-wrap items-center gap-3">
              <span
                class="rounded-xl border border-gray-100 bg-mlm-background px-4 py-2.5 text-lg font-bold text-mlm-text"
              >
                &#64;{{ username() }}
              </span>
              <p-button
                label="Copy username"
                [outlined]="true"
                size="small"
                (onClick)="copyUsername()"
              />
            </div>
            <p class="text-xs text-mlm-secondary">
              When they are eligible, pick a Legacy package and pay from your registration wallet.
              They join under you immediately — no pending state if payment fails.
            </p>

            <div class="border-t border-gray-100 pt-4">
              <p class="text-sm font-medium text-mlm-text">Register a downline</p>
              <div class="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  pInputText
                  class="min-w-0 flex-1"
                  placeholder="Username"
                  [(ngModel)]="lookupUsername"
                  (keydown.enter)="lookupMember()"
                />
                <p-button
                  label="Look up"
                  [outlined]="true"
                  [loading]="lookupLoading()"
                  styleClass="w-full sm:w-auto"
                  (onClick)="lookupMember()"
                />
              </div>
              @if (lookupResult(); as result) {
                <p class="mt-2 text-sm font-medium" [class]="lookupResultClass(result.kind)">
                  {{ result.message }}
                </p>
              }
              @if (lookupError()) {
                <p class="mt-2 text-sm text-red-700">{{ lookupError() }}</p>
              }

              @if (lookupResult()?.kind === 'ready') {
                <div class="mt-4 space-y-4 rounded-xl border border-gray-100 bg-mlm-background/60 p-4">
                  <div class="flex flex-col gap-1.5">
                    <label class="text-sm font-semibold text-gray-700" for="registerPackage">
                      Legacy package
                    </label>
                    <p-select
                      inputId="registerPackage"
                      [options]="registerPackageOptions()"
                      [ngModel]="selectedRegisterPackage()"
                      (ngModelChange)="selectedRegisterPackage.set($event)"
                      optionLabel="label"
                      optionValue="value"
                      placeholder="Select package"
                      styleClass="w-full"
                    />
                  </div>
                  @if (selectedRegisterPackageDef(); as pkg) {
                    <div class="text-sm text-mlm-secondary">
                      <p>
                        Amount due:
                        <span class="font-semibold text-mlm-text">{{ money(pkg.purchaseAmount) }}</span>
                      </p>
                      <p class="mt-1">
                        They receive instant
                        <span class="font-semibold text-emerald-800">{{
                          money(pkg.instantCommission)
                        }}</span>
                        into their Legacy account.
                      </p>
                      <p class="mt-1">
                        Your Successline bonus:
                        <span class="font-semibold text-mlm-text">{{
                          money(registerSuccesslineBonus(pkg))
                        }}</span>
                      </p>
                    </div>
                  }
                  <p class="text-sm text-mlm-secondary">
                    Registration wallet balance:
                    <span class="font-semibold text-mlm-text">{{ money(registrationBalance()) }}</span>
                  </p>
                  @if (registerPayHint()) {
                    <p class="text-sm text-amber-800">{{ registerPayHint() }}</p>
                    <p-button
                      label="Fund registration wallet"
                      [outlined]="true"
                      size="small"
                      styleClass="w-full sm:w-auto"
                      (onClick)="openRegistrationFundingDialog()"
                    />
                  }
                  @if (registerError()) {
                    <p class="text-sm text-red-700">{{ registerError() }}</p>
                  }
                  <p-button
                    label="Register & pay"
                    styleClass="w-full"
                    [loading]="registerSubmitting()"
                    [disabled]="!canRegisterAndPay()"
                    (onClick)="registerSuccessline()"
                  />
                </div>
              }
            </div>
          </div>
        </p-dialog>
      }
    </app-legacy-page-shell>
  `,
})
export class LegacyHomeComponent implements OnInit {
  private legacyClub = inject(LegacyClubService);
  private userService = inject(UserService);
  private registrationService = inject(RegistrationService);
  private modalService = inject(ModalService);
  private dialogService = inject(DialogService);
  private router = inject(Router);

  readonly cyclePeriodCount = cyclePeriodCount;

  me = this.legacyClub.me;
  loading = this.legacyClub.loading;
  status = this.legacyClub.status;
  registerModalVisible = signal(false);
  registerPackages = signal<LegacyPackage[]>([]);
  selectedRegisterPackage = signal<LegacyPackageCode | null>(null);
  registrationBalance = signal(0);
  registerSubmitting = signal(false);
  registerError = signal<string | null>(null);
  lookupResult = signal<LegacyMemberLookupUiResult | null>(null);
  username = computed(() => this.userService.currentUser()?.username ?? '');
  registerPackageOptions = computed(() =>
    this.registerPackages()
      .filter((pkg) => pkg.isActive)
      .map((pkg) => ({ label: pkg.name, value: pkg.code })),
  );
  selectedRegisterPackageDef = computed(() => {
    const code = this.selectedRegisterPackage();
    if (!code) return null;
    return this.registerPackages().find((pkg) => pkg.code === code) ?? null;
  });
  registerPayHint = computed(() => {
    const pkg = this.selectedRegisterPackageDef();
    if (!pkg || this.registerSubmitting()) return null;
    if (this.registrationBalance() < pkg.purchaseAmount) {
      return 'Your registration wallet balance is lower than the amount due.';
    }
    return null;
  });
  cycle = computed(() => this.me()?.cycle ?? null);
  lifecycle = computed(() => this.me()?.lifecycle ?? null);
  isMemberView = computed(() => isLegacyMember(this.me()));
  canShop = this.legacyClub.canShopProducts;
  canReactivate = computed(
    () =>
      !!this.me()?.canReactivate ||
      !!this.me()?.lifecycle?.canReactivate ||
      this.status() === 'REACTIVATION_DUE' ||
      this.status() === 'SUSPENDED',
  );
  legacyPvTotal = computed(() =>
    formatLegacyPvAmount(this.me()?.legacyPv?.totalPv ?? 0),
  );
  legacyPvDescription = computed(() => legacyPvCardDescription(this.me()?.legacyPv));

  memberSubtitle = computed(() => {
    const m = this.me()?.membership;
    if (!m) return '';
    const placement = m.sponsorSource === 'AUTO' ? 'Automatic' : 'Chosen';
    return `Joined ${new Date(m.joinedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })} · Registered by @${m.sponsorUsername} (${placement})`;
  });

  lookupUsername = '';
  lookupLoading = signal(false);
  lookupError = signal<string | null>(null);

  ngOnInit(): void {
    this.legacyClub.loadMe().subscribe({
      next: (me) => {
        if (me && !isLegacyMember(me)) {
          void this.router.navigateByUrl(this.legacyClub.legacyHomePath(), { replaceUrl: true });
        }
      },
    });
  }

  cashoutCardHint(): string {
    if (this.me()?.canCashoutLegacy === false) {
      return this.me()?.cashoutRestrictionReason ?? 'Cash out is temporarily locked.';
    }
    return 'You can cash out or move this money.';
  }

  graceCountdown(): string | null {
    const seconds = this.lifecycle()?.reactivationSecondsRemaining ?? 0;
    if (seconds <= 0) return null;
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    if (days > 0) return `${days} day${days === 1 ? '' : 's'} ${hours}h remaining`;
    return `${hours} hour${hours === 1 ? '' : 's'} remaining`;
  }

  money(amount: number): string {
    return formatLegacyMoney(amount, this.me()?.currency ?? 'NGN');
  }

  rateLabel(tier: LegacyRateTier): string {
    return tier === 'INCREASED' ? 'Increased' : 'Base';
  }

  hasWeeklySplit(cycle: LegacyCycle): boolean {
    return cycle.nextDueCashoutAmount != null && cycle.nextDueVoucherNet != null;
  }

  cycleProgress(): string {
    const cycle = this.cycle();
    if (!cycle) return '';
    return cycleProgressLabel(cycle.issuedCount, cycle);
  }

  cycleLinkLabel(): string {
    const cycle = this.cycle();
    const total = cyclePeriodCount(cycle);
    if (isWeeklyCycle(cycle)) {
      return `View ${total}-week cycle`;
    }
    return `View ${cycle?.cycleMonths ?? 6}-month cycle`;
  }

  qualifyHint(): string {
    const q = this.me()?.monthlyQualify;
    const required = q?.required ?? this.me()?.minDirectsToIncreaseMonthly ?? 3;
    const count = q?.directSuccesslineCount ?? this.me()?.directSuccesslineCount ?? 0;
    if (q?.isQualified || count >= required) {
      return 'You now earn the increased weekly rate. You keep it if you reactivate.';
    }
    const need = Math.max(0, required - count);
    return `Refer ${need} more Successline${need === 1 ? '' : 's'} to raise your next weekly. You can already cash out.`;
  }

  openRegisterModal(): void {
    this.lookupUsername = '';
    this.lookupResult.set(null);
    this.lookupError.set(null);
    this.registerError.set(null);
    this.selectedRegisterPackage.set(null);
    this.registerModalVisible.set(true);
    this.loadRegisterModalData();
  }

  onRegisterModalVisibleChange(visible: boolean): void {
    this.registerModalVisible.set(visible);
    if (!visible) {
      this.resetRegisterModalState();
    }
  }

  private resetRegisterModalState(): void {
    this.lookupResult.set(null);
    this.lookupError.set(null);
    this.registerError.set(null);
    this.selectedRegisterPackage.set(null);
    this.registerSubmitting.set(false);
  }

  lookupResultClass(kind: LegacyMemberLookupUiResult['kind']): string {
    switch (kind) {
      case 'ready':
        return 'text-emerald-800';
      case 'blocked':
        return 'text-red-700';
      case 'already':
      case 'pending':
        return 'text-mlm-text';
      case 'not-member':
      case 'unpaid':
        return 'text-mlm-secondary';
      default: {
        const _exhaustive: never = kind;
        return _exhaustive;
      }
    }
  }

  private loadRegisterModalData(): void {
    this.legacyClub.getPackages().subscribe({
      next: (res) => {
        const active = res.packages.filter((pkg) => pkg.isActive);
        this.registerPackages.set(active);
        this.selectedRegisterPackage.set(active[0]?.code ?? null);
      },
    });
    this.registrationService.getRegistrationWallet().subscribe({
      next: (wallet) => this.registrationBalance.set(wallet?.balance ?? 0),
    });
  }

  registerSuccesslineBonus(pkg: LegacyPackage): number {
    return Math.round((pkg.instantCommission * pkg.successlineBonusPercent) / 100);
  }

  canRegisterAndPay(): boolean {
    const pkg = this.selectedRegisterPackageDef();
    return (
      this.lookupResult()?.kind === 'ready' &&
      !!pkg &&
      !this.registerSubmitting() &&
      this.registrationBalance() >= pkg.purchaseAmount
    );
  }

  openRegistrationFundingDialog(): void {
    const fundingRef = this.dialogService.open(RegistrationFundingComponent, {
      header: 'Fund Registration Wallet',
      width: '480px',
      contentStyle: { 'max-height': '650px', overflow: 'auto' },
      baseZIndex: 11000,
      data: {
        returnAfterFundingUrl: '/legacy',
        selectedPackage: this.selectedRegisterPackage() ?? 'VIP',
      },
    });
    fundingRef?.onClose.subscribe(() => {
      this.registrationService.getRegistrationWallet().subscribe({
        next: (wallet) => this.registrationBalance.set(wallet?.balance ?? 0),
      });
    });
  }

  registerSuccessline(): void {
    if (!this.canRegisterAndPay()) return;
    const username = this.lookupResult()?.username;
    const pkg = this.selectedRegisterPackage();
    if (!username || !pkg) return;

    this.registerSubmitting.set(true);
    this.registerError.set(null);

    this.legacyClub
      .registerSuccessline({
        username,
        package: pkg,
        requestKey: crypto.randomUUID(),
      })
      .subscribe({
        next: (res) => {
          this.registerSubmitting.set(false);
          this.registerModalVisible.set(false);
          this.resetRegisterModalState();
          this.modalService.open(
            'celebration',
            'Successline registered',
            `@${res.username} is now in Legacy Club under you (${res.package}).`,
            '/legacy/successlines',
            'View Successlines',
            '/Share.json',
          );
        },
        error: (err) => {
          this.registerSubmitting.set(false);
          this.registerError.set(legacyErrorMessage(err, 'Registration failed. Try again.'));
        },
      });
  }

  copyUsername(): void {
    const name = this.username();
    if (!name || !navigator.clipboard) return;
    void navigator.clipboard.writeText(name);
  }

  lookupMember(): void {
    const username = this.lookupUsername.trim();
    this.lookupResult.set(null);
    this.lookupError.set(null);
    this.registerError.set(null);
    if (!username) {
      this.lookupError.set('Enter a username.');
      return;
    }
    this.lookupLoading.set(true);
    this.legacyClub.lookupMember(username).subscribe({
      next: (res) => {
        this.lookupLoading.set(false);
        this.lookupResult.set(interpretLegacyMemberLookup(res));
      },
      error: () => {
        this.lookupLoading.set(false);
        this.lookupError.set('Lookup failed. Try again.');
      },
    });
  }
}
