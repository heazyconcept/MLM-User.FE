import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../environments/environment';
import { ApiService } from './api.service';
import { ReferralService, type ReferralStats } from './referral.service';

describe('ReferralService direct referral counts', () => {
  let service: ReferralService;
  let httpMock: HttpTestingController;
  const baseUrl = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ReferralService, ApiService],
    });
    service = TestBed.inject(ReferralService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('maps referral stats with paid and registered breakdown', () => {
    let captured: ReferralStats | undefined;
    service.getReferralStats().subscribe((result) => {
      captured = result;
      expect(result.totalDirectReferrals).toBe(9);
      expect(result.totalPaidDirectReferrals).toBe(3);
      expect(result.totalRegisteredDirectReferrals).toBe(6);
      expect(result.totalMlmActiveDirectReferrals).toBe(0);
      expect(result.totalMlmInactiveDirectReferrals).toBe(3);
      expect(result.isLeader).toBe(true);
    });

    const req = httpMock.expectOne(
      (r) => r.url === `${baseUrl}/referrals/me/stats` && r.method === 'GET',
    );
    req.flush({
      teamSize: 3,
      totalDirectReferrals: 9,
      totalPaidDirectReferrals: 3,
      totalRegisteredDirectReferrals: 6,
      totalMlmActiveDirectReferrals: 0,
      totalMlmInactiveDirectReferrals: 3,
      totalActiveDirectReferrals: 3,
      isLeader: true,
      totalLeaders: 0,
    });

    expect(captured).toBeDefined();
  });

  it('derives registered count when backend omits breakdown fields', () => {
    service.getReferralStats().subscribe((result) => {
      expect(result.totalPaidDirectReferrals).toBe(3);
      expect(result.totalRegisteredDirectReferrals).toBe(6);
      expect(result.totalMlmInactiveDirectReferrals).toBe(3);
      expect(result.isLeader).toBe(true);
    });

    const req = httpMock.expectOne(
      (r) => r.url === `${baseUrl}/referrals/me/stats` && r.method === 'GET',
    );
    req.flush({
      teamSize: 3,
      totalDirectReferrals: 9,
      totalActiveDirectReferrals: 3,
      totalLeaders: 0,
      isLeader: true,
    });
  });

  it('maps direct-referrals summary breakdown from API envelope', () => {
    service.getMyDirectReferrals({ page: 1, limit: 20 }).subscribe((response) => {
      expect(response.data.summary).toEqual({
        totalDirectReferrals: 9,
        totalActiveDirectReferrals: 3,
        totalRegisteredDirectReferrals: 6,
        totalMlmActiveDirectReferrals: 0,
        totalMlmInactiveDirectReferrals: 3,
        isLeader: true,
      });
    });

    const req = httpMock.expectOne(
      (r) => r.url === `${baseUrl}/referrals/me/direct-referrals` && r.method === 'GET',
    );
    req.flush({
      status: 'success',
      data: {
        sponsorUserId: 'sponsor-1',
        sponsorUsername: 'lingzju',
        summary: {
          totalDirectReferrals: 9,
          totalActiveDirectReferrals: 3,
          totalRegisteredDirectReferrals: 6,
          totalMlmActiveDirectReferrals: 0,
          totalMlmInactiveDirectReferrals: 3,
          isLeader: true,
        },
        pagination: {
          totalRecords: 9,
          currentPage: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
        directReferrals: [
          {
            id: 'dr-paid',
            username: 'paid_dr',
            email: 'paid@example.com',
            status: 'INACTIVE',
            isRegistrationPaid: true,
            directReferralsCount: 0,
          },
          {
            id: 'dr-reg',
            username: 'registered_dr',
            email: 'reg@example.com',
            status: 'REGISTERED',
            isRegistrationPaid: false,
            directReferralsCount: 0,
          },
        ],
      },
    });
  });
});
