import { Component, ChangeDetectionStrategy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { LegacyClubService } from '../../../services/legacy-club.service';
import { LegacySuccessline } from '../../../core/models/legacy-club.models';
import { LegacyPageShellComponent } from '../components/legacy-page-shell.component';
import { LegacyPageHeaderComponent } from '../components/legacy-page-header.component';
import { LegacyPanelComponent } from '../components/legacy-panel.component';

@Component({
  selector: 'app-legacy-successlines',
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    LegacyPageShellComponent,
    LegacyPageHeaderComponent,
    LegacyPanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-legacy-page-shell>
      <app-legacy-page-header
        title="My Direct Successlines"
        subtitle="Level 1 only. These are people placed under you in Legacy Club (automatic or by username)."
        backLink="/legacy"
        backLabel="Legacy Club"
      />

      <div class="flex flex-col gap-6">
        <app-legacy-panel>
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              pInputText
              class="w-full flex-1"
              placeholder="Search username"
              [(ngModel)]="search"
              (keyup.enter)="load()"
            />
            <p-button label="Search" styleClass="w-full sm:w-auto" (onClick)="load()" />
          </div>
        </app-legacy-panel>

        @if (rows().length === 0) {
          <app-legacy-panel>
            <div class="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <i class="pi pi-users text-2xl text-mlm-secondary/50"></i>
              <p class="text-sm font-medium text-mlm-text">No Successlines yet</p>
              <p class="max-w-sm text-sm text-mlm-secondary">
                You have not registered anyone yet. When someone joins under you in Legacy Club, they
                will show up here.
              </p>
            </div>
          </app-legacy-panel>
        } @else {
          <div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table class="w-full text-left text-sm">
              <thead class="border-b border-gray-100 bg-gray-50 text-xs uppercase text-mlm-secondary">
                <tr>
                  <th class="px-5 py-4 font-semibold sm:px-6">Username</th>
                  <th class="px-5 py-4 font-semibold sm:px-6">Package</th>
                  <th class="px-5 py-4 font-semibold sm:px-6">Joined</th>
                  <th class="px-5 py-4 font-semibold sm:px-6">How</th>
                </tr>
              </thead>
              <tbody>
                @for (row of rows(); track row.username) {
                  <tr class="border-t border-gray-50">
                    <td class="px-5 py-3 font-medium text-mlm-text sm:px-6">
                      &#64;{{ row.username }}
                    </td>
                    <td class="px-5 py-3 sm:px-6">{{ row.package }}</td>
                    <td class="px-5 py-3 sm:px-6">{{ row.joinedAt | date: 'mediumDate' }}</td>
                    <td class="px-5 py-3 sm:px-6">
                      {{ row.sponsorSource === 'AUTO' ? 'Automatic' : 'Chosen' }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </app-legacy-page-shell>
  `,
})
export class LegacySuccesslinesComponent implements OnInit {
  private legacyClub = inject(LegacyClubService);
  private router = inject(Router);

  rows = signal<LegacySuccessline[]>([]);
  search = '';

  ngOnInit(): void {
    this.legacyClub.loadMe().subscribe({
      next: (me) => {
        if (me?.status !== 'ACTIVE') {
          void this.router.navigate(['/legacy']);
          return;
        }
        this.load();
      },
    });
  }

  load(): void {
    this.legacyClub.getSuccesslines(1, 50, this.search).subscribe({
      next: (res) => this.rows.set(res.successlines),
    });
  }
}
