import { Injectable, signal, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay, tap, map } from 'rxjs/operators';
import { UserService, type User, type PaymentStatus } from './user.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private userService = inject(UserService);
  private readonly TOKEN_KEY = 'mlm_auth_token';
  
  // Simple signal to track authentication state
  // Initialize from localStorage to persist across page refreshes
  isAuthenticated = signal<boolean>(this.checkAuthState());

  constructor() {
    // Authentication state is already initialized from localStorage in signal initialization above
    // UserService constructor will automatically restore user data from localStorage
  }

  private checkAuthState(): boolean {
    // Check if token exists in localStorage
    // This is called during signal initialization to restore auth state on page refresh
    if (typeof window !== 'undefined' && window.localStorage) {
      const token = localStorage.getItem(this.TOKEN_KEY);
      return !!token;
    }
    return false;
  }

  login(email: string, password: string): Observable<{ success: boolean; paymentStatus: PaymentStatus }> {
    // Mock login logic
    return of(true).pipe(
      delay(1000), // Simulate API call
      tap(() => {
        // Save token to localStorage to persist across page refreshes
        const mockToken = 'mock_token_' + Date.now();
        localStorage.setItem(this.TOKEN_KEY, mockToken);
        this.isAuthenticated.set(true);
      }),
      // After login, fetch registration fee status from server
      // This ensures we always get the latest payment status, even if it changed externally
      // (e.g., admin override, payment retry, failed payment)
      delay(500), // Simulate API call for payment status
      tap(() => {
        // TODO: Replace this mock with actual API call:
        // const response = await this.http.get<{registrationFeeStatus: PaymentStatus}>('/api/user/payment-status').toPromise();
        // const fetchedPaymentStatus = response.registrationFeeStatus;
        
        // Mock: Simulate fetching registration fee status from server
        // In production, this would be: this.http.get('/api/user/payment-status')
        // For now, we'll use persisted status, but in real app this MUST come from API
        const fetchedPaymentStatus: PaymentStatus = this.userService.getPersistedPaymentStatus();
        
        // Update payment status in UserService with server-fetched value
        // This ensures the status is always current, even if changed externally
        this.userService.updatePaymentStatus(fetchedPaymentStatus);
        
        // Set mock user data with fetched payment status
        const mockUser: User = {
          id: '1',
          email: email,
          firstName: 'Oluwapelumi',
          lastName: 'Olamide',
          paymentStatus: 'UNPAID', // This will be overridden by persisted status in setUser
          profileCompletionPercentage: 60
        };
        this.userService.setUser(mockUser);
      }),
      // Return success with payment status
      map(() => ({
        success: true,
        paymentStatus: this.userService.getPaymentStatus()
      }))
    );
  }
  
  register(data: any): Observable<boolean> {
    // Mock register logic
    return of(true).pipe(
      delay(1000), // Simulate API call
      tap(() => {
        // Save token to localStorage to persist across page refreshes
        const mockToken = 'mock_token_' + Date.now();
        localStorage.setItem(this.TOKEN_KEY, mockToken);
        this.isAuthenticated.set(true);
        // Set mock user data with UNPAID status (as per register component)
        const mockUser: User = {
          id: '1',
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          paymentStatus: 'UNPAID',
          profileCompletionPercentage: 50
        };
        this.userService.setUser(mockUser);
      })
    );
  }

  logout() {
    // Clear token from localStorage
    localStorage.removeItem(this.TOKEN_KEY);
    this.isAuthenticated.set(false);
    this.userService.clearUser();
  }
}
