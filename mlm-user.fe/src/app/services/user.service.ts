import { Injectable, signal, computed, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { tap, map, catchError } from 'rxjs/operators';
import { ApiService } from './api.service';

export type PaymentStatus = 'UNPAID' | 'PAID';
export type KycStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface User {
  id: string;
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
}

const USER_DATA_KEY = 'mlm_user_data';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private api = inject(ApiService);
  private user = signal<User | null>(null);

  constructor() {
    const persistedUser = this.getPersistedUserData();
    if (persistedUser) {
      this.user.set(persistedUser);
    }
  }

  paymentStatus = computed(() => this.user()?.paymentStatus ?? 'UNPAID');
  isPaid = computed(() => this.paymentStatus() === 'PAID');
  isMerchant = computed(() => this.user()?.isMerchant ?? false);
  currentUser = computed(() => this.user());

  fetchProfile(): Observable<User> {
    return this.api.get<Record<string, unknown>>('users/me').pipe(
      map(response => this.mapApiUserToUser(response)),
      tap(user => {
        this.user.set(user);
        this.persistUserData(user);
      }),
      catchError(err => {
        const persisted = this.getPersistedUserData();
        if (persisted) {
          this.user.set(persisted);
        }
        throw err;
      })
    );
  }

  private mapApiUserToUser(apiUser: Record<string, unknown>): User {
    const registrationPaid = apiUser['registrationPaid'] === true;

    return {
      id: String(apiUser['id'] ?? ''),
      email: String(apiUser['email'] ?? ''),
      firstName: String(apiUser['firstName'] ?? apiUser['first_name'] ?? ''),
      lastName: String(apiUser['lastName'] ?? apiUser['last_name'] ?? ''),
      paymentStatus: registrationPaid ? 'PAID' : 'UNPAID',
      profileCompletionPercentage: Number(apiUser['profileCompletionPercentage'] ?? 0),
      phoneNumber: apiUser['phoneNumber'] as string | undefined ?? apiUser['phone'] as string | undefined,
      address: apiUser['address'] as string | undefined,
      bankName: apiUser['bankName'] as string | undefined,
      accountNumber: apiUser['accountNumber'] as string | undefined,
      accountName: apiUser['accountName'] as string | undefined,
      kycStatus: apiUser['kycStatus'] as KycStatus | undefined,
      currency: apiUser['currency'] as 'NGN' | 'USD' | undefined,
      rank: apiUser['rank'] as string | undefined,
      stage: apiUser['stage'] as number | undefined,
      isMerchant: apiUser['isMerchant'] as boolean | undefined ?? false,
      package: apiUser['package'] as string | undefined,
      registrationPaid,
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

  updateProfile(profileData: Partial<Pick<User, 'firstName' | 'lastName' | 'phoneNumber' | 'address' | 'bankName' | 'accountNumber' | 'accountName' | 'currency'>>): void {
    const currentUser = this.user();
    if (currentUser) {
      const updatedUser = { ...currentUser, ...profileData };
      this.user.set(updatedUser);
      this.persistUserData(updatedUser);
    }
  }

  clearUser(): void {
    this.user.set(null);
    localStorage.removeItem(USER_DATA_KEY);
  }
}
