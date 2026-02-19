import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { components } from '../core/api-types';
import { ApiService } from './api.service';

type UpdateProfileDto = components['schemas']['UpdateProfileDto'];
type UpdateBankDetailsDto = components['schemas']['UpdateBankDetailsDto'];
type UpdateUserPreferencesDto = components['schemas']['UpdateUserPreferencesDto'];

@Injectable({
  providedIn: 'root'
})
export class OnboardingService {
  private api = inject(ApiService);

  updateProfile(body: UpdateProfileDto): Observable<unknown> {
    return this.api.put('users/me', body);
  }

  uploadProfilePhoto(file: File): Observable<unknown> {
    const formData = new FormData();
    formData.append('photo', file, file.name);
    return this.api.post('users/me/photo', formData);
  }

  getIdentity(): Observable<Record<string, unknown>> {
    return this.api.get<Record<string, unknown>>('users/me/identity');
  }

  submitIdentity(formData: FormData): Observable<unknown> {
    return this.api.post('users/me/identity', formData);
  }

  getBankDetails(): Observable<Record<string, unknown>> {
    return this.api.get<Record<string, unknown>>('users/me/bank');
  }

  updateBankDetails(body: UpdateBankDetailsDto): Observable<unknown> {
    return this.api.put('users/me/bank', body);
  }

  getPreferences(): Observable<Record<string, unknown>> {
    return this.api.get<Record<string, unknown>>('users/me/preferences');
  }

  updatePreferences(body: UpdateUserPreferencesDto): Observable<unknown> {
    return this.api.put('users/me/preferences', body);
  }
}
