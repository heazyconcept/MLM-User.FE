import {
  Component,
  inject,
  signal,
  computed,
  effect,
  OnInit,
  ChangeDetectionStrategy,
  type WritableSignal,
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
  type DayOfWeek,
  type TrainingScheduleSlot,
  type UpdateConsultantBody,
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

interface EditableScheduleSlot {
  dayOfWeek: DayOfWeek | '';
  startTime: string;
  endTime: string;
}

const DAY_OPTIONS: { value: DayOfWeek; label: string }[] = [
  { value: 'MONDAY', label: 'Monday' },
  { value: 'TUESDAY', label: 'Tuesday' },
  { value: 'WEDNESDAY', label: 'Wednesday' },
  { value: 'THURSDAY', label: 'Thursday' },
  { value: 'FRIDAY', label: 'Friday' },
  { value: 'SATURDAY', label: 'Saturday' },
  { value: 'SUNDAY', label: 'Sunday' },
];

const TIME_HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MAX_SCHEDULE_SLOTS = 7;

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
  applyScheduleSlots = signal<EditableScheduleSlot[]>([
    { dayOfWeek: '', startTime: '10:00', endTime: '14:00' },
  ]);

  editingCentre = signal(false);
  editSeminarCentreName = signal('');
  editSeminarCentreAddress = signal('');
  editSeminarCentreCity = signal('');
  editSeminarCentreState = signal('');
  editPhoneNumber = signal('');
  editScheduleSlots = signal<EditableScheduleSlot[]>([]);
  editFormError = signal('');

  formError = signal('');
  earningsTab = signal<EarningsTab>('registration');
  allStates = NIGERIAN_STATES;
  readonly dayOptions = DAY_OPTIONS;
  readonly maxScheduleSlots = MAX_SCHEDULE_SLOTS;

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

  formattedSchedule = computed(() => {
    const slots = this.application()?.trainingSchedule ?? [];
    return slots.map((slot) => this.formatScheduleSlot(slot));
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
      if (app.trainingSchedule?.length) {
        this.applyScheduleSlots.set(
          app.trainingSchedule.map((slot) => ({
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            endTime: slot.endTime,
          })),
        );
      }
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

  startEditCentre(): void {
    const app = this.application();
    if (!app) return;

    this.editFormError.set('');
    this.consultantService.clearError();
    this.editSeminarCentreName.set(app.seminarCentreName ?? '');
    this.editSeminarCentreAddress.set(app.seminarCentreAddress ?? '');
    this.editSeminarCentreCity.set(app.seminarCentreCity ?? '');
    this.editSeminarCentreState.set(app.seminarCentreState ?? '');
    this.editPhoneNumber.set(app.phoneNumber ?? '');
    this.editScheduleSlots.set(
      (app.trainingSchedule ?? []).map((slot) => ({
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
      })),
    );
    this.editingCentre.set(true);
  }

  cancelEditCentre(): void {
    this.editingCentre.set(false);
    this.editFormError.set('');
    this.consultantService.clearError();
  }

  addScheduleSlot(): void {
    this.addScheduleSlotTo(this.editScheduleSlots);
  }

  removeScheduleSlot(index: number): void {
    this.removeScheduleSlotFrom(this.editScheduleSlots, index);
  }

  updateScheduleSlot(index: number, patch: Partial<EditableScheduleSlot>): void {
    this.updateScheduleSlotIn(this.editScheduleSlots, index, patch);
  }

  addApplyScheduleSlot(): void {
    this.addScheduleSlotTo(this.applyScheduleSlots);
  }

  removeApplyScheduleSlot(index: number): void {
    this.removeScheduleSlotFrom(this.applyScheduleSlots, index);
  }

  updateApplyScheduleSlot(index: number, patch: Partial<EditableScheduleSlot>): void {
    this.updateScheduleSlotIn(this.applyScheduleSlots, index, patch);
  }

  private addScheduleSlotTo(target: WritableSignal<EditableScheduleSlot[]>): void {
    if (target().length >= MAX_SCHEDULE_SLOTS) return;
    target.update((slots) => [
      ...slots,
      { dayOfWeek: '', startTime: '10:00', endTime: '14:00' },
    ]);
  }

  private removeScheduleSlotFrom(
    target: WritableSignal<EditableScheduleSlot[]>,
    index: number,
  ): void {
    target.update((slots) => slots.filter((_, i) => i !== index));
  }

  private updateScheduleSlotIn(
    target: WritableSignal<EditableScheduleSlot[]>,
    index: number,
    patch: Partial<EditableScheduleSlot>,
  ): void {
    target.update((slots) =>
      slots.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)),
    );
  }

  saveCentreDetails(): void {
    this.editFormError.set('');
    this.consultantService.clearError();

    const name = this.editSeminarCentreName().trim();
    if (!name) {
      this.editFormError.set('Seminar centre name is required.');
      return;
    }

    const scheduleResult = this.validateAndBuildSchedule(this.editScheduleSlots(), {
      requireAtLeastOne: false,
    });
    if (!scheduleResult.ok) {
      this.editFormError.set(scheduleResult.error);
      return;
    }

    const body: UpdateConsultantBody = {
      seminarCentreName: name,
      seminarCentreAddress: this.editSeminarCentreAddress().trim(),
      seminarCentreCity: this.editSeminarCentreCity().trim(),
      seminarCentreState: this.editSeminarCentreState().trim(),
      phoneNumber: this.editPhoneNumber().trim(),
      trainingSchedule: scheduleResult.slots,
    };

    this.consultantService.updateMe(body).subscribe((result) => {
      if (!result) {
        this.editFormError.set(this.error() ?? 'Failed to update seminar centre details.');
        return;
      }

      this.editingCentre.set(false);
      this.messageService.add({
        severity: 'success',
        summary: 'Details updated',
        detail: 'Your seminar centre details have been saved.',
      });
    });
  }

  private validateAndBuildSchedule(
    raw: EditableScheduleSlot[],
    options: { requireAtLeastOne: boolean },
  ): { ok: true; slots: TrainingScheduleSlot[] } | { ok: false; error: string } {
    if (raw.length > MAX_SCHEDULE_SLOTS) {
      return { ok: false, error: `You can add at most ${MAX_SCHEDULE_SLOTS} training days.` };
    }
    if (options.requireAtLeastOne && raw.length === 0) {
      return { ok: false, error: 'Add at least one training day and time.' };
    }

    const slots: TrainingScheduleSlot[] = [];
    const seenDays = new Set<DayOfWeek>();

    for (let i = 0; i < raw.length; i++) {
      const row = raw[i];
      if (!row.dayOfWeek) {
        return { ok: false, error: `Select a day for training slot ${i + 1}.` };
      }
      if (seenDays.has(row.dayOfWeek)) {
        return { ok: false, error: 'Each weekday can only appear once in the schedule.' };
      }
      seenDays.add(row.dayOfWeek);

      const startTime = row.startTime.trim();
      const endTime = row.endTime.trim();
      if (!TIME_HH_MM.test(startTime) || !TIME_HH_MM.test(endTime)) {
        return {
          ok: false,
          error: `Use 24-hour HH:mm times for training slot ${i + 1}.`,
        };
      }
      if (endTime <= startTime) {
        return {
          ok: false,
          error: `End time must be after start time for training slot ${i + 1}.`,
        };
      }

      slots.push({ dayOfWeek: row.dayOfWeek, startTime, endTime });
    }

    return { ok: true, slots };
  }

  formatScheduleSlot(slot: TrainingScheduleSlot): string {
    const day = DAY_OPTIONS.find((d) => d.value === slot.dayOfWeek)?.label ?? slot.dayOfWeek;
    return `${day} ${slot.startTime}–${slot.endTime}`;
  }

  submitApplication(): void {
    this.formError.set('');
    this.consultantService.clearError();

    const name = this.seminarCentreName().trim();
    if (!name) {
      this.formError.set('Seminar centre name is required.');
      return;
    }

    const scheduleResult = this.validateAndBuildSchedule(this.applyScheduleSlots(), {
      requireAtLeastOne: true,
    });
    if (!scheduleResult.ok) {
      this.formError.set(scheduleResult.error);
      return;
    }

    const body: ApplyConsultantBody = {
      seminarCentreName: name,
      trainingSchedule: scheduleResult.slots,
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
