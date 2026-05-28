import { Component, ChangeDetectionStrategy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { switchMap } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-impersonate',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './impersonate.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImpersonateComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);
  private userService = inject(UserService);

  isLoading = signal(true);
  errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    const code = this.route.snapshot.queryParamMap.get('code') ?? '';

    if (!code) {
      this.isLoading.set(false);
      this.errorMessage.set('Missing impersonation code.');
      return;
    }

    this.authService
      .exchangeImpersonation(code)
      .pipe(switchMap(() => this.userService.fetchProfile()))
      .subscribe({
        next: () => {
          if (typeof window !== 'undefined') {
            window.history.replaceState({}, '', '/impersonate');
          }
          this.router.navigate(['/dashboard']);
        },
      error: (err: { status?: number }) => {
        this.isLoading.set(false);
        if (err?.status === 400) {
          this.errorMessage.set('Link expired or invalid.');
          return;
        }
        this.errorMessage.set('Unable to start impersonation. Please try again.');
      },
    });
  }
}
