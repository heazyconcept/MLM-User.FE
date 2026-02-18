import { Injectable, signal, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { tap, switchMap, map, catchError } from 'rxjs/operators';
import { ApiService } from './api.service';
import { UserService, type User, type PaymentStatus } from './user.service';

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  package: string;
  currency: string;
  referralCode?: string;
}

export interface LoginRequest {
  email: string;
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

  private readonly TOKEN_KEY = 'mlm_auth_token';
  private readonly REFRESH_TOKEN_KEY = 'mlm_refresh_token';

  isAuthenticated = signal<boolean>(this.hasToken());

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

  getAccessToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  login(email: string, password: string): Observable<{ success: boolean; paymentStatus: PaymentStatus }> {
    const body: LoginRequest = { email, password };

    return this.api.post<AuthResponse>('auth/login', body).pipe(
      tap(tokens => this.storeTokens(tokens)),
      switchMap(() => this.userService.fetchProfile()),
      map(user => ({
        success: true,
        paymentStatus: user.paymentStatus
      })),
      catchError(err => {
        this.clearTokens();
        return throwError(() => err);
      })
    );
  }

  register(data: RegisterRequest): Observable<boolean> {
    return this.api.post<AuthResponse>('auth/register', data).pipe(
      tap(tokens => this.storeTokens(tokens)),
      map(() => true),
      catchError(err => {
        this.clearTokens();
        return throwError(() => err);
      })
    );
  }

  logout(): Observable<void> {
    const refreshToken = this.getRefreshToken();

    return this.api.post<void>('auth/logout', { refreshToken }).pipe(
      tap(() => {
        this.clearTokens();
        this.userService.clearUser();
      }),
      catchError(err => {
        this.clearTokens();
        this.userService.clearUser();
        return throwError(() => err);
      })
    );
  }

  logoutLocal(): void {
    this.clearTokens();
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
}
