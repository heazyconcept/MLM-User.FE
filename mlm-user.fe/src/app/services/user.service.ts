import { Injectable, signal, computed, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { tap, map, catchError, switchMap } from 'rxjs/operators';
import { ApiService } from './api.service';

export type PaymentStatus = 'UNPAID' | 'PAID';
export type KycStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface User {
  id: string;
  username?: string;
  email: string;
  firstName: string;
  lastName: string;
  paymentStatus: PaymentStatus;
  profileCompletionPercentage: number;
  phoneNumber?: string;
  address?: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  kycStatus?: KycStatus;
  currency?: 'NGN' | 'USD';
  rank?: string;
  stage?: number;
  isMerchant?: boolean;
  package?: string;
  registrationPaid?: boolean;
  onboardingComplete?: boolean;
  /** From matrix: direct referrals count */
  directReferrals?: number;
  /** From matrix: active legs count */
  activeLegs?: number;
}

const USER_DATA_KEY = 'mlm_user_data';
const DISPLAY_CURRENCY_KEY = 'mlm_display_currency';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private api = inject(ApiService);
  private user = signal<User | null>(null);
  private displayCurrencySignal = signal<'NGN' | 'USD'>('NGN');

  constructor() {
    const persistedUser = this.getPersistedUserData();
    if (persistedUser) {
      this.user.set(persistedUser);
    }
    const stored = localStorage.getItem(DISPLAY_CURRENCY_KEY);
    if (stored === 'NGN' || stored === 'USD') {
      this.displayCurrencySignal.set(stored);
    }
  }

  paymentStatus = computed(() => this.user()?.paymentStatus ?? 'UNPAID');
  isPaid = computed(() => this.paymentStatus() === 'PAID');
  isMerchant = computed(() => this.user()?.isMerchant ?? false);
  onboardingComplete = computed(() => this.user()?.onboardingComplete ?? false);
  currentUser = computed(() => this.user());

  /** Display currency from preferences; falls back to registration currency when not set */
  displayCurrency = computed(() => {
    const pref = this.displayCurrencySignal();
    const reg = this.user()?.currency;
    return pref ?? reg ?? 'NGN';
  });

  fetchProfile(): Observable<User> {
    return this.api.get<Record<string, unknown>>('users/me').pipe(
      map((response) => this.mapApiUserToUser(response)),
      tap((user) => {
        this.user.set(user);
        this.persistUserData(user);
      }),
      switchMap((user) => this.fetchPreferences().pipe(map(() => user))),
      catchError((err) => {
        const persisted = this.getPersistedUserData();
        if (persisted) {
          this.user.set(persisted);
        }
        throw err;
      }),
    );
  }

  fetchPreferences(): Observable<'NGN' | 'USD'> {
    return this.api.get<Record<string, unknown>>('users/me/preferences').pipe(
      map((data) => {
        const curr = (data['displayCurrency'] ?? data['display_currency']) as
          | 'NGN'
          | 'USD'
          | undefined;
        const fallback = this.user()?.currency ?? 'NGN';
        const value = (curr === 'NGN' || curr === 'USD' ? curr : fallback) as 'NGN' | 'USD';
        this.displayCurrencySignal.set(value);
        localStorage.setItem(DISPLAY_CURRENCY_KEY, value);
        return value;
      }),
      catchError(() => {
        const fallback = this.user()?.currency ?? 'NGN';
        this.displayCurrencySignal.set(fallback);
        return of(fallback);
      }),
    );
  }

  setDisplayCurrency(currency: 'NGN' | 'USD'): void {
    this.displayCurrencySignal.set(currency);
    localStorage.setItem(DISPLAY_CURRENCY_KEY, currency);
  }

  private mapApiUserToUser(apiUser: Record<string, unknown>): User {
    const reg = apiUser['registration'] as Record<string, unknown> | undefined;
    const registrationPaid =
      apiUser['isRegistrationPaid'] === true ||
      apiUser['registrationPaid'] === true ||
      reg?.['isPaid'] === true;

    const role = apiUser['role'] as string | undefined;

    return {
      id: String(apiUser['id'] ?? ''),
      username: (apiUser['username'] as string | undefined) ?? undefined,
      email: String(apiUser['email'] ?? ''),
      firstName: String(apiUser['firstName'] ?? apiUser['first_name'] ?? ''),
      lastName: String(apiUser['lastName'] ?? apiUser['last_name'] ?? ''),
      paymentStatus: registrationPaid ? 'PAID' : 'UNPAID',
      profileCompletionPercentage: Number(apiUser['profileCompletionPercentage'] ?? 0),
      phoneNumber:
        (apiUser['phoneNumber'] as string | undefined) ?? (apiUser['phone'] as string | undefined),
      address: apiUser['address'] as string | undefined,
      bankName: apiUser['bankName'] as string | undefined,
      accountNumber: apiUser['accountNumber'] as string | undefined,
      accountName: apiUser['accountName'] as string | undefined,
      kycStatus: apiUser['kycStatus'] as KycStatus | undefined,
      currency: (apiUser['currency'] ??
        apiUser['registrationCurrency'] ??
        apiUser['registration_currency'] ??
        reg?.['currency']) as 'NGN' | 'USD' | undefined,
      rank: apiUser['rank'] as string | undefined,
      stage: (apiUser['stage'] ??
        (apiUser['matrix'] as Record<string, unknown>)?.['currentStage']) as number | undefined,
      directReferrals: Number(
        (apiUser['matrix'] as Record<string, unknown>)?.['directReferrals'] ??
          (apiUser['matrix'] as Record<string, unknown>)?.['direct_referrals'] ??
          0,
      ),
      activeLegs: Number(
        (apiUser['matrix'] as Record<string, unknown>)?.['activeLegs'] ??
          (apiUser['matrix'] as Record<string, unknown>)?.['active_legs'] ??
          0,
      ),
      isMerchant: role === 'MERCHANT' || apiUser['isMerchant'] === true,
      package: (apiUser['package'] ??
        apiUser['registrationPackage'] ??
        apiUser['registration_package'] ??
        reg?.['package']) as string | undefined,
      registrationPaid,
      onboardingComplete: apiUser['onboardingComplete'] === true,
    };
  }

  private persistUserData(user: User): void {
    localStorage.setItem(USER_DATA_KEY, JSON.stringify(user));
  }

  private getPersistedUserData(): User | null {
    const stored = localStorage.getItem(USER_DATA_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
    return null;
  }

  getPaymentStatus(): PaymentStatus {
    return this.paymentStatus();
  }

  setUser(user: User): void {
    this.user.set(user);
    this.persistUserData(user);
  }

  updatePaymentStatus(status: PaymentStatus): void {
    const currentUser = this.user();
    if (currentUser) {
      const updatedUser = { ...currentUser, paymentStatus: status };
      this.user.set(updatedUser);
      this.persistUserData(updatedUser);
    }
  }

  updateProfileCompletion(percentage: number): void {
    const currentUser = this.user();
    if (currentUser) {
      const updatedUser = { ...currentUser, profileCompletionPercentage: percentage };
      this.user.set(updatedUser);
      this.persistUserData(updatedUser);
    }
  }

  updateProfile(
    profileData: Partial<
      Pick<
        User,
        | 'firstName'
        | 'lastName'
        | 'phoneNumber'
        | 'address'
        | 'bankName'
        | 'accountNumber'
        | 'accountName'
        | 'currency'
        | 'kycStatus'
      >
    >,
  ): void {
    const currentUser = this.user();
    if (currentUser) {
      const updatedUser = { ...currentUser, ...profileData };
      this.user.set(updatedUser);
      this.persistUserData(updatedUser);
    }
  }

  clearUser(): void {
    this.user.set(null);
    this.displayCurrencySignal.set('NGN');
    localStorage.removeItem(USER_DATA_KEY);
    localStorage.removeItem(DISPLAY_CURRENCY_KEY);
  }
}
