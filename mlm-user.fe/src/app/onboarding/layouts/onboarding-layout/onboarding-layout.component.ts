import { Component, inject, computed, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';

interface OnboardingStep {
  id: number;
  label: string;
  sublabel: string;
}

@Component({
  selector: 'app-onboarding-layout',
  imports: [CommonModule, RouterOutlet],
  template: `
    <div class="min-h-screen flex flex-col lg:flex-row overflow-hidden bg-white">
      <!-- LEFT PANEL -->
      <div class="hidden lg:flex lg:w-1/2 flex-shrink-0 flex-col bg-mlm-green-50 relative overflow-hidden p-12 mb-4 lg:p-14">
        <!-- Overlay -->
        <div class="absolute inset-0 bg-mlm-primary/10"></div>

        <!-- Hero Section -->
        <div class="relative z-10 mb-4">
          <h2 class="font-sora text-[clamp(28px,3vw,42px)] font-bold text-slate-900 leading-[1.18] mb-5">
            Build your<br><span class="text-mlm-primary">earning profile</span><br>in minutes.
          </h2>
          <p class="text-[15px] text-slate-600 leading-relaxed max-w-[340px]">
            Complete each step below to unlock your full dashboard — payouts, team tracking, and performance insights.
          </p>
        </div>

        <!-- Steps List -->
        <div class="relative z-10">
          @for (step of steps; track step.id; let first = $first; let last = $last) {
            <div class="flex items-start gap-4 py-3.5" [class.border-t]="!first" [class.border-b]="last" [class.border-slate-300]="true">
              <div 
                class="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-all duration-350 text-[11px] font-semibold"
                [class]="getStepDotClass(step.id)">
                @if (currentStep() > step.id) {
                  <i class="pi pi-check text-xs"></i>
                } @else {
                  {{ step.id }}
                }
              </div>
              <div>
                <div 
                  class="text-[13.5px] font-semibold transition-colors duration-350"
                  [class]="getStepLabelClass(step.id)">
                  {{ step.label }}
                </div>
                <div class="text-[12px] text-slate-500 mt-0.5">
                  {{ step.sublabel }}
                </div>
              </div>
            </div>
          }
        </div>

       
      </div>

      <!-- RIGHT PANEL -->
      <div #rightPanel class="w-full lg:w-1/2 flex flex-col overflow-y-auto bg-white">
        <div class="flex-1 w-full p-12 lg:p-14">
          <!-- Step Pills (Mobile-style progress) -->
          <div class="flex gap-1.5 mb-10">
            @for (step of steps; track step.id) {
              <div 
                class="h-1 rounded-full transition-all duration-400 flex-1"
                [class]="getPillClass(step.id)">
              </div>
            }
          </div>

          <!-- Form Content -->
          <router-outlet></router-outlet>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      font-family: 'DM Sans', sans-serif;
    }
    

    /* ── Shared Onboarding Form Styles ── */
    
    /* Form Header */
    .form-header {
      margin-bottom: 32px;
    }
    
    .page-header-accent {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 4px;
    }
    
    .accent-bar {
      width: 4px;
      height: 30px;
      background: #49A321;
      border-radius: 99px;
      flex-shrink: 0;
    }
    
    .page-title {
      font-family: 'Sora', sans-serif;
      font-size: clamp(22px, 3vw, 30px);
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.5px;
      line-height: 1.1;
    }
    
    .page-sub {
      font-size: 14px;
      color: #64748b;
      margin-left: 16px;
      padding-left: 2px;
      margin-top: 4px;
    }

    /* Section Labels */
    .section-label {
      font-size: 10.5px;
      font-weight: 700;
      color: #94a3b8;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      margin-bottom: 10px;
    }

    /* Field Card */
    .field-card {
      background: linear-gradient(135deg, #f9f8f6 0%, #faf9f7 100%);
      border: 1px solid #ede9e3;
      border-radius: 18px;
      padding: 18px;
      margin-bottom: 20px;
    }

    /* Form Fields */
    .field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .field label {
      font-size: 0.8rem;
      font-weight: 600;
      color: #64748b;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .field label .req {
      color: #e53e3e;
      font-size: 0.9em;
    }

    .field label .opt {
      font-size: 11px;
      font-weight: 400;
      color: #94a3b8;
    }

    .field-group {
      margin-bottom: 16px;
    }

    .field-group:last-child {
      margin-bottom: 0;
    }

    .input-wrap {
      position: relative;
    }

    .field-input {
      width: 100%;
      height: 50px;
      padding: 0 16px;
      border: 1.5px solid #ede9e3;
      border-radius: 12px;
      font-family: 'DM Sans', sans-serif;
      font-size: 0.9rem;
      color: #0f172a;
      background: #f9f8f6;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
    }

    .field-input:focus {
      border-color: #49A321;
      background: white;
      box-shadow: 0 0 0 3px rgba(73, 163, 33, 0.1);
    }

    .field-input::placeholder {
      color: #c0b9b0;
    }

    .field-input.ng-invalid.ng-touched {
      border-color: #e53e3e;
    }

    /* Select */
    .field-select {
      width: 100%;
      height: 50px;
      padding: 0 16px;
      border: 1.5px solid #ede9e3;
      border-radius: 12px;
      font-family: 'DM Sans', sans-serif;
      font-size: 0.9rem;
      color: #0f172a;
      background: #f9f8f6;
      outline: none;
      cursor: pointer;
      transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
    }

    .field-select:focus {
      border-color: #49A321;
      background-color: white;
      box-shadow: 0 0 0 3px rgba(73, 163, 33, 0.1);
    }

    /* Form Stack */
    .form-stack {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    /* Action Area */
    .action-area {
      margin-top: auto;
      padding-top: 32px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    /* Buttons */
    .btn-primary {
      width: 100%;
      height: 52px;
      background: #49A321;
      color: white;
      border: none;
      border-radius: 14px;
      font-family: 'Sora', sans-serif;
      font-size: 0.95rem;
      font-weight: 700;
      cursor: pointer;
      letter-spacing: 0.3px;
      box-shadow: 0 8px 24px rgba(73, 163, 33, 0.3);
      transition: transform 0.15s, box-shadow 0.15s, background 0.15s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .btn-primary:hover:not(:disabled) {
      background: #3d8a1c;
      transform: translateY(-1px);
      box-shadow: 0 12px 28px rgba(73, 163, 33, 0.35);
    }

    .btn-primary:active:not(:disabled) {
      transform: translateY(0);
    }

    .btn-primary:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .btn-back {
      background: none;
      border: none;
      color: #64748b;
      font-weight: 600;
      cursor: pointer;
      font-size: 0.85rem;
      font-family: 'DM Sans', sans-serif;
      padding: 0;
      transition: color 0.2s;
    }

    .btn-back:hover {
      color: #49A321;
    }

    .footer-link {
      text-align: center;
      font-size: 0.85rem;
      color: #94a3b8;
    }

    .footer-link button {
      background: none;
      border: none;
      color: #64748b;
      font-weight: 600;
      cursor: pointer;
      font-size: 0.85rem;
      font-family: 'DM Sans', sans-serif;
      padding: 0;
      transition: color 0.2s;
    }

    .footer-link button:hover {
      color: #49A321;
    }

    /* Field Grid */
    .field-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    /* Error Messages */
    .field-error {
      font-size: 11px;
      font-weight: 600;
      color: #e53e3e;
      margin-top: 5px;
    }
  `]
})
export class OnboardingLayoutComponent implements AfterViewInit, OnDestroy {
  private router = inject(Router);
  @ViewChild('rightPanel', { static: false }) rightPanelRef!: ElementRef<HTMLDivElement>;
  private navigationSubscription?: Subscription;

  steps: OnboardingStep[] = [
    { id: 1, label: 'Personal Information', sublabel: 'Name, DOB, profile photo' },
    { id: 2, label: 'Contact Details', sublabel: 'Phone, email, address' },
    { id: 3, label: 'Identity Verification', sublabel: 'ID document & selfie' },
    { id: 4, label: 'Bank Details', sublabel: 'Payout account info' },
    { id: 5, label: 'Preferences', sublabel: 'Language, currency, alerts' }
  ];

  currentStep = toSignal(
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      map(event => this.getStepFromUrl((event as NavigationEnd).urlAfterRedirects)),
      startWith(this.getStepFromUrl(this.router.url))
    ),
    { initialValue: 1 }
  );

  private getStepFromUrl(url: string): number {
    if (url.includes('profile')) return 1;
    if (url.includes('contact')) return 2;
    if (url.includes('identity')) return 3;
    if (url.includes('bank')) return 4;
    if (url.includes('preferences')) return 5;
    return 1;
  }

  getStepDotClass(stepId: number): string {
    const step = this.currentStep();
    if (step > stepId) {
      return 'bg-mlm-primary/20 border-2 border-mlm-primary text-mlm-primary';
    } else if (step === stepId) {
      return 'bg-mlm-primary border-2 border-mlm-primary text-white shadow-[0_0_0_6px_rgba(73,163,33,0.18)]';
    } else {
      return 'bg-white border-[1.5px] border-slate-300 text-slate-400';
    }
  }

  getStepLabelClass(stepId: number): string {
    const step = this.currentStep();
    if (step > stepId) {
      return 'text-mlm-primary';
    } else if (step === stepId) {
      return 'text-slate-900';
    } else {
      return 'text-slate-500';
    }
  }

  getPillClass(stepId: number): string {
    const step = this.currentStep();
    if (step === stepId) {
      return 'bg-mlm-primary flex-[2]';
    } else if (step > stepId) {
      return 'bg-mlm-primary/40';
    } else {
      return 'bg-mlm-warm-200';
    }
  }

  ngAfterViewInit(): void {
    // Subscribe to navigation events and scroll to top when navigating between onboarding steps
    this.navigationSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event) => {
      const navEvent = event as NavigationEnd;
      // Only scroll if navigating within onboarding routes
      if (navEvent.urlAfterRedirects.startsWith('/onboarding/') && this.rightPanelRef?.nativeElement) {
        setTimeout(() => {
          this.rightPanelRef.nativeElement.scrollTo({ top: 0, behavior: 'smooth' });
        }, 0);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.navigationSubscription) {
      this.navigationSubscription.unsubscribe();
    }
  }
}
