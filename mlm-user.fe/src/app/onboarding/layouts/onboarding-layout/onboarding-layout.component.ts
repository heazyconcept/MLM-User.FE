import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { StepperComponent } from '../../components/stepper/stepper.component';
import { filter, map, startWith } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-onboarding-layout',
  imports: [CommonModule, RouterOutlet, StepperComponent],
  template: `
    <div class="min-h-screen w-full flex items-center justify-center px-4 py-8 bg-mlm-background">
      <div class="w-full max-w-2xl">
        <app-onboarding-stepper [currentStep]="currentStep()"></app-onboarding-stepper>

        <div class="bg-white rounded-2xl shadow-sm border border-mlm-warm-200 overflow-hidden">
          <div class="p-6 sm:p-8 lg:p-10">
            <router-outlet></router-outlet>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class OnboardingLayoutComponent {
  private router = inject(Router);

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
}

