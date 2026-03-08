import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-referral-redirect',
  standalone: true,
  templateUrl: './referral-redirect.component.html'
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
