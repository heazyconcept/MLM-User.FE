import { Component, ChangeDetectionStrategy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { LegacyClubService } from '../../../services/legacy-club.service';
import { LegacySuccessline } from '../../../core/models/legacy-club.models';

@Component({
  selector: 'app-legacy-successlines',
  imports: [CommonModule, FormsModule, RouterLink, ButtonModule, InputTextModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-mlm-background">
      <main class="py-8">
        <div class="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
      <a routerLink="/legacy" class="text-sm font-medium text-mlm-primary hover:underline">← Legacy Club</a>
      <div>
        <h1 class="text-2xl font-bold text-mlm-text">My Direct Successlines</h1>
        <p class="mt-1 text-sm text-mlm-secondary">
          Level 1 only. These are people placed under you in Legacy Club (automatic or by username).
        </p>
      </div>

      <div class="flex gap-2">
        <input
          pInputText
          class="flex-1"
          placeholder="Search username"
          [(ngModel)]="search"
          (keyup.enter)="load()"
        />
        <p-button label="Search" (onClick)="load()" />
      </div>

      @if (rows().length === 0) {
        <p class="rounded-xl bg-gray-50 px-4 py-8 text-center text-gray-500">
          You have not registered anyone yet.
        </p>
      } @else {
        <div class="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table class="w-full text-left text-sm">
            <thead class="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th class="px-4 py-3">Username</th>
                <th class="px-4 py-3">Package</th>
                <th class="px-4 py-3">Joined</th>
                <th class="px-4 py-3">How</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.username) {
                <tr class="border-t border-gray-50">
                  <td class="px-4 py-3 font-medium text-gray-900">&#64;{{ row.username }}</td>
                  <td class="px-4 py-3">{{ row.package }}</td>
                  <td class="px-4 py-3">{{ row.joinedAt | date: 'mediumDate' }}</td>
                  <td class="px-4 py-3">
                    {{ row.sponsorSource === 'AUTO' ? 'Automatic' : 'Chosen' }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
        </div>
      </main>
    </div>
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
