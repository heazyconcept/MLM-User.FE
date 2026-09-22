import { Component, ChangeDetectionStrategy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { LegacyClubService } from '../../../services/legacy-club.service';
import { LegacyPageShellComponent } from '../components/legacy-page-shell.component';

@Component({
  selector: 'app-legacy-gate',
  imports: [ProgressSpinnerModule, LegacyPageShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-legacy-page-shell>
      <div class="flex min-h-[40vh] flex-col items-center justify-center gap-4 py-16">
        <p-progressSpinner strokeWidth="4" styleClass="h-12 w-12" />
        <p class="text-sm text-mlm-secondary">Loading Legacy Club…</p>
      </div>
    </app-legacy-page-shell>
  `,
})
export class LegacyGateComponent implements OnInit {
  private legacyClub = inject(LegacyClubService);
  private router = inject(Router);

  ngOnInit(): void {
    this.legacyClub.loadMe().subscribe({
      next: (me) => {
        if (!me) {
          void this.router.navigate(['/dashboard']);
          return;
        }
        void this.router.navigateByUrl(this.legacyClub.legacyHomePath(), { replaceUrl: true });
      },
      error: () => {
        void this.router.navigate(['/dashboard']);
      },
    });
  }
}
