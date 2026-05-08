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

export type PlacementValidationReason = 'USER_NOT_FOUND' | 'NOT_IN_DOWNLINE' | 'MATRIX_FULL' | 'SPONSOR_NOT_FOUND';

export interface ValidatePlacementResponse {
  valid: boolean;
  userId?: string;
  username?: string;
  directChildrenCount?: number;
  matrixWidth?: number;
  reason?: PlacementValidationReason;
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
  isDirectReferral: boolean;
}

export interface CreateReferralRequest {
  email?: string;
  username: string;
  password: string;
  package: string;
  currency: string;
  placementParentUsername?: string;
  referralUsername?: string;
}

export interface CreateReferralResponse {
  userId: string;
  email?: string;
}

export interface ReferralStats {
  teamSize: number;
  totalDirectReferrals: number;
  totalLeaders: number;
  isLeader: boolean;
}

export interface DirectReferralItem {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  package: string;
  isActive: boolean;
  isRegistrationPaid: boolean;
  createdAt: string;
  profilePhotoUrl?: string;
}

export interface MatrixLevelUser {
  id: string;
  username: string;
  email?: string | null;
  phone?: string | null;
  joinDate: string;
  status: 'ACTIVE' | 'UNPAID' | 'SUSPENDED' | string;
  isDirectReferral: boolean;
  profilePhotoUrl?: string | null;
  level?: number | null;
  stage?: string | number | null;
}

export interface MatrixTreeUser {
  userId: string;
  username: string;
  email?: string | null;
  phone?: string | null;
  isActive?: boolean | null;
  isRegistrationPaid?: boolean | null;
  createdAt?: string | null;
  relativeLevel?: number | null;
  parentUsername?: string | null;
  stageLabel?: string | null;
  rank?: string | null;
}

export interface MatrixTreeLevel {
  level: number;
  users: MatrixTreeUser[];
}

export interface MatrixTreeResponse {
  rootUserId?: string | null;
  rootUsername?: string | null;
  depth?: number | null;
  totalUsers?: number | null;
  levels?: MatrixTreeLevel[];
}

export interface MatrixLevelPagination {
  totalRecords: number;
  currentOffset: number;
  limit: number;
  hasNext: boolean;
}

export interface MatrixLevelResponse {
  status: 'success' | 'error';
  data: {
    levelRequested: number;
    pagination: MatrixLevelPagination;
    users: MatrixLevelUser[];
  };
}

export interface MatrixLevelQuery {
  level: number;
  limit?: number;
  offset?: number;
  search?: string;
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

  /** POST /referrals/validate-placement */
  validatePlacementUsername(placementUsername: string, referralUsername?: string): Observable<ValidatePlacementResponse> {
    if (!placementUsername?.trim()) {
      return of({ valid: false });
    }
    
    const body: Record<string, unknown> = {
      placementUsername: placementUsername.trim()
    };
    
    if (referralUsername?.trim()) {
      body['referralUsername'] = referralUsername.trim();
    }
    
    return this.api
      .post<Record<string, unknown>>('referrals/validate-placement', body)
      .pipe(
        map((res) => ({
          valid: res['valid'] === true,
          userId: res['userId'] as string | undefined,
          username: res['username'] as string | undefined,
          directChildrenCount: res['directChildrenCount'] as number | undefined,
          matrixWidth: res['matrixWidth'] as number | undefined,
          reason: res['reason'] as PlacementValidationReason | undefined
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
        map((res) => this.mapDownlinesResponse(res)),
        catchError(() => {
          if (depth == null) return of([]);
          return this.api
            .get<Record<string, unknown>[] | Record<string, unknown>>('referrals/me/downlines')
            .pipe(
              map((res) => this.mapDownlinesResponse(res)),
              catchError(() => of([]))
            );
        })
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
    if (request.placementParentUsername) {
      body['placementParentUsername'] = request.placementParentUsername;
    }
    if (request.referralUsername) {
      body['referralUsername'] = request.referralUsername;
    }
    return this.api.post<Record<string, unknown>>('referrals/create', body).pipe(
      map((res) => ({
        userId: String(res['userId'] ?? res['user_id'] ?? ''),
        email: (res['email'] as string | undefined) ?? request.email
      }))
    );
  }

  /** GET /referrals/me/direct-referrals */
  getDirectReferrals(limit = 50, offset = 0): Observable<DirectReferralItem[]> {
    return this.api
      .get<Record<string, unknown>[] | Record<string, unknown>>(
        'referrals/me/direct-referrals',
        { limit: String(limit), offset: String(offset) }
      )
      .pipe(
        map((res) => {
          const arr = Array.isArray(res)
            ? res
            : (res['data'] ?? res['items'] ?? []) as Record<string, unknown>[];
          return arr.map((raw) => ({
            id: String(raw['id'] ?? ''),
            username: String(raw['username'] ?? ''),
            email: String(raw['email'] ?? ''),
            firstName: String(raw['firstName'] ?? ''),
            lastName: String(raw['lastName'] ?? ''),
            package: String(raw['package'] ?? ''),
            isActive: (raw['isActive'] ?? false) as boolean,
            isRegistrationPaid: (raw['isRegistrationPaid'] ?? false) as boolean,
            createdAt: String(raw['createdAt'] ?? ''),
            profilePhotoUrl: raw['profilePhotoUrl'] as string | undefined
          }));
        }),
        catchError(() => of([]))
      );
  }

  /** GET /referrals/me/matrix-level */
  getMatrixLevelUsers(query: MatrixLevelQuery): Observable<MatrixLevelResponse> {
    const level = this.clampNumber(query.level, 1, 13, 1);
    const limit = this.clampNumber(query.limit ?? 20, 1, 200, 20);
    const offset = this.clampNumber(query.offset ?? 0, 0, Number.MAX_SAFE_INTEGER, 0);
    const search = query.search?.trim() ?? '';

    const page = Math.floor(offset / limit) + 1;

    const params: Record<string, string | number> = {
      level,
      page,
      limit
    };

    if (search) {
      params['search'] = search;
    }

    return this.api
      .get<Record<string, unknown> | Record<string, unknown>[]>('referrals/me/matrix-level', params)
      .pipe(
        map((res) => this.normalizeMatrixLevelResponse(res, level, limit, offset)),
        catchError((error) => {
          if (error?.status === 404) {
            const networkParams: Record<string, string | number> = {
              level,
              page,
              limit
            };
            if (search) {
              networkParams['search'] = search;
            }
            return this.api
              .get<Record<string, unknown> | Record<string, unknown>[]>('network/levels', networkParams)
              .pipe(
                map((res) => this.normalizeMatrixLevelResponse(res, level, limit, offset)),
                catchError(() =>
                  this.getDownlines().pipe(
                    map((downlines) => this.buildMatrixLevelFallback(downlines, level, limit, offset, search))
                  )
                )
              );
          }

          return this.getDownlines().pipe(
            map((downlines) => this.buildMatrixLevelFallback(downlines, level, limit, offset, search))
          );
        })
      );
  }

  /** GET /referrals/me/matrix */
  getMatrixTree(username?: string): Observable<MatrixTreeResponse> {
    const params = username?.trim() ? { username: username.trim() } : undefined;
    return this.api
      .get<Record<string, unknown> | null>('referrals/me/matrix', params)
      .pipe(
        map((res) => {
          if (!res) return { levels: [] } as MatrixTreeResponse;
          const levelsRaw = (res['levels'] ?? []) as Record<string, unknown>[];
          const levels = levelsRaw.map((level) => {
            const usersRaw = (level['users'] ?? []) as Record<string, unknown>[];
            const users = usersRaw.map((user) => ({
              userId: String(user['userId'] ?? user['id'] ?? ''),
              username: String(user['username'] ?? ''),
              email: (user['email'] as string | null | undefined) ?? null,
              phone: (user['phone'] as string | null | undefined) ?? null,
              isActive: (user['isActive'] as boolean | null | undefined) ?? null,
              isRegistrationPaid: (user['isRegistrationPaid'] as boolean | null | undefined) ?? null,
              createdAt: (user['createdAt'] as string | null | undefined) ?? null,
              relativeLevel: (user['relativeLevel'] as number | null | undefined) ?? null,
              parentUsername: (user['parentUsername'] as string | null | undefined) ?? null,
              stageLabel: (user['stageLabel'] as string | null | undefined) ?? null,
              rank: (user['rank'] as string | null | undefined) ?? null
            }));
            return {
              level: Number(level['level'] ?? 0),
              users
            };
          });

          return {
            rootUserId: (res['rootUserId'] as string | null | undefined) ?? null,
            rootUsername: (res['rootUsername'] as string | null | undefined) ?? null,
            depth: (res['depth'] as number | null | undefined) ?? null,
            totalUsers: (res['totalUsers'] as number | null | undefined) ?? null,
            levels
          } as MatrixTreeResponse;
        }),
        catchError(() => of({ levels: [] } as MatrixTreeResponse))
      );
  }

  /** GET /referrals/me/stats */
  getReferralStats(): Observable<ReferralStats> {
    return this.api.get<Record<string, unknown>>('referrals/me/stats').pipe(
      map((res) => ({
        teamSize: Number(res['teamSize'] ?? 0),
        totalDirectReferrals: Number(res['totalDirectReferrals'] ?? 0),
        totalLeaders: Number(res['totalLeaders'] ?? 0),
        isLeader: (res['isLeader'] ?? false) as boolean
      })),
      catchError(() => of({
        teamSize: 0,
        totalDirectReferrals: 0,
        totalLeaders: 0,
        isLeader: false
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
      profilePhotoUrl: raw['profilePhotoUrl'] as string | undefined,
      isDirectReferral: (raw['isDirectReferral'] ?? raw['is_direct_referral'] ?? false) as boolean
    };
  }

  private mapDownlinesResponse(
    res: Record<string, unknown>[] | Record<string, unknown>
  ): DownlineItem[] {
    const arr = Array.isArray(res)
      ? res
      : (res['data'] ?? res['items'] ?? res['downlines'] ?? []) as Record<string, unknown>[];
    return arr.map((raw) => this.mapDownlineItem(raw));
  }

  private normalizeMatrixLevelResponse(
    raw: Record<string, unknown> | Record<string, unknown>[],
    level: number,
    limit: number,
    offset: number
  ): MatrixLevelResponse {
    const data = Array.isArray(raw) ? { users: raw } : (raw['data'] as Record<string, unknown> | undefined) ?? raw;
    const usersSource = Array.isArray(data)
      ? data
      : (data['users'] ?? data['items'] ?? data['data'] ?? data['downlines'] ?? []) as Record<string, unknown>[];
    const users = usersSource.map((item) => this.mapMatrixLevelUser(item));

    const paginationSource = !Array.isArray(data) ? (data['pagination'] as Record<string, unknown> | undefined) : undefined;
    const currentLimit = this.readNumber(
      paginationSource?.['limit'] ?? data['limit'] ?? limit,
      limit
    );
    const currentPage = this.readNumber(
      paginationSource?.['currentPage'] ?? data['currentPage'] ?? 0,
      0
    );
    const totalPages = this.readNumber(
      paginationSource?.['totalPages'] ?? data['totalPages'] ?? 0,
      0
    );
    const totalRecords = this.readNumber(
      paginationSource?.['totalRecords']
        ?? data['totalRecords']
        ?? data['total_records']
        ?? (totalPages > 0 ? totalPages * currentLimit : users.length),
      users.length
    );
    const offsetFromPage = currentPage > 0 ? (currentPage - 1) * currentLimit : undefined;
    const currentOffsetCandidate = paginationSource?.['currentOffset']
      ?? paginationSource?.['offset']
      ?? data['currentOffset']
      ?? offsetFromPage
      ?? offset;
    const currentOffset = this.readNumber(currentOffsetCandidate, offset);
    const hasNextValue = paginationSource?.['hasNext']
      ?? paginationSource?.['hasNextPage']
      ?? data['hasNext']
      ?? data['hasNextPage'];
    const hasNext = hasNextValue != null
      ? Boolean(hasNextValue)
      : (totalPages > 0 && currentPage > 0)
        ? currentPage < totalPages
        : currentOffset + users.length < totalRecords;

    return {
      status: 'success',
      data: {
        levelRequested: level,
        pagination: {
          totalRecords,
          currentOffset,
          limit: currentLimit,
          hasNext
        },
        users
      }
    };
  }

  private buildMatrixLevelFallback(
    downlines: DownlineItem[],
    level: number,
    limit: number,
    offset: number,
    search: string
  ): MatrixLevelResponse {
    const normalizedSearch = search.trim().toLowerCase();
    const filtered = downlines.filter((item) => {
      if (item.level !== level) return false;
      if (!normalizedSearch) return true;
      return [item.username, item.email ?? '', item.fullName ?? '']
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch);
    });

    const page = filtered.slice(offset, offset + limit);

    return {
      status: 'success',
      data: {
        levelRequested: level,
        pagination: {
          totalRecords: filtered.length,
          currentOffset: offset,
          limit,
          hasNext: offset + limit < filtered.length
        },
        users: page.map((item) => this.mapMatrixLevelFallbackUser(item))
      }
    };
  }

  private mapMatrixLevelUser(raw: Record<string, unknown>): MatrixLevelUser {
    return {
      id: String(raw['id'] ?? raw['userId'] ?? raw['user_id'] ?? ''),
      username: String(raw['username'] ?? raw['name'] ?? raw['fullName'] ?? raw['email'] ?? '—'),
      email: (raw['email'] as string | undefined) ?? null,
      phone: (raw['phone'] as string | undefined) ?? (raw['phoneNumber'] as string | undefined) ?? null,
      joinDate: String(raw['joinDate'] ?? raw['createdAt'] ?? raw['created_at'] ?? raw['registeredAt'] ?? new Date().toISOString()),
      status: String(raw['status'] ?? (raw['isActive'] ?? raw['is_active'] ? 'ACTIVE' : 'UNPAID')),
      isDirectReferral: (raw['isDirectReferral'] ?? raw['is_direct_referral'] ?? false) as boolean,
      profilePhotoUrl: (raw['profilePhotoUrl'] as string | undefined) ?? (raw['profile_photo_url'] as string | undefined) ?? null,
      level: raw['level'] != null
        ? Number(raw['level'])
        : raw['matrixLevel'] != null
          ? Number(raw['matrixLevel'])
          : raw['matrix_level'] != null
            ? Number(raw['matrix_level'])
            : raw['depth'] != null
              ? Number(raw['depth'])
              : null,
      stage: (raw['stageName'] ?? raw['stage'] ?? raw['stage_name']) as string | number | null
    };
  }

  private mapMatrixLevelFallbackUser(item: DownlineItem): MatrixLevelUser {
    return {
      id: item.id,
      username: item.username,
      email: item.email ?? null,
      phone: null,
      joinDate: item.joinDate.toISOString(),
      status: item.status === 'active' ? 'ACTIVE' : 'UNPAID',
      isDirectReferral: item.isDirectReferral,
      profilePhotoUrl: null,
      level: item.level,
      stage: item.stage ?? null
    };
  }

  private clampNumber(value: number, min: number, max: number, fallback: number): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(max, Math.max(min, Math.trunc(numeric)));
  }

  private readNumber(value: unknown, fallback: number): number {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }
}
