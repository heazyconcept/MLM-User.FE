import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-caucus-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-3">
      <div class="flex items-baseline justify-between gap-3">
        <p class="text-lg font-bold tabular-nums text-mlm-text">{{ count() }} of {{ target() }} people</p>
        <p class="text-xs font-medium text-mlm-secondary">Direct Legacy joins this month</p>
      </div>
      <div
        class="relative h-3 overflow-hidden rounded-full bg-gray-200"
        role="progressbar"
        [attr.aria-valuenow]="count()"
        [attr.aria-valuemin]="0"
        [attr.aria-valuemax]="target()">
        <div
          class="absolute inset-y-0 left-0 rounded-full bg-mlm-primary transition-all duration-300"
          [style.width.%]="barPercent()"></div>
        <div
          class="absolute top-0 bottom-0 w-0.5 bg-gray-600/70"
          [style.left.%]="floorPercent()"
          aria-hidden="true"></div>
        <div
          class="absolute top-0 bottom-0 w-0.5 bg-mlm-primary/50"
          [style.left.%]="100"
          aria-hidden="true"></div>
      </div>
      <div class="flex justify-between text-xs font-medium text-mlm-secondary">
        <span>Minimum {{ floor() }}</span>
        <span>Target {{ target() }}</span>
      </div>
    </div>
  `,
})
export class CaucusProgressComponent {
  count = input.required<number>();
  floor = input(10);
  target = input(30);

  barPercent = computed(() => {
    const t = this.target();
    if (t <= 0) {
      return 0;
    }
    if (this.count() <= 0) {
      return 0;
    }
    return Math.min(100, (this.count() / t) * 100);
  });

  floorPercent = computed(() => {
    const t = this.target();
    return t > 0 ? (this.floor() / t) * 100 : 0;
  });
}
