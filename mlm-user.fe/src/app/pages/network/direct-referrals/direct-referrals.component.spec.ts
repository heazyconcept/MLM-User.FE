import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { DirectReferralsComponent } from './direct-referrals.component';
import { ReferralService } from '../../../services/referral.service';

describe('DirectReferralsComponent', () => {
  let fixture: ComponentFixture<DirectReferralsComponent>;
  let component: DirectReferralsComponent;

  const mockResponse = {
    status: 'success' as const,
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
        totalRecords: 2,
        currentPage: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
      directReferrals: [
        {
          id: '1',
          username: 'paid_user',
          email: 'paid@example.com',
          phone: null,
          firstName: 'Paid',
          lastName: 'User',
          registrationPackage: 'GOLD',
          package: 'GOLD',
          status: 'INACTIVE',
          isActive: true,
          isRegistrationPaid: true,
          joinDate: '2026-05-01T00:00:00.000Z',
          directReferralsCount: 1,
          drRemaining: 2,
        },
        {
          id: '2',
          username: 'registered_user',
          email: 'reg@example.com',
          phone: null,
          firstName: 'Registered',
          lastName: 'User',
          registrationPackage: 'SILVER',
          package: 'SILVER',
          status: 'REGISTERED',
          isActive: true,
          isRegistrationPaid: false,
          joinDate: '2026-06-01T00:00:00.000Z',
          directReferralsCount: 0,
          drRemaining: 3,
        },
      ],
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DirectReferralsComponent],
      providers: [
        {
          provide: ReferralService,
          useValue: {
            getMyDirectReferrals: vi.fn().mockReturnValue(of(mockResponse)),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DirectReferralsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('stores summary counts from API response', () => {
    expect(component.summary().totalRegisteredDirectReferrals).toBe(6);
    expect(component.summary().totalActiveDirectReferrals).toBe(3);
    expect(component.summary().totalMlmInactiveDirectReferrals).toBe(3);
  });

  it('filters displayed rows by registered status on current page', () => {
    component.onStatusFilterChange('REGISTERED');
    fixture.detectChanges();

    expect(component.displayedRows().length).toBe(1);
    expect(component.displayedRows()[0]?.status).toBe('REGISTERED');
  });

  it('returns summary count for each filter tab', () => {
    expect(component.summaryCountForFilter('REGISTERED')).toBe(6);
    expect(component.summaryCountForFilter('ACTIVE')).toBe(0);
    expect(component.summaryCountForFilter('INACTIVE')).toBe(3);
  });
});
