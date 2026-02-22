import { Component, inject, signal, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { SelectModule } from 'primeng/select';
import { countries } from 'countries-list';
import { OnboardingService } from '../../../services/onboarding.service';
import { UserService } from '../../../services/user.service';
import { ModalService } from '../../../services/modal.service';

@Component({
  selector: 'app-contact-details',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    SelectModule
  ],
  templateUrl: './contact-details.component.html',
  styleUrl: './contact-details.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContactDetailsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private onboardingService = inject(OnboardingService);
  private userService = inject(UserService);
  private modalService = inject(ModalService);


  isLoading = signal<boolean>(false);

  countriesList = Object.values(countries)
    .map(country => ({ label: country.name, value: country.name }))
    .sort((a, b) => a.label.localeCompare(b.label));

  contactForm = this.fb.group({
    email: [{ value: '', disabled: true }],
    phone: ['', [Validators.required]],
    address: ['', [Validators.required]],
    city: ['', [Validators.required]],
    state: ['', [Validators.required]],
    country: ['', [Validators.required]]
  });

  ngOnInit(): void {
    const user = this.userService.currentUser();
    if (user) {
      const u = user as unknown as Record<string, unknown>;
      this.contactForm.patchValue({
        email: user.email ?? '',
        phone: String(user.phoneNumber ?? u['phone'] ?? ''),
        address: user.address ?? '',
        city: String(u['city'] ?? ''),
        state: String(u['state'] ?? ''),
        country: String(u['country'] ?? '')
      });
    }
  }

  onSubmit(): void {
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      return;
    }

    const value = this.contactForm.getRawValue();
    const payload = {
      phone: value.phone ?? undefined,
      address: value.address ?? undefined,
      city: value.city ?? undefined,
      state: value.state ?? undefined,
      country: value.country ?? undefined
    };

    this.isLoading.set(true);
    this.onboardingService.updateProfile(payload).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.userService.fetchProfile().subscribe({
          next: () => this.router.navigate(['/onboarding/identity']),
          error: () => this.router.navigate(['/onboarding/identity'])
        });
      },
      error: () => {
        this.isLoading.set(false);
        if (typeof ngDevMode !== 'undefined' && ngDevMode) {
          console.error('Contact update failed');
        }
        this.modalService.open(
          'error',
          'Could not save',
          'We couldn\'t save your contact details. Please try again.'
        );
      }
    });
  }
}
