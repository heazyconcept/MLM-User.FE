import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { OnboardingService } from './onboarding.service';
import { ApiService } from './api.service';
import { environment } from '../../environments/environment';

describe('OnboardingService', () => {
  let service: OnboardingService;
  let httpMock: HttpTestingController;
  const baseUrl = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        OnboardingService,
        ApiService,
      ]
    });

    service = TestBed.inject(OnboardingService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('updateProfile', () => {
    it('should PUT users/me with UpdateProfileDto body', () => {
      const body = { firstName: 'Jane', lastName: 'Doe', dateOfBirth: '1990-01-01' };

      service.updateProfile(body).subscribe();

      const req = httpMock.expectOne(r => r.url === `${baseUrl}/users/me` && r.method === 'PUT');
      expect(req.request.body).toEqual(body);
      req.flush(null);
    });
  });

  describe('uploadProfilePhoto', () => {
    it('should POST users/me/photo with FormData containing file', () => {
      const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });

      service.uploadProfilePhoto(file).subscribe();

      const req = httpMock.expectOne(r => r.url === `${baseUrl}/users/me/photo` && r.method === 'POST');
      expect(req.request.body instanceof FormData).toBe(true);
      const fd = req.request.body as FormData;
      expect(fd.get('photo')).toBe(file);
      req.flush(null);
    });
  });

  describe('getIdentity', () => {
    it('should GET users/me/identity', () => {
      const mock = { idType: 'NATIONAL_ID', idNumber: '123' };

      service.getIdentity().subscribe(data => {
        expect(data).toEqual(mock);
      });

      const req = httpMock.expectOne(r => r.url === `${baseUrl}/users/me/identity` && r.method === 'GET');
      req.flush(mock);
    });
  });

  describe('submitIdentity', () => {
    it('should POST users/me/identity with FormData', () => {
      const formData = new FormData();
      formData.append('idType', 'NATIONAL_ID');
      formData.append('idNumber', '123');
      formData.append('document', new File([], 'id.pdf'));
      formData.append('selfie', new File([], 'selfie.jpg'));

      service.submitIdentity(formData).subscribe();

      const req = httpMock.expectOne(r => r.url === `${baseUrl}/users/me/identity` && r.method === 'POST');
      expect(req.request.body).toBe(formData);
      req.flush(null);
    });
  });

  describe('getBankDetails', () => {
    it('should GET users/me/bank', () => {
      const mock = { bankName: 'Bank', accountNumber: '123', accountName: 'Me', accountType: 'SAVINGS' };

      service.getBankDetails().subscribe(data => {
        expect(data).toEqual(mock);
      });

      const req = httpMock.expectOne(r => r.url === `${baseUrl}/users/me/bank` && r.method === 'GET');
      req.flush(mock);
    });
  });

  describe('updateBankDetails', () => {
    it('should PUT users/me/bank with UpdateBankDetailsDto body', () => {
      const body = { bankName: 'Bank', accountNumber: '123', accountName: 'Me', accountType: 'SAVINGS' as const };

      service.updateBankDetails(body).subscribe();

      const req = httpMock.expectOne(r => r.url === `${baseUrl}/users/me/bank` && r.method === 'PUT');
      expect(req.request.body).toEqual(body);
      req.flush(null);
    });
  });

  describe('getPreferences', () => {
    it('should GET users/me/preferences', () => {
      const mock = { preferredLanguage: 'en', displayCurrency: 'NGN' };

      service.getPreferences().subscribe(data => {
        expect(data).toEqual(mock);
      });

      const req = httpMock.expectOne(r => r.url === `${baseUrl}/users/me/preferences` && r.method === 'GET');
      req.flush(mock);
    });
  });

  describe('updatePreferences', () => {
    it('should PUT users/me/preferences with UpdateUserPreferencesDto body', () => {
      const body = { preferredLanguage: 'en', displayCurrency: 'USD' as const };

      service.updatePreferences(body).subscribe();

      const req = httpMock.expectOne(r => r.url === `${baseUrl}/users/me/preferences` && r.method === 'PUT');
      expect(req.request.body).toEqual(body);
      req.flush(null);
    });
  });
});
