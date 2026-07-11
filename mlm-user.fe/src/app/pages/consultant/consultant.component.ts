import {
  Component,
  inject,
  signal,
  computed,
  effect,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { forkJoin } from 'rxjs';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import {
  ConsultantService,
  type ApplyConsultantBody,
  type ConsultantApplication,
} from '../../services/consultant.service';
import { UserService } from '../../services/user.service';
import { CommissionService } from '../../services/commission.service';
import { EarningsService } from '../../services/earnings.service';
import { NIGERIAN_STATES } from '../../core/constants/states.constants';
import {
  filterConsultantEarnings,
  formatConsultantEarningType,
  type ConsultantEarningsKind,
} from '../../core/utils/consultant-earnings.util';
import { StatusBadgeComponent } from '../../components/status-badge/status-badge.component';

type EarningsTab = ConsultantEarningsKind;

@Component({
  selector: 'app-consultant',
  imports: [CommonModule, RouterLink, FormsModule, ButtonModule, DatePipe, StatusBadgeComponent],
  templateUrl: './consultant.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsultantComponent implements OnInit {
  private consultantService = inject(ConsultantService);
  private userService = inject(UserService);
  private commissionService = inject(CommissionService);
  private earningsService = inject(EarningsService);
  private messageService = inject(MessageService);

  eligibility = this.consultantService.eligibility;
  application = this.consultantService.application;
  loading = this.consultantService.loading;
  actionLoading = this.consultantService.actionLoading;
  error = this.consultantService.error;
  uiState = this.consultantService.uiState;
  canSubmitApplication = this.consultantService.canSubmitApplication;

  isPaid = this.userService.isPaid;
  displayCurrency = this.userService.displayCurrency;
  earningsLoading = this.earningsService.isLoading;

  seminarCentreName = signal('');
  seminarCentreAddress = signal('');
  seminarCentreCity = signal('');
  seminarCentreState = signal('');
  phoneNumber = signal('');
  applicantNotes = signal('');

  formError = signal('');
  earningsTab = signal<EarningsTab>('registration');
  allStates = NIGERIAN_STATES;

  private allCommissions = this.commissionService.getAllCommissions();

  registrationBonuses = computed(() =>
    filterConsultantEarnings(this.allCommissions(), 'registration'),
  );

  productBonuses = computed(() => filterConsultantEarnings(this.allCommissions(), 'product'));

  activeBonuses = computed(() =>
    this.earningsTab() === 'registration'
      ? this.registrationBonuses()
      : this.productBonuses(),
  );

  activeTabTotal = computed(() =>
    this.activeBonuses().reduce((sum, entry) => sum + entry.amount, 0),
  );

  registrationTabTotal = computed(() =>
    this.registrationBonuses().reduce((sum, entry) => sum + entry.amount, 0),
  );

  productTabTotal = computed(() =>
    this.productBonuses().reduce((sum, entry) => sum + entry.amount, 0),
  );

  showApplicationForm = computed(() => {
    const state = this.uiState();
    return state === 'apply' || state === 'reapply';
  });

  stage1Hint = computed(() => {
    const eligibility = this.eligibility();
    if (!eligibility || eligibility.isStage1Complete) return null;
    return `Stage 1 is not yet complete (effective ranking level ${eligibility.effectiveRankingLevel}). You may still apply — admin will review your eligibility.`;
  });

  private prefillApplied = false;
  private earningsLoadStarted = false;

  constructor() {
    effect(() => {
      if (this.loading() || this.prefillApplied) return;

      const app = this.application();
      const state = this.uiState();
      if (!app || (state !== 'reapply' && state !== 'apply')) return;

      if (app.seminarCentreName) this.seminarCentreName.set(app.seminarCentreName);
      if (app.seminarCentreAddress) this.seminarCentreAddress.set(app.seminarCentreAddress);
      if (app.seminarCentreCity) this.seminarCentreCity.set(app.seminarCentreCity);
      if (app.seminarCentreState) this.seminarCentreState.set(app.seminarCentreState);
      if (app.phoneNumber) this.phoneNumber.set(app.phoneNumber);
      if (app.applicantNotes) this.applicantNotes.set(app.applicantNotes);
      this.prefillApplied = true;
    });

    effect(() => {
      if (this.loading()) return;
      this.loadConsultantEarningsIfApproved();
    });
  }

  ngOnInit(): void {
    if (!this.isPaid()) return;

    forkJoin({
      eligibility: this.consultantService.fetchEligibility$(),
      application: this.consultantService.fetchApplication$(),
    }).subscribe({
      next: () => this.loadConsultantEarningsIfApproved(),
    });
  }

  private loadConsultantEarningsIfApproved(): void {
    if (this.earningsLoadStarted || !this.isPaid() || this.uiState() !== 'approved') {
      return;
    }

    this.earningsLoadStarted = true;
    this.earningsService.fetchEarningsSectionData();
  }

  setEarningsTab(tab: EarningsTab): void {
    this.earningsTab.set(tab);
  }

  submitApplication(): void {
    this.formError.set('');
    this.consultantService.clearError();

    const name = this.seminarCentreName().trim();
    if (!name) {
      this.formError.set('Seminar centre name is required.');
      return;
    }

    const body: ApplyConsultantBody = {
      seminarCentreName: name,
    };

    const address = this.seminarCentreAddress().trim();
    const city = this.seminarCentreCity().trim();
    const state = this.seminarCentreState().trim();
    const phone = this.phoneNumber().trim();
    const notes = this.applicantNotes().trim();

    if (address) body.seminarCentreAddress = address;
    if (city) body.seminarCentreCity = city;
    if (state) body.seminarCentreState = state;
    if (phone) body.phoneNumber = phone;
    if (notes) body.applicantNotes = notes;

    this.consultantService.apply(body).subscribe((result) => {
      if (!result) return;

      this.messageService.add({
        severity: 'success',
        summary: 'Application submitted',
        detail: 'Your business consultant application is pending admin review.',
      });
      this.consultantService.fetchEligibility();
    });
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  formatEarningType(type: string | undefined): string {
    return formatConsultantEarningType(type);
  }

  formatAmount(amount: number, currency?: 'NGN' | 'USD'): string {
    const symbol = (currency ?? this.displayCurrency()) === 'USD' ? '$' : '₦';
    const formatted = new Intl.NumberFormat('en-NG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
    return `${symbol}${formatted}`;
  }

  earningsEmptyMessage(): string {
    return this.earningsTab() === 'registration'
      ? 'No registration bonuses yet.'
      : 'No product bonuses yet.';
  }

  applicationField(
    app: ConsultantApplication | null,
    key: keyof ConsultantApplication,
  ): string {
    if (!app) return '—';
    const value = app[key];
    if (value == null || value === '') return '—';
    return String(value);
  }
}
