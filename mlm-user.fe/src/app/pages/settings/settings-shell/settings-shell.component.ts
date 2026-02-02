import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-settings-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet],
  templateUrl: './settings-shell.component.html',
  styleUrl: './settings-shell.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsShellComponent {
  private router = inject(Router);

  isActive(path: string): boolean {
    const url = this.router.url;
    return url === path || url.startsWith(path + '/') || url.startsWith(path + '?');
  }
}
