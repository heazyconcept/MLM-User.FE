import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { ApiService } from './api.service';

export interface ValidateReferralResponse {
  valid: boolean;
  sponsorName?: string;
}

export interface ReferralInfo {
  referralCode: string;
  referrerName?: string;
  referrerEmail?: string;
}

export interface SponsorInfo {
  id?: string;
  name?: string;
  email?: string;
  referralCode?: string;
}

export interface DownlineItem {
  id: string;
  username: string;
  fullName: string;
  joinDate: Date;
  status: 'active' | 'inactive';
  level: number;
  package: string;
  totalDirects: number;
  teamSize: number;
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

  getReferralInfo(): Observable<ReferralInfo> {
    return this.api.get<Record<string, unknown>>('users/me/referral').pipe(
      map((res) => ({
        referralCode: String(res['referralCode'] ?? res['referral_code'] ?? ''),
        referrerName: (res['referrerName'] ?? res['referrer_name']) as string | undefined,
        referrerEmail: (res['referrerEmail'] ?? res['referrer_email']) as string | undefined
      })),
      catchError(() => of({ referralCode: '' }))
    );
  }

  getDownlines(depth?: number): Observable<DownlineItem[]> {
    const params = depth != null ? { depth: String(depth) } : undefined;
    return this.api
      .get<Record<string, unknown>[] | Record<string, unknown>>(
        'referrals/me/downlines',
        params
      )
      .pipe(
        map((res) => {
          const arr = Array.isArray(res)
            ? res
            : (res['data'] ?? res['items'] ?? res['downlines'] ?? []) as Record<string, unknown>[];
          return arr.map((raw) => this.mapDownlineItem(raw));
        }),
        catchError(() => of([]))
      );
  }

  getSponsor(): Observable<SponsorInfo | null> {
    return this.api.get<Record<string, unknown>>('referrals/me/sponsor').pipe(
      map((res) => {
        if (!res || (res['id'] == null && res['email'] == null)) return null;
        const firstName = res['firstName'] ?? res['first_name'] ?? '';
        const lastName = res['lastName'] ?? res['last_name'] ?? '';
        const name = [firstName, lastName].filter(Boolean).join(' ') || (res['name'] as string) || (res['email'] as string);
        return {
          id: res['id'] as string | undefined,
          name: name || undefined,
          email: (res['email'] ?? res['referrerEmail'] ?? res['referrer_email']) as string | undefined,
          referralCode: (res['referralCode'] ?? res['referral_code']) as string | undefined
        };
      }),
      catchError(() => of(null))
    );
  }

  getUpline(): Observable<Record<string, unknown> | null> {
    return this.api.get<Record<string, unknown>>('referrals/me/upline').pipe(
      map((res) => (res && Object.keys(res).length > 0 ? res : null)),
      catchError(() => of(null))
    );
  }

  getPlacement(): Observable<Record<string, unknown> | null> {
    return this.api.get<Record<string, unknown>>('referrals/me/placement').pipe(
      map((res) => (res && Object.keys(res).length > 0 ? res : null)),
      catchError(() => of(null))
    );
  }

  private mapDownlineItem(raw: Record<string, unknown>): DownlineItem {
    const reg = raw['registration'] as Record<string, unknown> | undefined;
    const firstName = String(raw['firstName'] ?? raw['first_name'] ?? '');
    const lastName = String(raw['lastName'] ?? raw['last_name'] ?? '');
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || String(raw['fullName'] ?? raw['name'] ?? raw['email'] ?? '—');
    const joinedAt = raw['joinedAt'] ?? raw['createdAt'] ?? raw['registeredAt'] ?? raw['created_at'] ?? Date.now();
    const joinDate = (() => {
      const d = typeof joinedAt === 'number' ? new Date(joinedAt) : new Date(String(joinedAt));
      return isNaN(d.getTime()) ? new Date() : d;
    })();
    const isActive = raw['isActive'] ?? raw['is_active'] ?? raw['status'] !== 'inactive';
    return {
      id: String(raw['id'] ?? raw['userId'] ?? raw['user_id'] ?? ''),
      username: String(raw['username'] ?? raw['email'] ?? raw['referralCode'] ?? raw['referral_code'] ?? '—'),
      fullName,
      joinDate,
      status: (isActive ? 'active' : 'inactive') as 'active' | 'inactive',
      level: Number(raw['level'] ?? raw['depth'] ?? 1),
      package: String(raw['package'] ?? reg?.['package'] ?? '—'),
      totalDirects: Number(raw['directReferrals'] ?? raw['direct_referrals'] ?? raw['directReferralsCount'] ?? 0),
      teamSize: Number(raw['teamSize'] ?? raw['team_size'] ?? raw['downlineCount'] ?? raw['downline_count'] ?? 0)
    };
  }
}
