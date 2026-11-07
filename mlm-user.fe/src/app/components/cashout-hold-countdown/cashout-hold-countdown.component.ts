import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import {
  cashoutHoldCountdownParts,
  isCashoutHoldActive,
} from '../../core/utils/countdown.util';

@Component({
  selector: 'app-cashout-hold-countdown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (holdActive()) {
      <div
        class="rounded-xl border border-sky-200 bg-sky-50/80 px-4 py-3 text-sky-950"
        role="status"
        aria-live="polite"
      >
        <div class="flex items-start gap-3">
          <i class="pi pi-clock mt-0.5 text-sky-700" aria-hidden="true"></i>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-sky-900">{{ title() }}</p>
            @if (parts(); as p) {
              <div
                class="mt-2 flex flex-wrap gap-2 tabular-nums text-sm font-medium text-sky-900"
              >
                @if (p.days > 0) {
                  <span class="rounded-md bg-sky-100/80 px-2 py-1">{{ p.days }}d</span>
                }
                <span class="rounded-md bg-sky-100/80 px-2 py-1">{{ p.hours }}h</span>
                <span class="rounded-md bg-sky-100/80 px-2 py-1">{{ p.minutes }}m</span>
                <span class="rounded-md bg-sky-100/80 px-2 py-1">{{ p.seconds }}s</span>
              </div>
            }
            <p class="mt-2 text-xs text-sky-800">{{ transferNote() }}</p>
          </div>
        </div>
      </div>
    }
  `,
})
export class CashoutHoldCountdownComponent {
  unlocksAt = input<string | null>(null);
  title = input('Withdrawals unlock in');
  transferNote = input('You can still transfer between wallets and to other members.');
  compact = input(false);

  expired = output<void>();

  private tick = signal(0);
  private wasActive = false;

  holdActive = computed(() => {
    this.tick();
    return isCashoutHoldActive(this.unlocksAt());
  });

  parts = computed(() => {
    this.tick();
    const active = isCashoutHoldActive(this.unlocksAt());
    if (this.wasActive && !active) {
      queueMicrotask(() => this.expired.emit());
    }
    this.wasActive = active;
    return cashoutHoldCountdownParts(this.unlocksAt());
  });

  constructor() {
    interval(1000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.tick.update((n) => n + 1));
  }
}
