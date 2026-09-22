import { Component, ChangeDetectionStrategy, OnInit, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { LegacyClubService } from '../../../services/legacy-club.service';
import { LegacyPageShellComponent } from '../components/legacy-page-shell.component';
import { LegacyPanelComponent } from '../components/legacy-panel.component';

@Component({
  selector: 'app-legacy-success',
  imports: [CommonModule, RouterLink, ButtonModule, LegacyPageShellComponent, LegacyPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-legacy-page-shell>
      <div class="mx-auto max-w-xl">
        <app-legacy-panel>
          <div class="space-y-6 py-4 text-center">
            <div
              class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"
            >
              <i class="pi pi-check text-3xl"></i>
            </div>
            <div>
              <h1 class="text-2xl font-bold text-mlm-text">Payment complete</h1>
            </div>
            <p class="text-sm leading-relaxed text-mlm-secondary">{{ body() }}</p>
            <div class="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <a routerLink="/legacy/home">
                <p-button label="Go to Legacy Club" styleClass="w-full sm:w-auto" />
              </a>
              <a routerLink="/legacy/account">
                <p-button
                  label="Open Legacy account"
                  [outlined]="true"
                  styleClass="w-full sm:w-auto"
                />
              </a>
            </div>
          </div>
        </app-legacy-panel>
      </div>
    </app-legacy-page-shell>
  `,
})
export class LegacySuccessComponent implements OnInit {
  private legacyClub = inject(LegacyClubService);
  me = this.legacyClub.me;

  body = computed(
    () =>
      'Your Legacy marketplace order is complete. Weekly membership commission continues to drop automatically — shopping does not unlock extra commission.',
  );

  ngOnInit(): void {
    this.legacyClub.loadMe().subscribe();
  }
}
