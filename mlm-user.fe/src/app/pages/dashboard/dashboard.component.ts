import { Component, computed, inject, ChangeDetectionStrategy, ChangeDetectorRef, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { BadgeModule } from 'primeng/badge';
import { MessageModule } from 'primeng/message';
import { ProgressBarModule } from 'primeng/progressbar';
import { ChartModule } from 'primeng/chart';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { UserService } from '../../services/user.service';
import { CommissionService } from '../../services/commission.service';
import { WalletService } from '../../services/wallet.service';
import { LoadingService } from '../../services/loading.service';
import { ModalService } from '../../services/modal.service';
import { ActivityService } from '../../services/activity.service';
import { signal } from '@angular/core';

@Component({
  selector: 'app-dashboard',
  imports: [
    CommonModule,
    CardModule,
    ButtonModule,
    BadgeModule,
    MessageModule,
    ProgressBarModule,
    ChartModule,
    DialogModule,
    ReactiveFormsModule,
    SelectModule,
    InputTextModule
  ],
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent implements OnInit {
  private router = inject(Router);
  private userService = inject(UserService);
  private commissionService = inject(CommissionService);
  private walletService = inject(WalletService);
  private loadingService = inject(LoadingService);
  private modalService = inject(ModalService);
  private activityService = inject(ActivityService);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);

  isPaid = this.userService.isPaid;
  currentUser = this.userService.currentUser;
  paymentStatus = this.userService.paymentStatus;
  
  ngnSummary = this.commissionService.getSummary('NGN');
  usdSummary = this.commissionService.getSummary('USD');

  ngnWallet = this.walletService.getWallet('NGN');
  usdWallet = this.walletService.getWallet('USD');

  activeWallet = computed(() => {
    const user = this.currentUser();
    const currency = user?.currency || 'USD';
    return this.walletService.getWallet(currency as 'NGN' | 'USD')();
  });

  activeSummary = computed(() => {
    const user = this.currentUser();
    const currency = user?.currency || 'USD';
    return this.commissionService.getSummary(currency as 'NGN' | 'USD')();
  });

  hasActivity = computed(() => {
    const summary = this.activeSummary();
    return summary.totalEarnings > 0 || summary.directReferrals > 0;
  });

  recentActivities = this.activityService.getRecentActivities(5);

  salesData: any;
  salesOptions: any;
  trafficData: any;
  trafficOptions: any;

  showPaymentModal = signal(false);
  
  paymentMethods = [
    { label: 'Credit Card', value: 'credit_card' },
    { label: 'Debit Card', value: 'debit_card' },
    { label: 'Bank Transfer', value: 'bank_transfer' },
    { label: 'Mobile Money', value: 'mobile_money' }
  ];

  paymentForm = this.fb.group({
    paymentMethod: ['', [Validators.required]],
    amount: [{ value: 5000, disabled: true }]
  });

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
    
    this.initCharts();
  }

  private initCharts() {
    const documentStyle = getComputedStyle(document.documentElement);
    const textColor = documentStyle.getPropertyValue('--mlm-text') || '#000000';
    const textColorSecondary = documentStyle.getPropertyValue('--mlm-secondary') || '#64748b';
    const surfaceBorder = '#f1f5f9';

    // Sales Overview (Line Chart)
    this.salesData = {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      datasets: [
        {
          label: 'Revenue',
          data: [15000, 22000, 18000, 25000, 28000, 35000, 32000, 40000, 45000, 42000, 48000, 55000],
          fill: true,
          borderColor: '#49A321',
          tension: 0.4,
          backgroundColor: 'rgba(73, 163, 33, 0.1)'
        },
        {
          label: 'Sales',
          data: [10000, 15000, 12000, 18000, 20000, 25000, 23000, 28000, 32000, 30000, 35000, 40000],
          fill: false,
          borderColor: '#3b82f6',
          tension: 0.4
        }
      ]
    };

    this.salesOptions = {
      maintainAspectRatio: false,
      aspectRatio: 0.6,
      plugins: {
        legend: {
          labels: {
            color: textColor,
            usePointStyle: true,
            font: { weight: 'bold', size: 11 }
          },
          position: 'bottom'
        }
      },
      scales: {
        x: {
          ticks: { color: textColorSecondary, font: { size: 10 } },
          grid: { color: surfaceBorder, drawBorder: false }
        },
        y: {
          ticks: { color: textColorSecondary, font: { size: 10 } },
          grid: { color: surfaceBorder, drawBorder: false }
        }
      }
    };

    // Traffic Sources (Doughnut)
    this.trafficData = {
      labels: ['Direct', 'Social', 'Referral'],
      datasets: [
        {
          data: [540, 325, 702],
          backgroundColor: ['#49A321', '#3b82f6', '#f59e0b'],
          hoverBackgroundColor: ['#3e8a1c', '#2563eb', '#d97706'],
          borderWidth: 0
        }
      ]
    };

    this.trafficOptions = {
      cutout: '70%',
      plugins: {
        legend: {
          labels: {
            color: textColor,
            usePointStyle: true,
            font: { weight: 'bold', size: 11 }
          },
          position: 'bottom'
        }
      }
    };
  }

  profileCompletion = computed(() => {
    const user = this.currentUser();
    return user?.profileCompletionPercentage ?? 0;
  });

  isLoading = this.loadingService.isLoading;

  navigateToPayment(): void {
    this.showPaymentModal.set(true);
  }

  onPaymentSubmit(): void {
    if (this.paymentForm.valid) {
      this.loadingService.show();
      
      setTimeout(() => {
        this.loadingService.hide();
        const isSuccess = Math.random() > 0.1;
        
        if (isSuccess) {
          this.userService.updatePaymentStatus('PAID');
          this.showPaymentModal.set(false);
          
          // Trigger change detection to update the view
          this.cdr.markForCheck();
          
          setTimeout(() => {
            this.modalService.open(
              'success',
              'Payment Successful',
              'Your registration fee of ₦5,000 has been paid successfully. You now have full access to all features.'
            );
            // Force change detection again after modal
            this.cdr.markForCheck();
          }, 100);
        } else {
          this.modalService.open(
            'error',
            'Payment Failed',
            'Payment processing failed. Please try again or contact support if the problem persists.'
          );
        }
      }, 1500);
    } else {
      this.paymentForm.markAllAsTouched();
    }
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }

  getRankStyle(rank: string | undefined): { bgClass: string; icon: string } {
    if (!rank) {
      return { bgClass: 'bg-mlm-secondary', icon: 'pi-star' };
    }
    
    const rankLower = rank.toLowerCase();
    
    switch (rankLower) {
      case 'silver':
        return { bgClass: 'bg-gradient-to-r from-mlm-secondary to-mlm-secondary/80', icon: 'pi-star' };
      case 'gold':
        return { bgClass: 'bg-gradient-to-r from-brand-gold to-mlm-warning', icon: 'pi-star-fill' };
      case 'platinum':
        return { bgClass: 'bg-gradient-to-r from-mlm-secondary/60 to-mlm-secondary', icon: 'pi-star-fill' };
      case 'ruby':
        return { bgClass: 'bg-gradient-to-r from-mlm-red-500 to-mlm-red-400', icon: 'pi-star-fill' };
      case 'diamond':
        return { bgClass: 'bg-gradient-to-r from-mlm-blue-400 to-mlm-blue-500', icon: 'pi-gem' };
      default:
        return { bgClass: 'bg-gradient-to-r from-brand-gold to-mlm-warning', icon: 'pi-star-fill' };
    }
  }

  formatActivityDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  navigateToActivity(activity: any): void {
    if (activity.route) {
      this.router.navigate([activity.route]);
    }
  }

  getActivityIconClasses(type: string): string {
    switch (type) {
      case 'Earnings Posted':
        return 'bg-mlm-warning/10 text-mlm-warning';
      case 'Wallet Funding':
        return 'bg-mlm-success/10 text-mlm-success';
      case 'Withdrawal':
        return 'bg-mlm-error/10 text-mlm-error';
      case 'Order Placed':
        return 'bg-mlm-blue-50 text-mlm-blue-500';
      default:
        return 'bg-mlm-secondary/10 text-mlm-secondary';
    }
  }

  getStatusBadgeClasses(status: string): string {
    switch (status) {
      case 'Approved':
      case 'Completed':
        return 'bg-mlm-success/10 text-mlm-success';
      case 'Pending':
        return 'bg-mlm-warning/10 text-mlm-warning';
      case 'Rejected':
        return 'bg-mlm-error/10 text-mlm-error';
      default:
        return 'bg-mlm-secondary/10 text-mlm-secondary';
    }
  }
}

