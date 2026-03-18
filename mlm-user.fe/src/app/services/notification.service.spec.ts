import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { NotificationService } from './notification.service';
import { ApiService } from './api.service';
import { environment } from '../../environments/environment';

describe('NotificationService', () => {
  let service: NotificationService;
  let httpMock: HttpTestingController;
  const baseUrl = environment.apiUrl;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        NotificationService,
        ApiService,
      ],
    });
    service = TestBed.inject(NotificationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  describe('loadNotifications', () => {
    it('should GET /notifications and map response to list', () => {
      const apiItems = [
        {
          id: 'n1',
          type: 'WALLET_CREDITED',
          title: 'Wallet credited',
          message: 'Your wallet was credited.',
          isRead: false,
          createdAt: '2025-02-20T12:00:00.000Z',
        },
      ];

      service.loadNotifications({ limit: 20, offset: 0 }).subscribe((list) => {
        expect(list.length).toBe(1);
        expect(list[0].id).toBe('n1');
        expect(list[0].title).toBe('Wallet credited');
        expect(list[0].message).toBe('Your wallet was credited.');
        expect(list[0].isRead).toBe(false);
        expect(list[0].category).toBe('wallet');
        expect(list[0].type).toBe('success');
      });

      const req = httpMock.expectOne(
        (r) => r.url.startsWith(`${baseUrl}/notifications`) && r.method === 'GET'
      );
      expect(req.request.params.get('limit')).toBe('20');
      expect(req.request.params.get('offset')).toBe('0');
      req.flush(apiItems);
    });

    it('should support type and isRead query params', () => {
      service.loadNotifications({ type: 'ORDER_PAID', isRead: false, limit: 10, offset: 0 }).subscribe();

      const req = httpMock.expectOne(
        (r) => r.url.startsWith(`${baseUrl}/notifications`) && r.method === 'GET'
      );
      expect(req.request.params.get('type')).toBe('ORDER_PAID');
      expect(req.request.params.get('isRead')).toBe('false');
      req.flush([]);
    });

    it('should handle array or items wrapper response', () => {
      service.loadNotifications().subscribe((list) => {
        expect(list.length).toBe(1);
        expect(list[0].id).toBe('n2');
      });
      const req = httpMock.expectOne((r) => r.url.startsWith(`${baseUrl}/notifications`));
      req.flush({ items: [{ id: 'n2', type: 'SYSTEM_ANNOUNCEMENT', isRead: true, createdAt: '2025-02-20T10:00:00.000Z' }] });
    });

    it('should handle notifications wrapper response', () => {
      service.loadNotifications().subscribe((list) => {
        expect(list.length).toBe(1);
        expect(list[0].id).toBe('n3');
        expect(list[0].title).toBe('Wallet Unlocked');
        expect(list[0].message).toBe('Your wallet has been unlocked and is now active.');
      });
      const req = httpMock.expectOne((r) => r.url.startsWith(`${baseUrl}/notifications`));
      req.flush({
        notifications: [
          {
            id: 'n3',
            type: 'WALLET_UNLOCKED',
            title: 'Wallet Unlocked',
            message: 'Your wallet has been unlocked and is now active.',
            isRead: false,
            createdAt: '2026-03-18T15:19:37.792Z',
          },
        ],
      });
    });

    it('should set error signal and return empty array on failure', () => {
      service.loadNotifications().subscribe((list) => {
        expect(list).toEqual([]);
      });
      const req = httpMock.expectOne((r) => r.url.startsWith(`${baseUrl}/notifications`));
      req.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
      expect(service.error()).toBeTruthy();
    });
  });

  describe('loadUnreadCount', () => {
    it('should GET /notifications/unread-count and set count from number', () => {
      service.loadUnreadCount().subscribe((count) => {
        expect(count).toBe(3);
      });
      const req = httpMock.expectOne(
        (r) => r.url === `${baseUrl}/notifications/unread-count` && r.method === 'GET'
      );
      req.flush(3);
      expect(service.unreadCount()).toBe(3);
    });

    it('should accept { count: number } response', () => {
      service.loadUnreadCount().subscribe((count) => {
        expect(count).toBe(5);
      });
      const req = httpMock.expectOne((r) => r.url === `${baseUrl}/notifications/unread-count`);
      req.flush({ count: 5 });
      expect(service.unreadCount()).toBe(5);
    });
  });

  describe('markAsRead', () => {
    it('should PUT /notifications/:id/read and update local state', () => {
      service.loadNotifications().subscribe();
      const listReq = httpMock.expectOne((r) => r.url.startsWith(`${baseUrl}/notifications`) && r.method === 'GET');
      listReq.flush([
        { id: 'n1', type: 'ORDER_PAID', isRead: false, createdAt: '2025-02-20T12:00:00.000Z' },
      ]);
      expect(service.allNotifications().length).toBe(1);
      expect(service.unreadCount()).toBe(0);

      service.markAsRead('n1');

      const putReq = httpMock.expectOne(
        (r) => r.url === `${baseUrl}/notifications/n1/read` && r.method === 'PUT'
      );
      putReq.flush(null);
      expect(service.allNotifications()[0].isRead).toBe(true);
    });
  });

  describe('markAllAsRead', () => {
    it('should PUT /notifications/read-all and clear unread', () => {
      service.loadNotifications().subscribe();
      httpMock.expectOne((r) => r.url.startsWith(`${baseUrl}/notifications`)).flush([
        { id: 'n1', type: 'ORDER_PAID', isRead: false, createdAt: '2025-02-20T12:00:00.000Z' },
      ]);
      service.loadUnreadCount().subscribe();
      httpMock.expectOne((r) => r.url === `${baseUrl}/notifications/unread-count`).flush(1);

      service.markAllAsRead();
      const req = httpMock.expectOne(
        (r) => r.url === `${baseUrl}/notifications/read-all` && r.method === 'PUT'
      );
      expect(req.request.body).toEqual({});
      req.flush(null);
      expect(service.unreadCount()).toBe(0);
    });
  });

  describe('getPreferences', () => {
    it('should GET /notifications/preferences and derive category prefs', () => {
      const apiPrefs = {
        typePreferences: { EARNING_CREDITED: true, WALLET_CREDITED: false },
      };
      service.getPreferences().subscribe((prefs) => {
        expect(prefs.earnings).toBe(true);
        expect(prefs.wallet).toBe(false);
      });
      const req = httpMock.expectOne(
        (r) => r.url === `${baseUrl}/notifications/preferences` && r.method === 'GET'
      );
      req.flush(apiPrefs);
    });

    it('should fall back to local prefs on error', () => {
      service.getPreferences().subscribe((prefs) => {
        expect(prefs.earnings).toBe(true);
        expect(prefs.wallet).toBe(true);
      });
      const req = httpMock.expectOne((r) => r.url === `${baseUrl}/notifications/preferences`);
      req.flush(null, { status: 404, statusText: 'Not Found' });
    });
  });

  describe('updatePreferences', () => {
    it('should PUT /notifications/preferences with typePreferences body', () => {
      service.updatePreferences({ earnings: false, wallet: true });
      const req = httpMock.expectOne(
        (r) => r.url === `${baseUrl}/notifications/preferences` && r.method === 'PUT'
      );
      expect(req.request.body).toEqual(jasmine.objectContaining({ typePreferences: jasmine.any(Object) }));
      expect(Object.keys((req.request.body as { typePreferences: Record<string, boolean> }).typePreferences).length).toBeGreaterThan(0);
      req.flush(null);
    });
  });

  describe('clearAll', () => {
    it('should clear list and unread count locally', () => {
      service.loadUnreadCount().subscribe();
      httpMock.expectOne((r) => r.url === `${baseUrl}/notifications/unread-count`).flush(2);
      expect(service.unreadCount()).toBe(2);
      service.clearAll();
      expect(service.allNotifications().length).toBe(0);
      expect(service.unreadCount()).toBe(0);
    });
  });
});
