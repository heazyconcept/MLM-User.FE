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
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);

  isPaid = this.userService.isPaid;
  currentUser = this.userService.currentUser;
  paymentStatus = this.userService.paymentStatus;
  
  ngnSummary = this.commissionService.getSummary('NGN');
  usdSummary = this.commissionService.getSummary('USD');

  ngnWallet = this.walletService.getWallet('NGN');
  usdWallet = this.walletService.getWallet('USD');

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
          
          setTimeout(() => {
            this.modalService.open(
              'success',
              'Payment Successful',
              'Your registration fee of ₦5,000 has been paid successfully. You now have full access to all features.'
            );
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
}

