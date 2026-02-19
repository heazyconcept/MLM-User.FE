import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { ApiService } from './api.service';

export interface ValidateReferralResponse {
  valid: boolean;
  sponsorName?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ReferralService {
  private api = inject(ApiService);

  validateReferralCode(code: string): Observable<ValidateReferralResponse> {
    if (!code?.trim()) {
      return of({ valid: false });
    }
    return this.api
      .post<Record<string, unknown>>('referrals/validate', {
        referralCode: code.trim()
      })
      .pipe(
        map((res) => ({
          valid: res['valid'] === true || res['success'] === true,
          sponsorName: (res['sponsorName'] ?? res['sponsor_name']) as string | undefined
        })),
        catchError(() => of({ valid: false }))
      );
  }
}
