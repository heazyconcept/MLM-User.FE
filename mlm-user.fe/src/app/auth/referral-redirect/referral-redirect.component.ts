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
    const username = this.route.snapshot.paramMap.get('code');
    if (username) {
      localStorage.setItem('referralUsername', username);
    }
    this.router.navigate(['/auth/register'], { replaceUrl: true });
  }
}
