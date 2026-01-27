import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { AuthInputComponent } from '../../../auth/components/auth-input/auth-input.component';

@Component({
  selector: 'app-contact-details',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    ButtonModule,
    AuthInputComponent
  ],
  templateUrl: './contact-details.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContactDetailsComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);

  isLoading = signal<boolean>(false);

  contactForm = this.fb.group({
    email: [{ value: 'user@example.com', disabled: true }],
    phone: ['', [Validators.required]],
    address: ['', [Validators.required]],
    city: ['', [Validators.required]],
    state: ['', [Validators.required]],
    country: ['', [Validators.required]]
  });

  onSubmit() {
    if (this.contactForm.valid) {
      this.isLoading.set(true);
      setTimeout(() => {
        this.isLoading.set(false);
        this.router.navigate(['/onboarding/identity']);
      }, 1000);
    } else {
      this.contactForm.markAllAsTouched();
    }
  }
}

