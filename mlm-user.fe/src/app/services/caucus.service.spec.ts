import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { CaucusService } from './caucus.service';
import { UserService } from './user.service';
import { ApiService } from './api.service';
import { environment } from '../../environments/environment';

describe('CaucusService', () => {
  let service: CaucusService;
  let httpMock: HttpTestingController;
  const isPaidSignal = signal(true);

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        CaucusService,
        ApiService,
        {
          provide: UserService,
          useValue: { isPaid: isPaidSignal.asReadonly() },
        },
      ],
    });
    service = TestBed.inject(CaucusService);
    httpMock = TestBed.inject(HttpTestingController);
    isPaidSignal.set(true);
    const bootstrap = httpMock.match(`${environment.apiUrl}/caucus/me`);
    bootstrap.forEach((req) =>
      req.flush({ status: 'success', data: { status: 'NONE', membership: null, appeal: null } }),
    );
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('hides menu when membership status is NONE', async () => {
    const loadPromise = firstValueFrom(service.loadMe());
    const req = httpMock.expectOne(`${environment.apiUrl}/caucus/me`);
    req.flush({ status: 'success', data: { status: 'NONE', membership: null, appeal: null } });
    await loadPromise;
    expect(service.menuVisible()).toBe(false);
  });

  it('shows menu when membership status is ACTIVE', async () => {
    const loadPromise = firstValueFrom(service.loadMe());
    const req = httpMock.expectOne(`${environment.apiUrl}/caucus/me`);
    req.flush({
      status: 'success',
      data: {
        status: 'ACTIVE',
        membership: { activatedAt: '2026-10-20T18:00:00.000Z', deactivatedAt: null, reinstatedAt: null },
        appeal: null,
      },
    });
    await loadPromise;
    expect(service.menuVisible()).toBe(true);
  });

  it('hides menu on 404 from caucus/me', async () => {
    const loadPromise = firstValueFrom(service.loadMe());
    const req = httpMock.expectOne(`${environment.apiUrl}/caucus/me`);
    req.flush('Not found', { status: 404, statusText: 'Not Found' });
    await loadPromise;
    expect(service.menuVisible()).toBe(false);
  });

  it('hides menu when user is not paid', async () => {
    isPaidSignal.set(false);
    await firstValueFrom(service.loadMe());
    expect(service.menuVisible()).toBe(false);
    httpMock.expectNone(`${environment.apiUrl}/caucus/me`);
  });
});
