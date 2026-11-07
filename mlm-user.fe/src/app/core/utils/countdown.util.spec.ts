import { describe, expect, it } from 'vitest';
import {
  cashoutHoldCountdownLabel,
  isCashoutHoldActive,
} from './countdown.util';

describe('countdown.util', () => {
  it('detects active hold before unlock instant', () => {
    const now = new Date('2026-11-01T00:00:00.000Z');
    const unlocksAt = '2026-11-08T00:00:00.000Z';
    expect(isCashoutHoldActive(unlocksAt, now)).toBe(true);
    expect(cashoutHoldCountdownLabel(unlocksAt, now)).toContain('d');
  });

  it('returns null after hold ends', () => {
    const now = new Date('2026-11-09T00:00:00.000Z');
    const unlocksAt = '2026-11-08T00:00:00.000Z';
    expect(isCashoutHoldActive(unlocksAt, now)).toBe(false);
    expect(cashoutHoldCountdownLabel(unlocksAt, now)).toBeNull();
  });
});
