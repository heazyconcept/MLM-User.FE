import { Injectable, signal, inject } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { tap, switchMap, map, catchError } from 'rxjs/operators';
import { ApiService } from './api.service';
import { UserService, type PaymentStatus } from './user.service';
import { AuditService } from './audit.service';

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
}

export interface ImpersonationState {
  sessionId: string;
  adminId: string;
  adminUsername: string;
  targetUserId: string;
  targetUsername: string;
  expiresAt: string;
}

export interface ImpersonationExchangeResponse extends AuthResponse {
  impersonation: ImpersonationState;
}

export interface ImpersonationEndResponse {
  adminDashboardUrl: string;
}

function isImpersonationState(value: unknown): value is ImpersonationState {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record['sessionId'] === 'string' &&
    typeof record['adminId'] === 'string' &&
    typeof record['adminUsername'] === 'string' &&
    typeof record['targetUserId'] === 'string' &&
    typeof record['targetUsername'] === 'string' &&
    typeof record['expiresAt'] === 'string'
  );
}

export interface RegisterRequest {
  username: string;
  email?: string;
  password: string;
  package: string;
  currency: string;
  referralUsername?: string;
  placementParentUsername?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private api = inject(ApiService);
  private userService = inject(UserService);
  private audit = inject(AuditService);

  private readonly TOKEN_KEY = 'mlm_auth_token';
  private readonly REFRESH_TOKEN_KEY = 'mlm_refresh_token';
  private readonly IMPERSONATION_KEY = 'segulah_impersonation';

  isAuthenticated = signal<boolean>(this.hasToken());
  impersonation = signal<ImpersonationState | null>(this.getImpersonationFromStorage());

  private hasToken(): boolean {
    if (typeof window !== 'undefined' && window.localStorage) {
      return !!localStorage.getItem(this.TOKEN_KEY);
    }
    return false;
  }

  private storeTokens(response: AuthResponse): void {
    localStorage.setItem(this.TOKEN_KEY, response.accessToken);
    localStorage.setItem(this.REFRESH_TOKEN_KEY, response.refreshToken);
    this.isAuthenticated.set(true);
  }

  private clearTokens(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    this.isAuthenticated.set(false);
  }

  private getImpersonationFromStorage(): ImpersonationState | null {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = localStorage.getItem(this.IMPERSONATION_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as ImpersonationState;
    } catch {
      return null;
    }
  }

  private setImpersonationState(state: ImpersonationState | null): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (state) {
        localStorage.setItem(this.IMPERSONATION_KEY, JSON.stringify(state));
      } else {
        localStorage.removeItem(this.IMPERSONATION_KEY);
      }
    }
    this.impersonation.set(state);
  }

  getAccessToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  login(username: string, password: string): Observable<{ success: boolean; paymentStatus: PaymentStatus }> {
    const body: LoginRequest = { username, password };

    return this.api.post<AuthResponse>('auth/login', body).pipe(
      tap(tokens => this.storeTokens(tokens)),
      tap(() => this.setImpersonationState(null)),
      switchMap(() => this.userService.fetchProfile()),
      tap(user => this.audit.logAuthEvent('login', 'success', user.id || user.email)),
      map(user => ({
        success: true,
        paymentStatus: user.paymentStatus
      })),
      catchError(err => {
        this.clearTokens();
        this.audit.logAuthEvent('login', 'failure', username);
        return throwError(() => err);
      })
    );
  }

  register(data: RegisterRequest): Observable<boolean> {
    return this.api.post<AuthResponse>('auth/register', data).pipe(
      tap(() => this.userService.clearUser()),
      tap(tokens => this.storeTokens(tokens)),
      tap(() => this.setImpersonationState(null)),
      tap(() => this.audit.logAuthEvent('register', 'success', data.email ?? data.username)),
      map(() => true),
      catchError(err => {
        this.clearTokens();
        this.audit.logAuthEvent('register', 'failure', data.email ?? data.username);
        return throwError(() => err);
      })
    );
  }

  logout(): Observable<void> {
    const refreshToken = this.getRefreshToken();
    const userIdentifier = this.userService.currentUser()?.id ?? this.userService.currentUser()?.email ?? 'unknown';

    return this.api.post<void>('auth/logout', { refreshToken }).pipe(
      tap(() => {
        this.audit.logAuthEvent('logout', 'success', userIdentifier);
        this.clearTokens();
        this.setImpersonationState(null);
        this.userService.clearUser();
      }),
      catchError(err => {
        this.audit.logAuthEvent('logout', 'failure', userIdentifier);
        this.clearTokens();
        this.setImpersonationState(null);
        this.userService.clearUser();
        return throwError(() => err);
      })
    );
  }

  logoutLocal(): void {
    this.clearTokens();
    this.setImpersonationState(null);
    this.userService.clearUser();
  }

  refreshToken(): Observable<AuthResponse> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }

    return this.api.post<AuthResponse>('auth/refresh', { refreshToken }).pipe(
      tap(tokens => this.storeTokens(tokens))
    );
  }

  forgotPassword(email: string): Observable<void> {
    return this.api.post<void>('auth/forgot-password', { email });
  }

  resetPassword(token: string, newPassword: string): Observable<void> {
    return this.api.post<void>('auth/reset-password', { token, newPassword });
  }

  exchangeImpersonation(exchangeCode: string): Observable<ImpersonationExchangeResponse> {
    return this.api.post<ImpersonationExchangeResponse>('auth/impersonate/exchange', { exchangeCode }).pipe(
      tap(response => {
        this.storeTokens(response);
        this.setImpersonationState(response.impersonation);
      })
    );
  }

  loadImpersonationState(): Observable<ImpersonationState | null> {
    const existing = this.getImpersonationFromStorage();
    if (existing) {
      this.setImpersonationState(existing);
      return of(existing);
    }

    if (!this.getAccessToken()) {
      this.setImpersonationState(null);
      return of(null);
    }

    return this.api.get<Record<string, unknown>>('auth/impersonation').pipe(
      map((state) => (state['isImpersonating'] === false ? null : isImpersonationState(state) ? state : null)),
      tap((state) => this.setImpersonationState(state)),
      catchError(() => {
        this.setImpersonationState(null);
        return of(null);
      })
    );
  }

  endImpersonation(): Observable<ImpersonationEndResponse> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }

    return this.api.post<ImpersonationEndResponse>('auth/impersonate/end', { refreshToken }).pipe(
      tap(() => {
        this.clearTokens();
        this.setImpersonationState(null);
        this.userService.clearUser();
      })
    );
  }
}
