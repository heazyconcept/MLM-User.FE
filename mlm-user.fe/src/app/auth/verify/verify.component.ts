import { Component, inject, signal, OnDestroy, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { LoadingService } from '../../services/loading.service';
import { ModalService } from '../../services/modal.service';

@Component({
  selector: 'app-verify',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    ButtonModule
  ],
  templateUrl: './verify.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VerifyComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private modalService = inject(ModalService);
  
  isLoading = signal<boolean>(false);

  otpForm = this.fb.group({
    otp: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]]
  });

  countdown = signal<number>(30);
  private timer: any;

  ngOnInit() {
    this.startTimer();
  }

  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  startTimer() {
    this.countdown.set(30);
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (this.countdown() > 0) {
        this.countdown.update(c => c - 1);
      } else {
        clearInterval(this.timer);
      }
    }, 1000);
  }

  resendCode() {
    if (this.countdown() === 0) {
      this.startTimer();
      // Simulated resend behavior
    }
  }

  onOtpInput(event: any) {
    const value = event.target.value;
    // Only allow numbers and max 6 chars
    event.target.value = value.replace(/\D/g, '').substring(0, 6);
    this.otpForm.get('otp')?.setValue(event.target.value);
  }

  onSubmit() {
    if (this.otpForm.valid) {
      this.isLoading.set(true);
      // Simulated 1.5s delay
      setTimeout(() => {
        this.isLoading.set(false);
        this.modalService.open(
          'success',
          'Verification Successful',
          'Your account has been verified. Let\'s set up your profile.',
          '/onboarding/profile'
        );
        setTimeout(() => {
          this.router.navigate(['/onboarding/profile']);
        }, 2000);
      }, 1500);
    }
  }
}