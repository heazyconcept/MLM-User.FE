import { Injectable } from '@angular/core';

export type AuthAuditAction = 'login' | 'register' | 'logout';
export type AuthAuditOutcome = 'success' | 'failure';

export interface AuthAuditEntry {
  timestamp: string;
  action: AuthAuditAction;
  outcome: AuthAuditOutcome;
  userIdentifier: string;
}

/**
 * Lightweight audit logging for security-critical auth events.
 * Log entries are structured (JSON) and must never contain passwords or tokens.
 * Use email as identifier pre-login, user ID post-login.
 */
@Injectable({
  providedIn: 'root'
})
export class AuditService {
  logAuthEvent(action: AuthAuditAction, outcome: AuthAuditOutcome, userIdentifier: string): void {
    const entry: AuthAuditEntry = {
      timestamp: new Date().toISOString(),
      action,
      outcome,
      userIdentifier
    };
    const payload = JSON.stringify(entry);
    if (typeof ngDevMode !== 'undefined' && ngDevMode) {
      console.info('[AuthAudit]', payload);
    }
    // Optional: send to backend POST /audit when endpoint exists
    // this.api.post('audit', entry).subscribe();
  }
}
