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
    <div class="w-full max-w-2xl mx-auto mb-12">
      <div class="flex items-start justify-between relative">
        <!-- Connector Line (Background) -->
        <div class="absolute top-[18px] left-0 right-0 h-0.5 bg-slate-200 rounded-full mx-6">
          <div class="absolute h-full bg-mlm-primary transition-all duration-500 ease-out rounded-full"
               [style.width]="((currentStep() - 1) / (steps().length - 1) * 100) + '%'">
          </div>
        </div>

        @for (step of steps(); track step.id) {
          <div class="flex flex-col items-center flex-1 relative z-10">
            <!-- Step Circle -->
            <div [class]="currentStep() >= step.id ? 'bg-mlm-primary text-white border-mlm-primary shadow-md shadow-mlm-primary/20' : 'bg-white text-slate-400 border-slate-300'"
                 class="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all duration-500 mb-3">
              @if (currentStep() > step.id) {
                <i class="pi pi-check text-xs"></i>
              } @else {
                {{ step.id }}
              }
            </div>
            
            <!-- Step Label -->
            <span class="text-[10px] font-extrabold uppercase tracking-[0.05em] text-center px-1 transition-colors duration-300"
                  [class]="currentStep() >= step.id ? 'text-slate-800' : 'text-slate-400'">
              {{ step.label }}
            </span>
          </div>
        }
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

