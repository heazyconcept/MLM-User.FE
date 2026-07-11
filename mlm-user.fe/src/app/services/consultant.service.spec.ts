import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { describe, beforeEach, it, expect, afterEach } from 'vitest';
import { ConsultantService } from './consultant.service';
import { ApiService } from './api.service';
import { environment } from '../../environments/environment';

describe('ConsultantService', () => {
  let service: ConsultantService;
  let httpMock: HttpTestingController;
  const baseUrl = environment.apiUrl;

  const mockApplication = {
    id: 'consultant-1',
    userId: 'user-1',
    status: 'PENDING' as const,
    seminarCentreName: 'Segulah Training Centre Lagos',
    seminarCentreAddress: '12 Seminar Road, Ikeja',
    seminarCentreCity: 'Lagos',
    seminarCentreState: 'Lagos',
    phoneNumber: '+2348012345678',
    applicantNotes: 'Weekly seminars every Saturday 10am',
    appliedAt: '2026-07-11T15:00:00.000Z',
    reviewedAt: null,
    rejectionReason: null,
    grantedByAdmin: false,
    isStage1Complete: true,
    effectiveRankingLevel: 4,
    createdAt: '2026-07-11T15:00:00.000Z',
    updatedAt: '2026-07-11T15:00:00.000Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ConsultantService, ApiService],
    });

    service = TestBed.inject(ConsultantService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('maps eligibility and uiState to apply when canApply is true', () => {
    service.fetchEligibility$().subscribe();

    const req = httpMock.expectOne(`${baseUrl}/consultants/eligibility`);
    expect(req.request.method).toBe('GET');
    req.flush({
      canApply: true,
      status: null,
      isRegistrationPaid: true,
      isStage1Complete: false,
      effectiveRankingLevel: 2,
    });

    expect(service.eligibility()?.canApply).toBe(true);
    expect(service.uiState()).toBe('apply');
  });

  it('maps uiState to pending when application status is PENDING', () => {
    service.fetchEligibility$().subscribe();
    httpMock.expectOne(`${baseUrl}/consultants/eligibility`).flush({
      canApply: false,
      status: 'PENDING',
      isRegistrationPaid: true,
      isStage1Complete: true,
      effectiveRankingLevel: 4,
    });

    service.fetchApplication$().subscribe();
    httpMock.expectOne(`${baseUrl}/consultants/me`).flush(mockApplication);

    expect(service.uiState()).toBe('pending');
    expect(service.isPendingReview()).toBe(true);
  });

  it('maps uiState to approved when application status is APPROVED', () => {
    service.fetchEligibility$().subscribe();
    httpMock.expectOne(`${baseUrl}/consultants/eligibility`).flush({
      canApply: false,
      status: 'APPROVED',
      isRegistrationPaid: true,
      isStage1Complete: true,
      effectiveRankingLevel: 4,
    });

    service.fetchApplication$().subscribe();
    httpMock.expectOne(`${baseUrl}/consultants/me`).flush({
      ...mockApplication,
      status: 'APPROVED',
      reviewedAt: '2026-07-12T10:00:00.000Z',
    });

    expect(service.uiState()).toBe('approved');
    expect(service.isApprovedConsultant()).toBe(true);
  });

  it('maps uiState to reapply when status is REJECTED', () => {
    service.fetchEligibility$().subscribe();
    httpMock.expectOne(`${baseUrl}/consultants/eligibility`).flush({
      canApply: true,
      status: 'REJECTED',
      isRegistrationPaid: true,
      isStage1Complete: true,
      effectiveRankingLevel: 4,
    });

    service.fetchApplication$().subscribe();
    httpMock.expectOne(`${baseUrl}/consultants/me`).flush({
      ...mockApplication,
      status: 'REJECTED',
      rejectionReason: 'Could not verify centre address.',
    });

    expect(service.uiState()).toBe('reapply');
    expect(service.canSubmitApplication()).toBe(true);
  });

  it('maps uiState to revoked when status is REVOKED and canApply is false', () => {
    service.fetchEligibility$().subscribe();
    httpMock.expectOne(`${baseUrl}/consultants/eligibility`).flush({
      canApply: false,
      status: 'REVOKED',
      isRegistrationPaid: true,
      isStage1Complete: true,
      effectiveRankingLevel: 4,
    });

    service.fetchApplication$().subscribe();
    httpMock.expectOne(`${baseUrl}/consultants/me`).flush({
      ...mockApplication,
      status: 'REVOKED',
    });

    expect(service.uiState()).toBe('revoked');
  });

  it('submits application via POST /consultants/apply', () => {
    const body = {
      seminarCentreName: 'Segulah Training Centre Lagos',
      seminarCentreAddress: '12 Seminar Road, Ikeja',
      seminarCentreCity: 'Lagos',
      seminarCentreState: 'Lagos',
      phoneNumber: '+2348012345678',
      applicantNotes: 'Weekly seminars every Saturday 10am',
    };

    service.apply(body).subscribe((result) => {
      expect(result?.status).toBe('PENDING');
      expect(result?.seminarCentreName).toBe(body.seminarCentreName);
    });

    const req = httpMock.expectOne(`${baseUrl}/consultants/apply`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush(mockApplication);

    expect(service.application()?.status).toBe('PENDING');
    expect(service.eligibility()?.canApply).toBe(false);
  });

  it('maps 409 error to already approved message', () => {
    service.apply({ seminarCentreName: 'Test Centre' }).subscribe((result) => {
      expect(result).toBeNull();
    });

    const req = httpMock.expectOne(`${baseUrl}/consultants/apply`);
    req.flush({ message: 'Already approved' }, { status: 409, statusText: 'Conflict' });

    expect(service.error()).toBe('You are already an approved business consultant.');
  });
});
