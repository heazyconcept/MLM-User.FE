import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { environment } from '../../environments/environment';
import { ApiService } from './api.service';
import { GeographyService } from './geography.service';

describe('GeographyService', () => {
  let service: GeographyService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ApiService, GeographyService],
    });
    service = TestBed.inject(GeographyService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('loads and caches canonical countries', () => {
    const results: unknown[] = [];
    service.fetchCountries().subscribe((countries) => results.push(countries));

    const request = httpMock.expectOne(`${environment.apiUrl}/geography/countries`);
    expect(request.request.method).toBe('GET');
    request.flush({
      countries: [
        { countryCode: 'NG', countryName: 'Nigeria' },
        { code: 'GH', name: 'Ghana' },
      ],
    });

    service.fetchCountries().subscribe((countries) => results.push(countries));
    httpMock.expectNone(`${environment.apiUrl}/geography/countries`);

    expect(results).toEqual([
      [
        { code: 'NG', name: 'Nigeria' },
        { code: 'GH', name: 'Ghana' },
      ],
      [
        { code: 'NG', name: 'Nigeria' },
        { code: 'GH', name: 'Ghana' },
      ],
    ]);
  });

  it('loads and caches subdivisions per country', () => {
    service.fetchSubdivisions('ng').subscribe();

    const request = httpMock.expectOne(`${environment.apiUrl}/geography/countries/NG/subdivisions`);
    request.flush({
      subdivisions: [
        { subdivisionCode: 'LA', subdivisionName: 'Lagos' },
        { code: 'FC', name: 'Federal Capital Territory' },
      ],
    });

    let cached: unknown;
    service.fetchSubdivisions('NG').subscribe((value) => (cached = value));
    httpMock.expectNone(`${environment.apiUrl}/geography/countries/NG/subdivisions`);

    expect(cached).toEqual([
      { code: 'LA', name: 'Lagos' },
      { code: 'FC', name: 'Federal Capital Territory' },
    ]);
  });

  it('returns an empty list and exposes an error when geography loading fails', () => {
    let result: unknown;
    service.fetchCountries().subscribe((countries) => (result = countries));

    httpMock
      .expectOne(`${environment.apiUrl}/geography/countries`)
      .flush({ message: 'Unavailable' }, { status: 503, statusText: 'Unavailable' });

    expect(result).toEqual([]);
    expect(service.error()).toBe('Could not load countries.');
  });
});
