import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, tap } from 'rxjs';

import { ApiService } from './api.service';

export interface GeographyCountry {
  code: string;
  name: string;
}

export interface GeographySubdivision {
  code: string;
  name: string;
}

type GeographyApiRow = Record<string, unknown>;
type GeographyListResponse = GeographyApiRow[] | Record<string, unknown>;

@Injectable({ providedIn: 'root' })
export class GeographyService {
  private api = inject(ApiService);
  private countriesSignal = signal<GeographyCountry[]>([]);
  private subdivisionsByCountry = new Map<string, GeographySubdivision[]>();

  readonly countries = this.countriesSignal.asReadonly();
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  fetchCountries(): Observable<GeographyCountry[]> {
    const cached = this.countriesSignal();
    if (cached.length > 0) return of(cached);

    this.loading.set(true);
    this.error.set(null);
    return this.api.get<GeographyListResponse>('geography/countries').pipe(
      map((response) => this.extractRows(response, 'countries')),
      map((rows) =>
        rows
          .map((row) => ({
            code: String(row['code'] ?? row['countryCode'] ?? row['country_code'] ?? ''),
            name: String(row['name'] ?? row['countryName'] ?? row['country_name'] ?? ''),
          }))
          .filter((country) => country.code && country.name),
      ),
      tap((countries) => {
        this.countriesSignal.set(countries);
        this.loading.set(false);
      }),
      catchError(() => {
        this.error.set('Could not load countries.');
        this.loading.set(false);
        return of([]);
      }),
    );
  }

  fetchSubdivisions(countryCode: string): Observable<GeographySubdivision[]> {
    const code = countryCode.trim().toUpperCase();
    if (!code) return of([]);

    const cached = this.subdivisionsByCountry.get(code);
    if (cached) return of(cached);

    this.loading.set(true);
    this.error.set(null);
    return this.api.get<GeographyListResponse>(`geography/countries/${code}/subdivisions`).pipe(
      map((response) => this.extractRows(response, 'subdivisions')),
      map((rows) =>
        rows
          .map((row) => ({
            code: String(row['code'] ?? row['subdivisionCode'] ?? row['subdivision_code'] ?? ''),
            name: String(row['name'] ?? row['subdivisionName'] ?? row['subdivision_name'] ?? ''),
          }))
          .filter((subdivision) => subdivision.code && subdivision.name),
      ),
      tap((subdivisions) => {
        this.subdivisionsByCountry.set(code, subdivisions);
        this.loading.set(false);
      }),
      catchError(() => {
        this.error.set('Could not load states or regions.');
        this.loading.set(false);
        return of([]);
      }),
    );
  }

  private extractRows(response: GeographyListResponse, key: string): GeographyApiRow[] {
    if (Array.isArray(response)) return response;
    const rows = response[key] ?? response['data'];
    return Array.isArray(rows) ? (rows as GeographyApiRow[]) : [];
  }
}
