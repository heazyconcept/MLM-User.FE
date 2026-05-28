import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

export interface DashboardPopup {
  id: string;
  title: string;
  message: string;
  imageUrls: string[];
  publishedAt: string;
  endsAt: string;
}

const STORAGE_KEY = 'segulah_dashboard_popup_dismissed';

@Injectable({ providedIn: 'root' })
export class DashboardPopupService {
  private api = inject(ApiService);
  private authService = inject(AuthService);

  private queueSignal = signal<DashboardPopup[]>([]);
  private activeSignal = signal<DashboardPopup | null>(null);
  private imageIndexSignal = signal(0);

  activePopup = this.activeSignal.asReadonly();
  imageIndex = this.imageIndexSignal.asReadonly();
  isOpen = computed(() => this.activeSignal() !== null);

  loadPopups(): Observable<DashboardPopup[]> {
    if (!this.authService.getAccessToken()) {
      this.clearAll();
      return of([]);
    }

    return this.api
      .get<{ popups?: DashboardPopup[] } | DashboardPopup[]>('notifications/dashboard-popups')
      .pipe(
        map((raw) => (Array.isArray(raw) ? raw : raw?.popups ?? [])),
        map((items) => this.normalizePopups(items)),
        tap((items) => this.queuePopups(items)),
        catchError(() => {
          this.clearAll();
          return of([]);
        })
      );
  }

  dismissActive(): void {
    const active = this.activeSignal();
    if (!active) return;
    this.dismissPopup(active.id);
    this.activeSignal.set(null);
    this.showNext();
  }

  nextImage(): void {
    const urls = this.activeSignal()?.imageUrls ?? [];
    if (urls.length <= 1) return;
    const next = (this.imageIndexSignal() + 1) % urls.length;
    this.imageIndexSignal.set(next);
  }

  prevImage(): void {
    const urls = this.activeSignal()?.imageUrls ?? [];
    if (urls.length <= 1) return;
    const next = (this.imageIndexSignal() - 1 + urls.length) % urls.length;
    this.imageIndexSignal.set(next);
  }

  private queuePopups(items: DashboardPopup[]): void {
    const dismissed = new Set(this.getDismissed());
    const now = Date.now();
    const activeId = this.activeSignal()?.id;

    const filtered = items
      .filter((popup) => !dismissed.has(popup.id))
      .filter((popup) => !activeId || popup.id !== activeId)
      .filter((popup) => {
        const endsAt = Date.parse(popup.endsAt);
        return Number.isNaN(endsAt) ? true : endsAt > now;
      })
      .sort((a, b) => {
        const aTime = Date.parse(a.publishedAt) || 0;
        const bTime = Date.parse(b.publishedAt) || 0;
        return aTime - bTime;
      });

    if (filtered.length === 0 && !this.activeSignal()) {
      this.queueSignal.set([]);
      return;
    }

    const queueIds = new Set(this.queueSignal().map((p) => p.id));
    const merged = [...this.queueSignal()];
    filtered.forEach((popup) => {
      if (!queueIds.has(popup.id)) {
        merged.push(popup);
        queueIds.add(popup.id);
      }
    });

    this.queueSignal.set(merged);
    if (!this.activeSignal()) {
      this.showNext();
    }
  }

  private showNext(): void {
    const queue = this.queueSignal();
    if (queue.length === 0) {
      this.activeSignal.set(null);
      return;
    }
    const [next, ...rest] = queue;
    this.queueSignal.set(rest);
    this.activeSignal.set(next);
    this.imageIndexSignal.set(0);
  }

  private clearAll(): void {
    this.queueSignal.set([]);
    this.activeSignal.set(null);
    this.imageIndexSignal.set(0);
  }

  private normalizePopups(items: DashboardPopup[]): DashboardPopup[] {
    return items.map((popup) => ({
      id: String(popup.id ?? ''),
      title: String(popup.title ?? 'Announcement'),
      message: String(popup.message ?? ''),
      imageUrls: Array.isArray(popup.imageUrls)
        ? popup.imageUrls.filter((url) => typeof url === 'string')
        : [],
      publishedAt: String(popup.publishedAt ?? ''),
      endsAt: String(popup.endsAt ?? ''),
    }));
  }

  private getDismissed(): string[] {
    if (typeof window === 'undefined' || !window.sessionStorage) return [];
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY) ?? '[]';
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }

  private dismissPopup(id: string): void {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    const next = Array.from(new Set([...this.getDismissed(), id]));
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
}
