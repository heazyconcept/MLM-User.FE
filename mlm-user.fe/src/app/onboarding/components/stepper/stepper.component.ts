import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface OnboardingStep {
  label: string;
  id: number;
}

@Component({
  selector: 'app-onboarding-stepper',
  imports: [CommonModule],
  template: `
    <div class="mb-10">
      <div class="flex items-center justify-between mb-4 px-1 sm:px-2">
        @for (step of steps(); track step.id) {
          <div class="flex flex-col items-center gap-2 sm:gap-3 relative z-10">
            <div
              [class]="currentStep() >= step.id ? 'bg-mlm-primary text-white shadow-sm' : 'bg-white text-mlm-warm-400 border border-mlm-warm-200'"
              class="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-semibold text-xs sm:text-sm transition-all duration-300">
              @if (currentStep() > step.id) {
                <i class="pi pi-check text-xs"></i>
              } @else {
                {{ step.id }}
              }
            </div>
            <span
              class="text-[10px] sm:text-xs font-medium tracking-wide uppercase transition-colors duration-300"
              [class]="currentStep() >= step.id ? 'text-mlm-warm-800' : 'text-mlm-warm-400'">
              {{ step.label }}
            </span>
          </div>
        }
      </div>
      <div class="relative -mt-6 sm:-mt-[38px] px-10 sm:px-12 h-px w-full bg-mlm-warm-200 rounded-full">
        <div
          class="absolute h-full bg-mlm-primary transition-all duration-300 ease-out rounded-full"
          [style.width]="((currentStep() - 1) / (steps().length - 1) * 100) + '%'">
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class StepperComponent {
  steps = input<OnboardingStep[]>([
    { id: 1, label: 'Personal' },
    { id: 2, label: 'Contact' },
    { id: 3, label: 'Identity' },
    { id: 4, label: 'Bank' },
    { id: 5, label: 'Preferences' }
  ]);
  currentStep = input<number>(1);
}

