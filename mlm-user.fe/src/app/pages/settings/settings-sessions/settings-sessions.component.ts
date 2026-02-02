import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface SessionItem {
  id: string;
  device: string;
  location?: string;
  lastActive: string;
  isCurrent: boolean;
}

@Component({
  selector: 'app-settings-sessions',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './settings-sessions.component.html',
  styleUrl: './settings-sessions.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsSessionsComponent {
  sessions = signal<SessionItem[]>([
    { id: '1', device: 'Chrome on Windows', location: 'Lagos, Nigeria', lastActive: new Date().toISOString(), isCurrent: true },
    { id: '2', device: 'Safari on iPhone', location: 'Lagos, Nigeria', lastActive: new Date(Date.now() - 86400000).toISOString(), isCurrent: false }
  ]);

  logoutSession(id: string): void {
    this.sessions.update(list => list.filter(s => s.id !== id));
  }

  logoutAll(): void {
    this.sessions.set([]);
  }
}
