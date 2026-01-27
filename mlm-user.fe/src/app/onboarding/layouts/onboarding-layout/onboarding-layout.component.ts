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
    <div class="flex items-center justify-center min-h-screen min-w-screen p-4 bg-linear-to-br from-slate-50 via-white to-slate-100" style="background-image: radial-gradient(circle at 20% 80%, rgba(73, 163, 33, 0.03) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(73, 163, 33, 0.03) 0%, transparent 50%)">
      <div class="flex flex-col items-center justify-center w-full max-w-[600px] animate-fade-in">
        
        <app-onboarding-stepper [currentStep]="currentStep()"></app-onboarding-stepper>

        <div class="w-full" style="border-radius: 56px; padding: 0.3rem; background: linear-gradient(180deg, var(--primary-color) 10%, rgba(33, 150, 243, 0) 30%)">
          <div class="w-full bg-white py-10 px-8 sm:px-12" style="border-radius: 53px">
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

