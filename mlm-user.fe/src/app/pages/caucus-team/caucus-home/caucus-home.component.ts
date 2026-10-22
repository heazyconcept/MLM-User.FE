import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  model,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { TextareaModule } from 'primeng/textarea';
import { UiTableComponent } from '../../../components/table/table-component';
import {
  CAUCUS_APPEAL_MAX_LENGTH,
  CAUCUS_APPEAL_MIN_LENGTH,
  CaucusMonthRow,
  CaucusPvAward,
  CaucusReferral,
  CaucusTeamMember,
  CaucusWalletEntry,
  canSubmitCaucusAppeal,
} from '../../../core/models/caucus.models';
import {
  CAUCUS_MONTH_STATUS_LABEL,
  caucusMonthTitle,
  formatCaucusNgn,
  formatLagosDate,
} from '../../../core/utils/caucus-format.util';
import { AuthService } from '../../../services/auth.service';
import { CaucusService } from '../../../services/caucus.service';
import { CaucusEmptyStateComponent } from '../components/caucus-empty-state.component';
import { CaucusMetricCardComponent } from '../components/caucus-metric-card.component';
import { CaucusPageHeaderComponent } from '../components/caucus-page-header.component';
import { CaucusPageShellComponent } from '../components/caucus-page-shell.component';
import { CaucusPagerComponent } from '../components/caucus-pager.component';
import { CaucusPanelComponent } from '../components/caucus-panel.component';
import { CaucusProgressComponent } from '../components/caucus-progress.component';
import {
  CaucusSegmentTab,
  CaucusSegmentedTabsComponent,
} from '../components/caucus-segmented-tabs.component';
import { CaucusStatusPillComponent } from '../components/caucus-status-pill.component';

@Component({
  selector: 'app-caucus-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    SkeletonModule,
    RouterLink,
    UiTableComponent,
    CaucusPageShellComponent,
    CaucusPageHeaderComponent,
    CaucusPanelComponent,
    CaucusMetricCardComponent,
    CaucusStatusPillComponent,
    CaucusProgressComponent,
    CaucusEmptyStateComponent,
    CaucusPagerComponent,
    CaucusSegmentedTabsComponent,
  ],
  templateUrl: './caucus-home.component.html',
})
export class CaucusHomeComponent implements OnInit {
  private readonly caucus = inject(CaucusService);
  private readonly auth = inject(AuthService);

  me = this.caucus.me;
  loading = this.caucus.loading;

  referrals = signal<CaucusReferral[]>([]);
  months = signal<CaucusMonthRow[]>([]);
  team = signal<CaucusTeamMember[]>([]);
  walletItems = signal<CaucusWalletEntry[]>([]);
  walletCursor = signal<string | null>(null);
  pvAwards = signal<CaucusPvAward[]>([]);

  activeTab = model<CaucusSegmentTab>('people');
  teamPage = signal(1);
  teamHasNext = signal(false);
  teamSearch = signal('');
  appealSubmitting = signal(false);
  appealError = signal<string | null>(null);

  appealControl = new FormControl('', {
    nonNullable: true,
    validators: [
      Validators.maxLength(CAUCUS_APPEAL_MAX_LENGTH),
      (c) => {
        const v = c.value.trim();
        if (!v) {
          return null;
        }
        if (v.length < CAUCUS_APPEAL_MIN_LENGTH) {
          return { minLength: true };
        }
        return null;
      },
    ],
  });

  isImpersonating = computed(() => !!this.auth.impersonation());
  isDeactivated = computed(() => this.me()?.status === 'DEACTIVATED');
  isActive = computed(() => this.me()?.status === 'ACTIVE');

  headerSubtitle = computed(() => {
    const activated = this.me()?.membership?.activatedAt;
    if (!activated || this.isDeactivated()) {
      return undefined;
    }
    return `Member since ${formatLagosDate(activated)}`;
  });

  statusMetricValue = computed(() => (this.isDeactivated() ? 'Deactivated' : 'Active'));

  statusMetricDescription = computed(() => {
    const m = this.me()?.membership;
    if (!m) {
      return '';
    }
    const parts: string[] = [];
    if (m.activatedAt) {
      parts.push(`Activated on ${formatLagosDate(m.activatedAt)}`);
    }
    if (m.reinstatedAt) {
      parts.push(`Restored on ${formatLagosDate(m.reinstatedAt)}`);
    }
    if (m.deactivatedAt && this.isDeactivated()) {
      parts.push(`Deactivated on ${formatLagosDate(m.deactivatedAt)}`);
    }
    return parts.join(' · ');
  });

  walletBalance = computed(() => this.me()?.wallet?.balanceNgn ?? 0);
  showCashOut = computed(
    () => this.walletBalance() > 0 && !this.isImpersonating(),
  );

  formatMoney = formatCaucusNgn;
  formatDate = formatLagosDate;
  monthTitle = caucusMonthTitle;
  monthStatusLabel = (s: string) => CAUCUS_MONTH_STATUS_LABEL[s] ?? s;

  ngOnInit(): void {
    this.caucus.loadMe().subscribe(() => this.loadSections());
  }

  monthStatusLine(): string {
    const cm = this.me()?.currentMonth;
    if (!cm) {
      return '';
    }
    if (cm.displayStatus === 'PAID') {
      return 'Paid into your Caucus wallet';
    }
    if (cm.displayStatus !== 'OPEN') {
      return this.monthStatusLabel(cm.displayStatus);
    }
    if (!cm.floorMet) {
      return 'Building. 10 people are required before this amount can be paid';
    }
    return 'Building. This amount is waiting for the 1st';
  }

  networkLine(): string {
    const n = this.me()?.network;
    if (!n) {
      return '';
    }
    if (n.carStatus === 'AWARDED') {
      return 'Car awarded';
    }
    if (this.isDeactivated()) {
      return '';
    }
    if (n.carStatus === 'QUALIFIED') {
      return `Qualified for the car. ${n.downlineCount} of ${n.carTarget} people in your network`;
    }
    return `${n.downlineCount} of ${n.carTarget} people in your network`;
  }

  canSubmitAppeal(): boolean {
    return canSubmitCaucusAppeal(this.appealControl.value) && !this.isImpersonating();
  }

  submitAppeal(): void {
    if (!this.canSubmitAppeal()) {
      return;
    }
    this.appealSubmitting.set(true);
    this.appealError.set(null);
    this.caucus.submitAppeal(this.appealControl.value).subscribe({
      next: () => {
        this.appealSubmitting.set(false);
        this.appealControl.reset('');
      },
      error: (err: Error) => {
        this.appealSubmitting.set(false);
        this.appealError.set(err.message);
        this.caucus.loadMe().subscribe();
      },
    });
  }

  loadMoreWallet(): void {
    const cursor = this.walletCursor();
    if (!cursor) {
      return;
    }
    this.caucus.wallet(20, cursor).subscribe((res) => {
      this.walletItems.update((items) => [...items, ...res.items]);
      this.walletCursor.set(res.nextCursor);
    });
  }

  walletRowLabel(item: CaucusWalletEntry): string {
    if (item.direction === 'DEBIT') {
      return 'Cashout';
    }
    return item.monthKey ? `Allowance for ${this.monthTitle(item.monthKey)}` : 'Allowance';
  }

  loadTeamPage(page: number): void {
    this.teamPage.set(page);
    this.caucus.team(page, 20, this.teamSearch()).subscribe((res) => {
      this.team.set(res.members ?? []);
      this.teamHasNext.set((res.members?.length ?? 0) >= 20);
    });
  }

  searchTeam(): void {
    this.teamPage.set(1);
    this.loadTeamPage(1);
  }

  private loadSections(): void {
    const m = this.me();
    if (!m || m.status === 'NONE') {
      return;
    }
    const monthKey = m.currentMonth?.monthKey;
    if (monthKey) {
      this.caucus.referrals(monthKey, 1, 20).subscribe((res) => {
        this.referrals.set(res.referrals.filter((r) => !r.voidedAt));
      });
    }
    this.caucus.months().subscribe((rows) => this.months.set(rows));
    this.loadTeamPage(1);
    this.caucus.wallet(20).subscribe((res) => {
      this.walletItems.set(res.items);
      this.walletCursor.set(res.nextCursor);
    });
    this.caucus.pv().subscribe((rows) => this.pvAwards.set(rows));
  }
}
