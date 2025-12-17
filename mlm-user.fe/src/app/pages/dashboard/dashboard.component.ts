import { Component, computed, inject, ChangeDetectionStrategy, ChangeDetectorRef, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { BadgeModule } from 'primeng/badge';
import { MessageModule } from 'primeng/message';
import { ProgressBarModule } from 'primeng/progressbar';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-dashboard',
  imports: [
    CommonModule,
    CardModule,
    ButtonModule,
    BadgeModule,
    MessageModule,
    ProgressBarModule
  ],
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent implements OnInit {
  private router = inject(Router);
  private userService = inject(UserService);
  private cdr = inject(ChangeDetectorRef);

  isPaid = this.userService.isPaid;
  currentUser = this.userService.currentUser;
  paymentStatus = this.userService.paymentStatus;

  constructor() {
    // Effect to watch payment status changes and trigger change detection
    effect(() => {
      // Access the signal to create a dependency
      this.isPaid();
      this.paymentStatus();
      // Mark for check when payment status changes
      this.cdr.markForCheck();
    });
  }

  ngOnInit(): void {
    // Listen to navigation events to detect when returning to dashboard
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: unknown) => {
        const navEvent = event as NavigationEnd;
        // Mark for check when navigating to dashboard to ensure signal updates are detected
        if (navEvent.urlAfterRedirects === '/dashboard' || navEvent.urlAfterRedirects.startsWith('/dashboard')) {
          this.cdr.markForCheck();
        }
      });
    
    // Also mark for check on component init
    this.cdr.markForCheck();
  }

  profileCompletion = computed(() => {
    const user = this.currentUser();
    return user?.profileCompletionPercentage ?? 0;
  });

  navigateToPayment(): void {
    this.router.navigate(['/dashboard/registration-payment']);
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }
}

