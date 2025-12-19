import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { MenuModule } from 'primeng/menu';
import { BadgeModule } from 'primeng/badge';
import { MenuItem } from 'primeng/api';
import { Popover } from 'primeng/popover';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { LayoutService } from '../../services/layout.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-dashboard-header',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    AvatarModule,
    MenuModule,
    BadgeModule,
    Popover
  ],
  templateUrl: './dashboard-header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardHeaderComponent {
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private layoutService = inject(LayoutService);
  private notificationService = inject(NotificationService);
  private router = inject(Router);

  currentUser = this.userService.currentUser;
  notifications = this.notificationService.allNotifications;
  unreadCount = this.notificationService.unreadCount;

  
  userMenuItems: MenuItem[] = [
    {
      label: 'Profile',
      icon: 'pi pi-user',
      command: () => this.router.navigate(['/profile'])
    },
    {
      label: 'Settings',
      icon: 'pi pi-cog',
      command: () => this.router.navigate(['/settings'])
    },
    {
      separator: true
    },
    {
      label: 'Logout',
      icon: 'pi pi-power-off',
      command: () => this.logout()
    }
  ];

  toggleMobileMenu() {
    this.layoutService.toggleMobileMenu();
  }

  markAllAsRead() {
    this.notificationService.markAllAsRead();
  }

  clearNotifications() {
    this.notificationService.clearAll();
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}

