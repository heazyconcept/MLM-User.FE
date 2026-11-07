import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { CashoutHoldCountdownComponent } from './cashout-hold-countdown.component';

describe('CashoutHoldCountdownComponent', () => {
  it('renders countdown status when hold is active', () => {
    const unlocksAt = new Date(Date.now() + 90_000).toISOString();

    TestBed.configureTestingModule({
      imports: [CashoutHoldCountdownComponent],
    });

    const fixture = TestBed.createComponent(CashoutHoldCountdownComponent);
    fixture.componentRef.setInput('unlocksAt', unlocksAt);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[role="status"]')).toBeTruthy();
    expect(host.textContent).toContain('Withdrawals unlock in');
  });

  it('emits expired when countdown completes', () => {
    vi.useFakeTimers();
    const unlocksAt = new Date(Date.now() + 1500).toISOString();

    TestBed.configureTestingModule({
      imports: [CashoutHoldCountdownComponent],
    });

    const fixture = TestBed.createComponent(CashoutHoldCountdownComponent);
    const expired = vi.fn();
    fixture.componentInstance.expired.subscribe(expired);
    fixture.componentRef.setInput('unlocksAt', unlocksAt);
    fixture.detectChanges();

    vi.advanceTimersByTime(2000);
    fixture.detectChanges();

    expect(expired).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
