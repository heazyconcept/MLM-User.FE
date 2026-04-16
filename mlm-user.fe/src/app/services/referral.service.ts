import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { ApiService } from './api.service';

// ── Interfaces ──────────────────────────────────────────────────────

export interface ValidateReferralResponse {
  valid: boolean;
  uplineUserId?: string;
}

export interface ReferralInfo {
  referralUsername: string;
  referrerName?: string;
  referrerEmail?: string | null;
}

export interface SponsorInfo {
  sponsorId?: string;
  sponsorEmail?: string;
  sponsorReferralCode?: string;
  sponsorLevel?: number;
}

export interface UplineNode {
  userId: string;
  level: number;
}

export interface PlacementInfo {
  placementParentId: string;
  placementParentEmail: string;
  placementParentReferralCode: string;
  placementLevel: number;
  placementStage: number;
  placementStageName: string;
}

export interface PlacementParent {
  userId: string;
  username: string;
  email?: string;
}

export interface DownlineItem {
  id: string;
  username: string;
  fullName: string;
  email?: string;
  joinDate: Date;
  status: 'active' | 'inactive';
  level: number;
  package: string;
  totalDirects: number;
  teamSize: number;
  rank?: string;
  stage?: string;
  profilePhotoUrl?: string;
}

export interface CreateReferralRequest {
  email?: string;
  username: string;
  password: string;
  package: string;
  currency: string;
  placementParentUserId?: string;
}

export interface CreateReferralResponse {
  userId: string;
  email?: string;
}

// ── Service ─────────────────────────────────────────────────────────

@Injectable({
  providedIn: 'root'
})
export class ReferralService {
  private api = inject(ApiService);

  /** POST /referrals/validate */
  validateReferralUsername(username: string): Observable<ValidateReferralResponse> {
    if (!username?.trim()) {
      return of({ valid: false });
    }
    return this.api
      .post<Record<string, unknown>>('referrals/validate', {
        referralUsername: username.trim()
      })
      .pipe(
        map((res) => ({
          valid: res['valid'] === true,
          uplineUserId: res['uplineUserId'] as string | undefined
        })),
        catchError(() => of({ valid: false }))
      );
  }

  /** GET /users/me/referral – fetch current referral username & referrer info */
  getReferralInfo(): Observable<ReferralInfo> {
    return this.api.get<Record<string, unknown>>('users/me/referral').pipe(
      map((res) => ({
        referralUsername: String(
          res['referralUsername'] ??
          res['referral_username'] ??
          res['username'] ??
          ''
        ).trim(),
        referrerName: (res['referrerName'] ?? res['referrer_name']) as string | undefined,
        referrerEmail: (res['referrerEmail'] ?? res['referrer_email']) as string | null | undefined
      })),
      catchError(() => of({ referralUsername: '' }))
    );
  }

  /** GET /referrals/me/downlines */
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

  /** GET /referrals/me/sponsor */
  getSponsor(): Observable<SponsorInfo | null> {
    return this.api.get<Record<string, unknown> | null>('referrals/me/sponsor').pipe(
      map((res) => {
        if (!res) return null;
        // API returns sponsorId, sponsorEmail, sponsorReferralCode, sponsorLevel
        const sponsorId = (res['sponsorId'] ?? res['sponsor_id']) as string | undefined;
        const sponsorEmail = (res['sponsorEmail'] ?? res['sponsor_email'] ?? res['email']) as string | undefined;
        if (!sponsorId && !sponsorEmail) return null;
        return {
          sponsorId,
          sponsorEmail,
          sponsorReferralCode: (res['sponsorReferralCode'] ?? res['sponsor_referral_code'] ?? res['referralCode']) as string | undefined,
          sponsorLevel: res['sponsorLevel'] != null ? Number(res['sponsorLevel']) : undefined
        };
      }),
      catchError(() => of(null))
    );
  }

  /** GET /referrals/me/upline */
  getUpline(): Observable<UplineNode[]> {
    return this.api.get<Record<string, unknown>[] | Record<string, unknown>>('referrals/me/upline').pipe(
      map((res) => {
        const arr = Array.isArray(res) ? res : [];
        return arr.map((item) => ({
          userId: String(item['userId'] ?? item['user_id'] ?? ''),
          level: Number(item['level'] ?? 0)
        }));
      }),
      catchError(() => of([]))
    );
  }

  /** GET /referrals/me/placement */
  getPlacement(): Observable<PlacementInfo | null> {
    return this.api.get<Record<string, unknown> | null>('referrals/me/placement').pipe(
      map((res) => {
        if (!res) return null;
        const parentId = (res['placementParentId'] ?? res['placement_parent_id']) as string | undefined;
        if (!parentId) return null;
        return {
          placementParentId: String(parentId),
          placementParentEmail: String(res['placementParentEmail'] ?? res['placement_parent_email'] ?? ''),
          placementParentReferralCode: String(res['placementParentReferralCode'] ?? res['placement_parent_referral_code'] ?? ''),
          placementLevel: Number(res['placementLevel'] ?? res['placement_level'] ?? 0),
          placementStage: Number(res['placementStage'] ?? res['placement_stage'] ?? 0),
          placementStageName: String(res['placementStageName'] ?? res['placement_stage_name'] ?? '')
        };
      }),
      catchError(() => of(null))
    );
  }

  /** GET /referrals/placement-parents */
  getPlacementParents(): Observable<PlacementParent[]> {
    return this.api.get<Record<string, unknown>[] | Record<string, unknown>>('referrals/placement-parents').pipe(
      map((res) => {
        const arr = Array.isArray(res) ? res : [];
        return arr.map((item) => ({
          userId: String(item['userId'] ?? item['user_id'] ?? ''),
          username: String(item['username'] ?? ''),
          email: (item['email'] as string | undefined) ?? undefined
        }));
      }),
      catchError(() => of([]))
    );
  }

  /** POST /referrals/create */
  createReferral(request: CreateReferralRequest): Observable<CreateReferralResponse> {
    const body: Record<string, unknown> = {
      username: request.username,
      password: request.password,
      package: request.package,
      currency: request.currency
    };
    if (request.email?.trim()) {
      body['email'] = request.email.trim();
    }
    if (request.placementParentUserId) {
      body['placementParentUserId'] = request.placementParentUserId;
    }
    return this.api.post<Record<string, unknown>>('referrals/create', body).pipe(
      map((res) => ({
        userId: String(res['userId'] ?? res['user_id'] ?? ''),
        email: (res['email'] as string | undefined) ?? request.email
      }))
    );
  }

  // ── Private helpers ───────────────────────────────────────────────

  private mapDownlineItem(raw: Record<string, unknown>): DownlineItem {
    const firstName = String(raw['firstName'] ?? raw['first_name'] ?? '');
    const lastName = String(raw['lastName'] ?? raw['last_name'] ?? '');
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || String(raw['fullName'] ?? raw['name'] ?? raw['email'] ?? '—');
    const joinedAt = raw['createdAt'] ?? raw['joinedAt'] ?? raw['registeredAt'] ?? raw['created_at'] ?? Date.now();
    const joinDate = (() => {
      const d = typeof joinedAt === 'number' ? new Date(joinedAt) : new Date(String(joinedAt));
      return isNaN(d.getTime()) ? new Date() : d;
    })();
    const isActive = raw['isActive'] ?? raw['is_active'] ?? raw['status'] !== 'inactive';
    return {
      id: String(raw['id'] ?? raw['userId'] ?? raw['user_id'] ?? ''),
      username: String(raw['username'] ?? raw['email'] ?? '—'),
      email: (raw['email'] as string | undefined) ?? undefined,
      fullName,
      joinDate,
      status: (isActive ? 'active' : 'inactive') as 'active' | 'inactive',
      level: Number(raw['level'] ?? raw['depth'] ?? 1),
      package: String(raw['package'] ?? '—'),
      totalDirects: Number(raw['directReferrals'] ?? raw['direct_referrals'] ?? raw['directReferralsCount'] ?? 0),
      teamSize: Number(raw['teamSize'] ?? raw['team_size'] ?? raw['downlineCount'] ?? raw['downline_count'] ?? 0),
      rank: (raw['rank'] as string | undefined) ?? undefined,
      stage: (raw['stage'] as string | undefined) ?? undefined,
      profilePhotoUrl: raw['profilePhotoUrl'] as string | undefined
    };
  }
}
