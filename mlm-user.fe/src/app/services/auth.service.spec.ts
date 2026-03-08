import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AuthService, AuthResponse } from './auth.service';
import { ApiService } from './api.service';
import { UserService } from './user.service';
import { environment } from '../../environments/environment';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  const baseUrl = environment.apiUrl;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AuthService,
        ApiService,
        UserService,
      ]
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  describe('login', () => {
    it('should POST /auth/login and store tokens', () => {
      const mockAuth: AuthResponse = { accessToken: 'acc123', refreshToken: 'ref456' };
      const mockProfile = { id: '1', email: 'test@example.com', registrationPaid: true };

      service.login('test@example.com', 'Password1!').subscribe(result => {
        expect(result.success).toBe(true);
        expect(result.paymentStatus).toBe('PAID');
      });

      const loginReq = httpMock.expectOne(r => r.url === `${baseUrl}/auth/login` && r.method === 'POST');
      expect(loginReq.request.body).toEqual({ email: 'test@example.com', password: 'Password1!' });
      loginReq.flush(mockAuth);

      const profileReq = httpMock.expectOne(r => r.url === `${baseUrl}/users/me` && r.method === 'GET');
      profileReq.flush(mockProfile);

      expect(localStorage.getItem('mlm_auth_token')).toBe('acc123');
      expect(localStorage.getItem('mlm_refresh_token')).toBe('ref456');
      expect(service.isAuthenticated()).toBe(true);
    });

    it('should clear tokens on login failure', () => {
      service.login('bad@email.com', 'wrong').subscribe({
        error: (err) => {
          expect(err.status).toBe(401);
        }
      });

      const req = httpMock.expectOne(r => r.url === `${baseUrl}/auth/login`);
      req.flush({ message: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });

      expect(localStorage.getItem('mlm_auth_token')).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
    });
  });

  describe('register', () => {
    it('should POST /auth/register with correct payload and store tokens', () => {
      const mockAuth: AuthResponse = { accessToken: 'acc_new', refreshToken: 'ref_new' };

      service.register({
        username: 'newuser',
        email: 'new@example.com',
        password: 'StrongP@ss1',
        package: 'GOLD',
        currency: 'NGN'
      }).subscribe(result => {
        expect(result).toBe(true);
      });

      const req = httpMock.expectOne(r => r.url === `${baseUrl}/auth/register` && r.method === 'POST');
      expect(req.request.body).toEqual({
        username: 'newuser',
        email: 'new@example.com',
        password: 'StrongP@ss1',
        package: 'GOLD',
        currency: 'NGN'
      });
      req.flush(mockAuth);

      expect(localStorage.getItem('mlm_auth_token')).toBe('acc_new');
      expect(localStorage.getItem('mlm_refresh_token')).toBe('ref_new');
    });

    it('should include optional referralCode when provided', () => {
      const mockAuth: AuthResponse = { accessToken: 'a', refreshToken: 'r' };

      service.register({
        username: 'refuser',
        email: 'ref@example.com',
        password: 'StrongP@ss1',
        package: 'SILVER',
        currency: 'USD',
        referralCode: 'ABC123'
      }).subscribe();

      const req = httpMock.expectOne(r => r.url === `${baseUrl}/auth/register`);
      expect(req.request.body.referralCode).toBe('ABC123');
      req.flush(mockAuth);
    });
  });

  describe('logout', () => {
    it('should POST /auth/logout and clear storage', () => {
      localStorage.setItem('mlm_auth_token', 'tok');
      localStorage.setItem('mlm_refresh_token', 'ref');

      service.logout().subscribe();

      const req = httpMock.expectOne(r => r.url === `${baseUrl}/auth/logout` && r.method === 'POST');
      expect(req.request.body).toEqual({ refreshToken: 'ref' });
      req.flush(null);

      expect(localStorage.getItem('mlm_auth_token')).toBeNull();
      expect(localStorage.getItem('mlm_refresh_token')).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
    });

    it('should clear storage even if logout API fails', () => {
      localStorage.setItem('mlm_auth_token', 'tok');
      localStorage.setItem('mlm_refresh_token', 'ref');

      service.logout().subscribe({ error: () => {} });

      const req = httpMock.expectOne(r => r.url === `${baseUrl}/auth/logout`);
      req.flush(null, { status: 500, statusText: 'Server Error' });

      expect(localStorage.getItem('mlm_auth_token')).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
    });
  });

  describe('refreshToken', () => {
    it('should POST /auth/refresh and update stored tokens', () => {
      localStorage.setItem('mlm_refresh_token', 'old_ref');
      const newTokens: AuthResponse = { accessToken: 'new_acc', refreshToken: 'new_ref' };

      service.refreshToken().subscribe(result => {
        expect(result.accessToken).toBe('new_acc');
      });

      const req = httpMock.expectOne(r => r.url === `${baseUrl}/auth/refresh` && r.method === 'POST');
      expect(req.request.body).toEqual({ refreshToken: 'old_ref' });
      req.flush(newTokens);

      expect(localStorage.getItem('mlm_auth_token')).toBe('new_acc');
      expect(localStorage.getItem('mlm_refresh_token')).toBe('new_ref');
    });

    it('should error when no refresh token is available', () => {
      service.refreshToken().subscribe({
        error: (err) => {
          expect(err.message).toBe('No refresh token available');
        }
      });
    });
  });

  describe('forgotPassword', () => {
    it('should POST /auth/forgot-password with email', () => {
      service.forgotPassword('user@example.com').subscribe();

      const req = httpMock.expectOne(r => r.url === `${baseUrl}/auth/forgot-password` && r.method === 'POST');
      expect(req.request.body).toEqual({ email: 'user@example.com' });
      req.flush(null);
    });
  });

  describe('resetPassword', () => {
    it('should POST /auth/reset-password with token and newPassword', () => {
      service.resetPassword('reset_token_abc', 'NewP@ssword1').subscribe();

      const req = httpMock.expectOne(r => r.url === `${baseUrl}/auth/reset-password` && r.method === 'POST');
      expect(req.request.body).toEqual({ token: 'reset_token_abc', newPassword: 'NewP@ssword1' });
      req.flush(null);
    });
  });
});
