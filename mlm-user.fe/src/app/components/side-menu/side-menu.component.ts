import { Component, signal, computed, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';
import { filter } from 'rxjs/operators';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { LayoutService } from '../../services/layout.service';
import { MerchantService } from '../../services/merchant.service';

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
  styles: [
    `
      :host {
        display: block;
      }

      .hide-scrollbar {
        -ms-overflow-style: none;
        scrollbar-width: none;
      }

      .hide-scrollbar::-webkit-scrollbar {
        display: none;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SideMenuComponent implements OnInit {
  private router = inject(Router);
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private layoutService = inject(LayoutService);
  private merchantService = inject(MerchantService);

  isPaid = this.userService.isPaid;
  isMerchant = this.userService.isMerchant;
  /** Merchant Center nav: user role or ACTIVE profile from GET /merchants/me */
  showMerchantCenter = computed(
    () => this.isMerchant() || this.merchantService.isActiveMerchant(),
  );
  currentUser = this.userService.currentUser;
  mobileMenuOpen = this.layoutService.isMobileMenuOpen;
  activeRoute = signal('');
  openMenus = signal<Set<string>>(new Set());
  collapsed = this.layoutService.isSidebarCollapsed;
  displayCurrency = this.userService.displayCurrency;

  private merchantApplyMenuItems(): MenuItem[] {
    if (this.merchantService.needsPayment()) {
      return [
        {
          label: 'Complete Merchant Payment',
          icon: 'pi pi-wallet',
          route: '/merchant/apply',
        },
      ];
    }
    // Merchant Center section already visible — avoid duplicate application links
    if (this.showMerchantCenter()) {
      return [];
    }
    if (!this.merchantService.isMerchant()) {
      return [{ label: 'Become a Merchant', icon: 'pi pi-shop', route: '/merchant/apply' }];
    }
    if (this.merchantService.isAwaitingAdminApproval()) {
      return [
        {
          label: 'Merchant Application',
          icon: 'pi pi-clock',
          route: '/merchant/dashboard',
        },
      ];
    }
    return [];
  }

  menuSections = computed<MenuSection[]>(() => {
    const currency = this.displayCurrency();
    return [
      {
        title: 'MAIN MENU',
        items: [
          { label: 'Dashboard', icon: 'pi pi-th-large', route: '/dashboard' },
          { label: 'Profile', icon: 'pi pi-user', route: '/profile' },
          ...this.merchantApplyMenuItems(),
          {
            label: 'Marketplace',
            icon: 'pi pi-shopping-cart',
            route: '/marketplace',
            requiresPayment: true,
          },
          {
            label: 'Wallet',
            icon: 'pi pi-wallet',
            route: '/wallet',
            requiresPayment: true,
            children: [
              {
                label: 'My Wallet',
                icon: 'pi pi-wallet',
                route: '/wallet',
                requiresPayment: true,
              },
              {
                label: 'Activity History',
                icon: 'pi pi-history',
                route: '/wallet/transactions',
                requiresPayment: true,
              },
            ],
          },
          {
            label: 'Network',
            icon: 'pi pi-users',
            route: '/network',
            requiresPayment: true,
            children: [
              {
                label: 'Overview',
                icon: 'pi pi-home',
                route: '/network/overview',
                requiresPayment: true,
              },
              {
                label: 'Successlines',
                icon: 'pi pi-link',
                route: '/network/referrals',
                requiresPayment: true,
              },
              {
                label: 'Matrix Chart',
                icon: 'pi pi-sitemap',
                route: '/network/matrix',
                requiresPayment: true,
              },
              {
                label: 'Matrix Levels',
                icon: 'pi pi-list',
                requiresPayment: true,
                children: Array.from({ length: 13 }, (_, i) => ({
                  label: `Level ${i + 1}`,
                  icon: 'pi pi-users',
                  route: `/network/matrix/level/${i + 1}`,
                  requiresPayment: true,
                }))
              },
              {
                label: 'Downline',
                icon: 'pi pi-list',
                route: '/network/downline',
                requiresPayment: true,
              },
                // {
                //   label: 'Performance',
                //   icon: 'pi pi-chart-bar',
                //   route: '/network/performance',
                //   requiresPayment: true,
                // },
            ],
          },
        ],
      },
      {
        title: 'MERCHANT',
        items: [
          {
            label: 'Merchant Center',
            icon: 'pi pi-shop',
            route: '/merchant',
            children: [
              { label: 'Dashboard', icon: 'pi pi-th-large', route: '/merchant/dashboard' },
              { label: 'Profile Settings', icon: 'pi pi-cog', route: '/merchant/profile' },
              { label: 'Orders', icon: 'pi pi-shopping-bag', route: '/merchant/orders' },
              { label: 'Inventory', icon: 'pi pi-box', route: '/merchant/inventory' },
              { label: 'Deliveries', icon: 'pi pi-truck', route: '/merchant/deliveries' },
              { label: 'Earnings', icon: 'pi pi-chart-line', route: '/merchant/earnings' },
              { label: 'Allocations', icon: 'pi pi-inbox', route: '/merchant/allocations' },
            ],
          },
        ],
      },
      {
        title: 'FINANCE',
        items: [
          {
            label: 'Commissions',
            icon: 'pi pi-dollar',
            route: '/commissions',
            requiresPayment: true,
            children: [
              {
                label: 'Overview',
                icon: 'pi pi-chart-bar',
                route: '/commissions',
                requiresPayment: true,
              },
            ],
          },
          {
            label: 'Transactions',
            icon: 'pi pi-arrow-right-arrow-left',
            route: '/transactions',
            requiresPayment: true,
          },
          {
            label: 'Withdrawals',
            icon: 'pi pi-money-bill',
            route: '/withdrawals',
            requiresPayment: true,
          },
          { label: 'Orders', icon: 'pi pi-shopping-bag', route: '/orders', requiresPayment: true },
        ],
      },
      {
        title: 'GENERAL',
        items: [
          { label: 'Notifications', icon: 'pi pi-bell', route: '/notifications' },
          { label: 'Settings', icon: 'pi pi-cog', route: '/settings' },
          // { label: 'Help', icon: 'pi pi-question-circle', route: '/help' },
          { label: 'Log out', icon: 'pi pi-sign-out', action: () => this.logout() },
        ],
      },
    ];
  });

  /** Sections to display; MERCHANT when user has merchant role or ACTIVE merchant profile */
  visibleMenuSections = computed(() => {
    const sections = this.menuSections();
    if (this.showMerchantCenter()) return sections;
    return sections.filter((s: MenuSection) => s.title !== 'MERCHANT');
  });

  constructor() {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: unknown) => {
        const navEvent = event as NavigationEnd;
        this.activeRoute.set(navEvent.urlAfterRedirects);
        this.autoExpandActiveSubmenu();
      });

    this.activeRoute.set(this.router.url);
    this.autoExpandActiveSubmenu();
  }

  ngOnInit(): void {
    this.merchantService.fetchProfile();
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.merchantService.fetchProfile());
  }

  private autoExpandActiveSubmenu(): void {
    const currentUrl = this.activeRoute();
    this.visibleMenuSections().forEach((section: MenuSection) => {
      section.items.forEach((item: MenuItem) => {
        const hasActiveChild = item.children?.some(
          (child: MenuItem) => child.route && currentUrl.startsWith(child.route),
        );
        const hasActiveGrandchild = item.children?.some(
          (child: MenuItem) => child.children?.some(
            (gc: MenuItem) => gc.route && currentUrl.startsWith(gc.route),
          ),
        );
        const isParentActive =
          item.route && (currentUrl === item.route || currentUrl.startsWith(item.route + '/'));

        if (hasActiveChild || hasActiveGrandchild || (isParentActive && item.children)) {
          this.toggleSubMenu(item.label, true);
        }

        // Also expand nested children if they have an active grandchild
        item.children?.forEach((child: MenuItem) => {
          const childHasActiveRoute = child.children?.some(
            (gc: MenuItem) => gc.route && currentUrl.startsWith(gc.route),
          );
          if (childHasActiveRoute) {
            this.toggleSubMenu(child.label, true);
          }
        });
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

    // Parent items are expand/collapse controls; leaf items perform navigation.
    if (item.children && item.children.length > 0) {
      this.toggleSubMenu(item.label);
      return;
    }

    // Navigate if has route
    if (item.route) {
      this.router.navigate([item.route]);
      this.closeMobileMenu();
    }
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/auth/login']);
      },
      error: () => {
        this.router.navigate(['/auth/login']);
      },
    });
  }

  isActiveRoute(route?: string): boolean {
    if (!route) return false;
    return this.activeRoute() === route || this.activeRoute().startsWith(route + '/');
  }
}
