import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, finalize, map, shareReplay, tap } from 'rxjs/operators';
import { ApiService } from './api.service';

export type ConsultantStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVOKED';

export type ConsultantUiState =
  | 'apply'
  | 'pending'
  | 'approved'
  | 'reapply'
  | 'revoked'
  | 'blocked';

export interface ConsultantApplication {
  id: string;
  userId: string;
  status: ConsultantStatus;
  seminarCentreName: string;
  seminarCentreAddress?: string | null;
  seminarCentreCity?: string | null;
  seminarCentreState?: string | null;
  phoneNumber?: string | null;
  applicantNotes?: string | null;
  appliedAt: string;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  grantedByAdmin?: boolean;
  isStage1Complete?: boolean;
  effectiveRankingLevel?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConsultantEligibility {
  canApply: boolean;
  reason?: string | null;
  status?: ConsultantStatus | null;
  isRegistrationPaid: boolean;
  isStage1Complete: boolean;
  effectiveRankingLevel: number;
}

export interface ApplyConsultantBody {
  seminarCentreName: string;
  seminarCentreAddress?: string;
  seminarCentreCity?: string;
  seminarCentreState?: string;
  phoneNumber?: string;
  applicantNotes?: string;
}

@Injectable({ providedIn: 'root' })
export class ConsultantService {
  private api = inject(ApiService);

  private eligibilitySignal = signal<ConsultantEligibility | null>(null);
  private applicationSignal = signal<ConsultantApplication | null>(null);
  private loadingSignal = signal(false);
  private actionLoadingSignal = signal(false);
  private errorSignal = signal<string | null>(null);

  private eligibilityRequest$: Observable<ConsultantEligibility | null> | null = null;
  private applicationRequest$: Observable<ConsultantApplication | null> | null = null;

  readonly eligibility = this.eligibilitySignal.asReadonly();
  readonly application = this.applicationSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly actionLoading = this.actionLoadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  readonly consultantStatus = computed(() => {
    const app = this.applicationSignal();
    const eligibility = this.eligibilitySignal();
    return app?.status ?? eligibility?.status ?? null;
  });

  readonly isApprovedConsultant = computed(() => this.consultantStatus() === 'APPROVED');

  readonly isPendingReview = computed(() => this.consultantStatus() === 'PENDING');

  readonly canSubmitApplication = computed(() => {
    const eligibility = this.eligibilitySignal();
    return eligibility?.canApply === true;
  });

  readonly uiState = computed((): ConsultantUiState => {
    const eligibility = this.eligibilitySignal();
    const status = this.consultantStatus();

    if (eligibility && !eligibility.isRegistrationPaid) {
      return 'blocked';
    }

    if (status === 'APPROVED') return 'approved';
    if (status === 'PENDING') return 'pending';
    if (status === 'REJECTED') return 'reapply';
    if (status === 'REVOKED') {
      return eligibility?.canApply ? 'reapply' : 'revoked';
    }

    if (eligibility?.canApply) return 'apply';

    return 'blocked';
  });

  clearError(): void {
    this.errorSignal.set(null);
  }

  /** GET /consultants/eligibility */
  fetchEligibility$(): Observable<ConsultantEligibility | null> {
    if (this.eligibilityRequest$) {
      return this.eligibilityRequest$;
    }

    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    this.eligibilityRequest$ = this.api.get<ConsultantEligibility>('consultants/eligibility').pipe(
      tap((res) => this.eligibilitySignal.set(res)),
      catchError((err) => {
        console.error('[ConsultantService] fetchEligibility failed', err);
        this.errorSignal.set(this.extractErrorMessage(err, 'Failed to load consultant eligibility.'));
        return of(null);
      }),
      finalize(() => {
        this.eligibilityRequest$ = null;
        this.loadingSignal.set(false);
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    return this.eligibilityRequest$;
  }

  fetchEligibility(): void {
    this.fetchEligibility$().subscribe();
  }

  /** GET /consultants/me */
  fetchApplication$(): Observable<ConsultantApplication | null> {
    if (this.applicationRequest$) {
      return this.applicationRequest$;
    }

    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    this.applicationRequest$ = this.api.get<ConsultantApplication | null>('consultants/me').pipe(
      map((res) => (res && res.id ? res : null)),
      tap((res) => this.applicationSignal.set(res)),
      catchError((err) => {
        console.error('[ConsultantService] fetchApplication failed', err);
        this.errorSignal.set(this.extractErrorMessage(err, 'Failed to load consultant application.'));
        return of(null);
      }),
      finalize(() => {
        this.applicationRequest$ = null;
        this.loadingSignal.set(false);
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    return this.applicationRequest$;
  }

  fetchApplication(): void {
    this.fetchApplication$().subscribe();
  }

  /** Load eligibility and application together. */
  fetchConsultantData(): void {
    this.fetchEligibility();
    this.fetchApplication();
  }

  /** POST /consultants/apply */
  apply(body: ApplyConsultantBody): Observable<ConsultantApplication | null> {
    this.actionLoadingSignal.set(true);
    this.errorSignal.set(null);

    return this.api.post<ConsultantApplication>('consultants/apply', body).pipe(
      tap((res) => {
        if (res?.id) {
          this.applicationSignal.set(res);
          this.eligibilitySignal.update((current) =>
            current
              ? {
                  ...current,
                  canApply: false,
                  status: res.status,
                  reason: 'Application pending admin review',
                }
              : current,
          );
        }
      }),
      catchError((err) => {
        console.error('[ConsultantService] apply failed', err);
        this.errorSignal.set(this.extractErrorMessage(err, 'Failed to submit consultant application.'));
        return of(null);
      }),
      finalize(() => this.actionLoadingSignal.set(false)),
    );
  }

  private extractErrorMessage(err: unknown, fallback: string): string {
    const httpErr = err as { status?: number; error?: { message?: string | string[] } };
    const msg = httpErr?.error?.message;

    if (httpErr?.status === 409) {
      return 'You are already an approved business consultant.';
    }
    if (httpErr?.status === 400) {
      const text = typeof msg === 'string' ? msg : Array.isArray(msg) ? msg[0] : null;
      if (text?.toLowerCase().includes('registration') || text?.toLowerCase().includes('paid')) {
        return 'Complete your registration payment before applying.';
      }
    }

    return (typeof msg === 'string' ? msg : Array.isArray(msg) ? msg[0] : null) ?? fallback;
  }
}
