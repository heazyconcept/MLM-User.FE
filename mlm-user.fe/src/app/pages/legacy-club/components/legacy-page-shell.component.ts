import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-legacy-page-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-mlm-background">
      <main class="py-10">
        <div class="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
          <ng-content />
        </div>
      </main>
    </div>
  `,
})
export class LegacyPageShellComponent {}
