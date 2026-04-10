import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  OnInit,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { MenuModule } from 'primeng/menu';
import { BadgeModule } from 'primeng/badge';
import { MenuItem } from 'primeng/api';
import { DrawerModule } from 'primeng/drawer';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { LayoutService } from '../../services/layout.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-dashboard-header',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ButtonModule,
    AvatarModule,
    MenuModule,
    BadgeModule,
    DrawerModule,
  ],
  templateUrl: './dashboard-header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardHeaderComponent implements OnInit {
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private layoutService = inject(LayoutService);
  private notificationService = inject(NotificationService);
  private router = inject(Router);

  currentUser = this.userService.currentUser;
  notifications = this.notificationService.drawerNotifications;
  unreadCount = this.notificationService.unreadCount;

  notificationsVisible = signal(false);

  ngOnInit(): void {
    this.notificationService.loadUnreadCount().subscribe();
  }

  openNotificationsDrawer(): void {
    this.notificationsVisible.set(true);
    if (this.notifications().length === 0) {
      this.notificationService.loadNotifications({ limit: 20 }).subscribe();
    }
  }

  userMenuItems = computed<MenuItem[]>(() => {
    const items: MenuItem[] = [
      {
        label: 'Profile',
        icon: 'pi pi-user',
        command: () => this.router.navigate(['/profile']),
      },
      ...(this.userService.isMerchant()
        ? []
        : [
            {
              label: 'Become a Merchant',
              icon: 'pi pi-shop',
              command: () => this.router.navigate(['/merchant/apply']),
            },
          ]),
      {
        label: 'Settings',
        icon: 'pi pi-cog',
        command: () => this.router.navigate(['/settings/account']),
      },
      {
        separator: true,
      },
      {
        label: 'Logout',
        icon: 'pi pi-power-off',
        command: () => this.logout(),
      },
    ];
    return items;
  });

  toggleMobileMenu() {
    this.layoutService.toggleMobileMenu();
  }

  markAllAsRead() {
    this.notificationService.markAllAsRead();
  }

  dismissNotification(id: string): void {
    this.notificationService.dismissFromDrawer(id);
  }

  logout() {
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/auth/login']);
      },
      error: () => this.router.navigate(['/auth/login']),
    });
  }
}
