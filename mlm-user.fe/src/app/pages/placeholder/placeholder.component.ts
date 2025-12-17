import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'app-placeholder',
  imports: [CommonModule, CardModule],
  template: `
    <div class="min-h-screen bg-mlm-background">
      <main class="py-10 lg:pl-72">
        <div class="px-4 sm:px-6 lg:px-8">
          <h1 class="text-3xl font-bold text-mlm-text mb-6">{{ title }}</h1>
          <p-card [header]="title">
            <p class="text-mlm-secondary">{{ title }} page coming soon...</p>
          </p-card>
        </div>
      </main>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlaceholderComponent {
  private route = inject(ActivatedRoute);
  title = this.route.snapshot.data['title'] || 'Page';
}

