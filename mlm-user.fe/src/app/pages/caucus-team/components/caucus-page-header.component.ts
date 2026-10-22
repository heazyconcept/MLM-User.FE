import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-caucus-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0">
        @if (backLink(); as link) {
          <a
            [routerLink]="link"
            class="mb-2 inline-flex items-center text-sm font-medium text-mlm-primary transition-colors hover:text-mlm-primary/80">
            ← {{ backLabel() }}
          </a>
        }
        @if (eyebrow()) {
          <p class="text-xs font-bold uppercase tracking-[0.15em] text-mlm-secondary">{{ eyebrow() }}</p>
        }
        <h1 class="text-2xl font-bold text-mlm-text" [class.mt-1]="!!eyebrow()">{{ title() }}</h1>
        @if (subtitle()) {
          <p class="mt-1 text-sm text-mlm-secondary">{{ subtitle() }}</p>
        }
      </div>
      <div class="flex shrink-0 flex-wrap items-center gap-2">
        <ng-content select="[actions]" />
      </div>
    </div>
  `,
})
export class CaucusPageHeaderComponent {
  title = input.required<string>();
  subtitle = input<string>();
  eyebrow = input<string>();
  backLink = input<string>();
  backLabel = input('Back');
}
