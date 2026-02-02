import { Component, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';
import { filter } from 'rxjs/operators';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { LayoutService } from '../../services/layout.service';

interface MenuItem {
  label: string;
  icon: string;
  route?: string;
  badge?: number;
  requiresPayment?: boolean;
  action?: () => void;
  children?: MenuItem[];
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

@Component({
  selector: 'app-side-menu',
  standalone: true,
  imports: [CommonModule, RouterModule, TooltipModule],
  templateUrl: './side-menu.component.html',
  styles: [`
    :host {
      display: block;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SideMenuComponent {
  private router = inject(Router);
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private layoutService = inject(LayoutService);

  isPaid = this.userService.isPaid;
  isMerchant = this.userService.isMerchant;
  currentUser = this.userService.currentUser;
  mobileMenuOpen = this.layoutService.isMobileMenuOpen;
  activeRoute = signal('');
  openMenus = signal<Set<string>>(new Set());
  collapsed = this.layoutService.isSidebarCollapsed;

  menuSections = signal<MenuSection[]>([
    {
      title: 'MAIN MENU',
      items: [
        { label: 'Dashboard', icon: 'pi pi-th-large', route: '/dashboard' },
        { label: 'Profile', icon: 'pi pi-user', route: '/profile' },
        { label: 'Marketplace', icon: 'pi pi-shopping-cart', route: '/marketplace', requiresPayment: true },
        { 
          label: 'Wallet', 
          icon: 'pi pi-wallet', 
          route: '/wallet',
          requiresPayment: true,
          children: [
            { label: 'Transaction History', icon: 'pi pi-history', route: '/wallet/transactions/NGN', requiresPayment: true }
          ]
        },
        { 
          label: 'Network', 
          icon: 'pi pi-users', 
          route: '/network',
          requiresPayment: true,
          children: [
            { label: 'Overview', icon: 'pi pi-home', route: '/network/overview', requiresPayment: true },
            { label: 'Referrals', icon: 'pi pi-link', route: '/network/referrals', requiresPayment: true },
            { label: 'Matrix Tree', icon: 'pi pi-sitemap', route: '/network/matrix', requiresPayment: true },
            { label: 'Downline', icon: 'pi pi-list', route: '/network/downline', requiresPayment: true },
            { label: 'Performance', icon: 'pi pi-chart-bar', route: '/network/performance', requiresPayment: true }
          ]
        }
      ]
    },
    {
      title: 'MERCHANT',
      items: [
        { label: 'Merchant Center', icon: 'pi pi-store', route: '/merchant' }
      ]
    },
    {
      title: 'FINANCE',
      items: [
        { label: 'Commissions', icon: 'pi pi-dollar', route: '/commissions', requiresPayment: true },
        { label: 'Transactions', icon: 'pi pi-arrow-right-arrow-left', route: '/transactions', requiresPayment: true },
        { label: 'Withdrawals', icon: 'pi pi-money-bill', route: '/withdrawals', requiresPayment: true },
        { label: 'Orders', icon: 'pi pi-shopping-bag', route: '/orders', requiresPayment: true }
      ]
    },
    {
      title: 'GENERAL',
      items: [
        { label: 'Notifications', icon: 'pi pi-bell', route: '/notifications' },
        { label: 'Settings', icon: 'pi pi-cog', route: '/settings' },
        // { label: 'Help', icon: 'pi pi-question-circle', route: '/help' },
        { label: 'Log out', icon: 'pi pi-sign-out', action: () => this.logout() }
      ]
    }
  ]);

  /** Sections to display; MERCHANT only when user is a merchant */
  visibleMenuSections = computed(() => {
    const sections = this.menuSections();
    if (this.isMerchant()) return sections;
    return sections.filter((s: MenuSection) => s.title !== 'MERCHANT');
  });

  constructor() {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: unknown) => {
        const navEvent = event as NavigationEnd;
        this.activeRoute.set(navEvent.urlAfterRedirects);
        this.autoExpandActiveSubmenu();
      });
    
    this.activeRoute.set(this.router.url);
    this.autoExpandActiveSubmenu();
  }

  private autoExpandActiveSubmenu(): void {
    const currentUrl = this.activeRoute();
    this.visibleMenuSections().forEach((section: MenuSection) => {
      section.items.forEach((item: MenuItem) => {
        const hasActiveChild = item.children?.some((child: MenuItem) => child.route && currentUrl.startsWith(child.route));
        const isParentActive = item.route && (currentUrl === item.route || currentUrl.startsWith(item.route + '/'));
        
        if (hasActiveChild || (isParentActive && item.children)) {
          this.toggleSubMenu(item.label, true);
        }
      });
    });
  }

  toggleCollapse(): void {
    this.layoutService.toggleSidebar();
  }

  toggleMobileMenu(): void {
    this.layoutService.toggleMobileMenu();
  }

  closeMobileMenu(): void {
    this.layoutService.closeMobileMenu();
  }

  toggleSubMenu(label: string, forceOpen = false): void {
    const current = new Set(this.openMenus());
    if (forceOpen) {
      current.add(label);
    } else {
      if (current.has(label)) {
        current.delete(label);
      } else {
        current.add(label);
      }
    }
    this.openMenus.set(current);
  }

  isItemDisabled(item: MenuItem): boolean {
    return (item.requiresPayment ?? false) && !this.isPaid();
  }

  navigate(item: MenuItem): void {
    // Handle action items (like logout)
    if (item.action) {
      item.action();
      return;
    }

    // Prevent navigation if item requires payment and user hasn't paid
    if (this.isItemDisabled(item)) {
      return;
    }

    // Toggle submenu if has children
    if (item.children && item.children.length > 0) {
      this.toggleSubMenu(item.label);
    }

    // Navigate if has route
    if (item.route) {
      this.router.navigate([item.route]);
      this.closeMobileMenu();
    }
  }

  logout(): void {
    this.authService.logout();
    this.userService.clearUser();
    this.router.navigate(['/auth/login']);
  }

  isActiveRoute(route?: string): boolean {
    if (!route) return false;
    return this.activeRoute() === route || this.activeRoute().startsWith(route + '/');
  }
}
