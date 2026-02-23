import { Component, signal, ChangeDetectionStrategy, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SessionService, SessionItem } from '../../../services/session.service';
import { ModalService } from '../../../services/modal.service';

@Component({
  selector: 'app-settings-sessions',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './settings-sessions.component.html',
  styleUrl: './settings-sessions.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsSessionsComponent implements OnInit {
  private sessionService = inject(SessionService);
  private modalService = inject(ModalService);

  sessions = signal<SessionItem[]>([]);
  isLoading = signal(true);
  error = signal<string | null>(null);
  revokingSessionId = signal<string | null>(null);
  revokingAll = signal(false);

  ngOnInit(): void {
    this.sessionService.getSessions().subscribe({
      next: (list) => {
        this.sessions.set(list);
        this.error.set(null);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Failed to load sessions. Please try again.');
        this.isLoading.set(false);
      }
    });
  }

  logoutSession(id: string): void {
    this.revokingSessionId.set(id);
    this.sessionService.revokeSession(id).subscribe({
      next: () => {
        this.sessions.update((list) => list.filter((s) => s.id !== id));
        this.revokingSessionId.set(null);
      },
      error: () => {
        this.revokingSessionId.set(null);
        this.modalService.open(
          'error',
          'Could not revoke session',
          'We couldn\'t log out that session. Please try again.'
        );
      }
    });
  }

  logoutAll(): void {
    this.revokingAll.set(true);
    this.sessionService.revokeAllSessions().subscribe({
      next: () => {
        this.sessions.set([]);
        this.revokingAll.set(false);
      },
      error: () => {
        this.revokingAll.set(false);
        this.modalService.open(
          'error',
          'Could not revoke sessions',
          'We couldn\'t log out other sessions. Please try again.'
        );
      }
    });
  }
}
