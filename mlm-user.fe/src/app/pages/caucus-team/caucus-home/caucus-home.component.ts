import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
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
import { CaucusPagerComponent } from '../components/caucus-pager.component';
import { CaucusProgressComponent } from '../components/caucus-progress.component';
import { CaucusSectionCardComponent } from '../components/caucus-section-card.component';
import { CaucusStatusPillComponent } from '../components/caucus-status-pill.component';
import { CaucusWalletCardComponent } from '../components/caucus-wallet-card.component';

@Component({
  selector: 'app-caucus-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    CaucusSectionCardComponent,
    CaucusStatusPillComponent,
    CaucusProgressComponent,
    CaucusWalletCardComponent,
    CaucusEmptyStateComponent,
    CaucusPagerComponent,
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

  referralPage = signal(1);
  referralHasNext = signal(false);
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
        this.referralHasNext.set(res.pagination?.hasNextPage ?? false);
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
