import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';

export interface AuditLogItem {
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface AuditLogsResponse {
  items: AuditLogItem[];
  total: number;
}

@Injectable({
  providedIn: 'root'
})
export class AuditService {
  private api = inject(ApiService);

  /** Logs an authentication event (login/register/logout). */
  logAuthEvent(action: 'login' | 'register' | 'logout', status: 'success' | 'failure', identifier?: string): void {
    // Basic local logging or tracking
    // If the backend had a POST endpoint for custom frontend audits, it'd go here.
    console.info(`[Auth Audit] ${action} - ${status} - ${identifier || 'unknown'}`);
  }

  getAuditLogs(limit = 20, offset = 0, action?: string): Observable<AuditLogsResponse> {
    const params: Record<string, string> = {};
    if (action) {
      params['action'] = action;
    }

    return this.api.get<{ items?: any[]; total?: number }>('audit/me', params).pipe(
      map((res) => {
        const rawItems = res.items || (Array.isArray(res) ? res : []);
        const total = res.total || rawItems.length;

        const items: AuditLogItem[] = rawItems.map((item: any) => ({
          action: String(item.action || 'UNKNOWN'),
          entityType: item.entityType || item.entity_type,
          entityId: item.entityId || item.entity_id,
          metadata: item.metadata,
          createdAt: new Date(item.createdAt || item.created_at || Date.now())
        }));

        return { items, total };
      })
    );
  }
}
