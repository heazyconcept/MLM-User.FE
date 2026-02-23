import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ApiService } from './api.service';

export interface SessionItem {
  id: string;
  device: string;
  location?: string;
  lastActive: string;
  isCurrent: boolean;
}

function toIsoString(value: unknown): string {
  if (value == null) return new Date().toISOString();
  if (typeof value === 'number') return new Date(value).toISOString();
  const s = String(value);
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function mapRawToSessionItem(raw: Record<string, unknown>, index: number): SessionItem {
  const id = String(raw['id'] ?? raw['sessionId'] ?? raw['_id'] ?? index);
  const device = String(raw['device'] ?? raw['userAgent'] ?? raw['deviceName'] ?? 'Unknown');
  const loc = raw['location'] ?? raw['city'] ?? raw['ip'];
  const location = loc != null ? String(loc) : undefined;
  const lastActiveRaw = raw['lastActive'] ?? raw['lastActiveAt'] ?? raw['updatedAt'] ?? raw['createdAt'];
  const lastActive = toIsoString(lastActiveRaw);
  const isCurrent = Boolean(raw['isCurrent'] ?? raw['current'] ?? false);
  return { id, device, location, lastActive, isCurrent };
}

function normalizeToArray(body: unknown): Record<string, unknown>[] {
  if (Array.isArray(body)) return body as Record<string, unknown>[];
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;
    const sessions = obj['sessions'];
    const data = obj['data'];
    const items = obj['items'];
    if (Array.isArray(sessions)) return sessions as Record<string, unknown>[];
    if (Array.isArray(data)) return data as Record<string, unknown>[];
    if (Array.isArray(items)) return items as Record<string, unknown>[];
  }
  return [];
}

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private api = inject(ApiService);

  getSessions(): Observable<SessionItem[]> {
    return this.api.get<unknown>('users/me/sessions').pipe(
      map((body) => {
        const arr = normalizeToArray(body);
        return arr.map((item, i) => mapRawToSessionItem(item as Record<string, unknown>, i));
      }),
      catchError((err: { status?: number }) => {
        if (err?.status === 404) return of([]);
        throw err;
      })
    );
  }

  revokeSession(id: string): Observable<void> {
    return this.api.delete<void>(`users/me/sessions/${encodeURIComponent(id)}`).pipe(
      map(() => undefined)
    );
  }

  revokeAllSessions(): Observable<void> {
    return this.api.delete<void>('users/me/sessions').pipe(
      map(() => undefined)
    );
  }
}
