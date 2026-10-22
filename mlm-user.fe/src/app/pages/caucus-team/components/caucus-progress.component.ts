import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-caucus-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-2">
      <div class="flex justify-between text-sm text-mlm-text">
        <span>{{ count() }} of {{ target() }} people</span>
      </div>
      <div class="relative h-3 rounded-full bg-slate-100 overflow-hidden">
        <div
          class="absolute inset-y-0 left-0 rounded-full bg-mlm-primary transition-all"
          [style.width.%]="barPercent()"></div>
        <div
          class="absolute top-0 bottom-0 w-0.5 bg-slate-400/80"
          [style.left.%]="floorPercent()"
          aria-hidden="true"></div>
        <div
          class="absolute top-0 bottom-0 w-0.5 bg-mlm-primary/40"
          [style.left.%]="targetPercent()"
          aria-hidden="true"></div>
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
    return Math.min(100, (this.count() / t) * 100);
  });

  floorPercent = computed(() => {
    const t = this.target();
    return t > 0 ? (this.floor() / t) * 100 : 0;
  });

  targetPercent = computed(() => 100);
}
