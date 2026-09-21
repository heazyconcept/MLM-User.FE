import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../environments/environment';
import { ApiService } from './api.service';
import { UserService } from './user.service';

describe('UserService profile completeness', () => {
  let service: UserService;
  let httpMock: HttpTestingController;
  const baseUrl = environment.apiUrl;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), UserService, ApiService],
    });
    service = TestBed.inject(UserService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  function flushProfile(
    body: Record<string, unknown>,
    bank: Record<string, unknown> = {},
  ): void {
    const profileReq = httpMock.expectOne((r) => r.url === `${baseUrl}/users/me` && r.method === 'GET');
    profileReq.flush(body);
    const bankReq = httpMock.expectOne(
      (r) => r.url === `${baseUrl}/users/me/bank` && r.method === 'GET',
    );
    bankReq.flush(bank);
    const prefsReq = httpMock.expectOne(
      (r) => r.url === `${baseUrl}/users/me/preferences` && r.method === 'GET',
    );
    prefsReq.flush({});
  }

  it('maps isProfileComplete and missing fields from GET /users/me', () => {
    let mapped = false;
    service.fetchProfile().subscribe((user) => {
      expect(user.isProfileComplete).toBe(false);
      expect(user.profileMissingFields).toEqual(['phone', 'address']);
      mapped = true;
    });

    flushProfile({
      id: 'user-1',
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Okafor',
      registrationPaid: true,
      isProfileComplete: false,
      profileMissingFields: ['phone', 'address', 'not-a-field'],
      profileCompletionPercentage: 40,
    });

    expect(mapped).toBe(true);
    expect(service.needsProfileSetup()).toBe(true);
    expect(service.isProfileComplete()).toBe(false);
  });

  it('treats an explicit true flag as complete', () => {
    service.fetchProfile().subscribe();
    flushProfile({
      id: 'user-1',
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Okafor',
      registrationPaid: true,
      isProfileComplete: true,
      profileMissingFields: [],
      profileCompletionPercentage: 100,
    });

    expect(service.needsProfileSetup()).toBe(false);
    expect(service.isProfileComplete()).toBe(true);
  });

  it('clears a stale accountNumber gap when GET /users/me/bank already has the number', () => {
    service.fetchProfile().subscribe();
    flushProfile(
      {
        id: 'user-1',
        email: 'ada@example.com',
        firstName: 'Ada',
        lastName: 'Okafor',
        phone: '08012345678',
        address: '12 Example Street',
        registrationPaid: true,
        isProfileComplete: false,
        profileMissingFields: ['accountNumber'],
      },
      {
        bankName: 'GTBank',
        accountNumber: '0123456789',
        accountName: 'Ada Okafor',
      },
    );

    expect(service.needsProfileSetup()).toBe(false);
    expect(service.isProfileComplete()).toBe(true);
    expect(service.currentUser()?.accountNumber).toBe('0123456789');
  });

  it('treats a masked bank account number as present', () => {
    service.fetchProfile().subscribe();
    flushProfile(
      {
        id: 'user-1',
        email: 'ada@example.com',
        firstName: 'Ada',
        lastName: 'Okafor',
        registrationPaid: true,
        isProfileComplete: false,
        profileMissingFields: ['accountNumber'],
      },
      {
        bankName: 'GTBank',
        accountNumberMasked: '******6789',
        accountName: 'Ada Okafor',
      },
    );

    expect(service.needsProfileSetup()).toBe(false);
    expect(service.currentUser()?.accountNumber).toBe('******6789');
  });

  it('clears a stale accountNumber gap when bank details are saved locally', () => {
    service.setUser({
      id: 'user-1',
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Okafor',
      paymentStatus: 'PAID',
      profileCompletionPercentage: 80,
      isProfileComplete: false,
      profileMissingFields: ['accountNumber'],
    });

    service.updateProfile({
      bankName: 'GTBank',
      accountNumber: '0123456789',
      accountName: 'Ada Okafor',
    });

    expect(service.needsProfileSetup()).toBe(false);
    expect(service.isProfileComplete()).toBe(true);
  });

  it('does not keep accountNumber missing after a completeness payload if the number is already on the user', () => {
    service.setUser({
      id: 'user-1',
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Okafor',
      paymentStatus: 'PAID',
      profileCompletionPercentage: 80,
      isProfileComplete: false,
      profileMissingFields: ['accountNumber'],
      accountNumber: '0123456789',
      bankName: 'GTBank',
      accountName: 'Ada Okafor',
    });

    service.applyProfileCompleteness({
      isProfileComplete: false,
      profileMissingFields: ['accountNumber'],
    });

    expect(service.needsProfileSetup()).toBe(false);
    expect(service.currentUser()?.profileMissingFields).toEqual([]);
  });
});
