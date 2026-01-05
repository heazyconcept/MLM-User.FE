import { Injectable, signal, computed, inject } from '@angular/core';

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
}

const PAYMENT_STATUS_KEY = 'mlm_user_payment_status';
const USER_DATA_KEY = 'mlm_user_data';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private user = signal<User | null>(null);

  constructor() {
    // Load persisted user data on initialization
    const persistedUser = this.getPersistedUserData();
    if (persistedUser) {
      this.user.set(persistedUser);
    } else {
      // Default mock user for testing with bank details
      this.user.set({
        id: '1',
        email: 'pelumi123@gmail.com',
        firstName: 'Pelumi',
        lastName: 'Doe',
        paymentStatus: 'PAID',
        profileCompletionPercentage: 85,
        bankName: 'GTBank',
        accountNumber: '0123456789',
        accountName: 'PELUMI DOE',
        kycStatus: 'VERIFIED'
      });
    }
  }


  paymentStatus = computed(() => this.user()?.paymentStatus ?? this.getPersistedPaymentStatus());
  isPaid = computed(() => this.paymentStatus() === 'PAID');
  currentUser = computed(() => this.user());

  getPersistedPaymentStatus(): PaymentStatus {
    const stored = localStorage.getItem(PAYMENT_STATUS_KEY);
    return (stored === 'PAID' || stored === 'UNPAID') ? stored : 'UNPAID';
  }

  private persistPaymentStatus(status: PaymentStatus): void {
    localStorage.setItem(PAYMENT_STATUS_KEY, status);
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
    // Check if there's persisted user data and merge it
    const persistedUser = this.getPersistedUserData();
    const persistedStatus = this.getPersistedPaymentStatus();
    
    // Merge persisted data with new user data, prioritizing persisted profile fields
    const mergedUser: User = {
      ...user,
      paymentStatus: persistedStatus,
      ...(persistedUser && {
        phoneNumber: persistedUser.phoneNumber ?? user.phoneNumber,
        address: persistedUser.address ?? user.address,
        bankName: persistedUser.bankName ?? user.bankName,
        accountNumber: persistedUser.accountNumber ?? user.accountNumber,
        accountName: persistedUser.accountName ?? user.accountName,
        kycStatus: persistedUser.kycStatus ?? user.kycStatus
      })
    };
    
    this.user.set(mergedUser);
    this.persistUserData(mergedUser);
  }

  updatePaymentStatus(status: PaymentStatus): void {
    const currentUser = this.user();
    if (currentUser) {
      const updatedUser = { ...currentUser, paymentStatus: status };
      this.user.set(updatedUser);
      this.persistPaymentStatus(status);
      this.persistUserData(updatedUser);
    } else {
      // If no user is set, still persist the status for when user logs in
      this.persistPaymentStatus(status);
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

  updateProfile(profileData: Partial<Pick<User, 'firstName' | 'lastName' | 'phoneNumber' | 'address' | 'bankName' | 'accountNumber' | 'accountName'>>): void {
    const currentUser = this.user();
    if (currentUser) {
      const updatedUser = { ...currentUser, ...profileData };
      this.user.set(updatedUser);
      this.persistUserData(updatedUser);
    }
  }

  clearUser(): void {
    this.user.set(null);
    // Don't clear payment status from localStorage - it should persist
    // Only clear user data if needed
    // localStorage.removeItem(USER_DATA_KEY);
  }
}

