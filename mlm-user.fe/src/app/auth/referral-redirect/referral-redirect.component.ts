import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-referral-redirect',
  standalone: true,
  template: `<div class="flex items-center justify-center min-h-screen"><p class="text-slate-500">Redirecting…</p></div>`
})
export class ReferralRedirectComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  constructor() {
    const code = this.route.snapshot.paramMap.get('code');
    if (code) {
      localStorage.setItem('referralCode', code);
    }
    this.router.navigate(['/auth/register'], { replaceUrl: true });
  }
}
