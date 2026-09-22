import { describe, expect, it } from 'vitest';
import {
  cyclePeriodCount,
  cycleProgressLabel,
  isWeeklyCycle,
  periodColumnHeader,
  periodLabel,
} from './legacy-cycle.util';

describe('legacy-cycle.util', () => {
  describe('cyclePeriodCount', () => {
    it('uses cycleWeeks when present', () => {
      expect(cyclePeriodCount({ cycleMonths: 6, cycleWeeks: 24 })).toBe(24);
    });

    it('derives weeks from cycleMonths when cycleWeeks is absent', () => {
      expect(cyclePeriodCount({ cycleMonths: 6 })).toBe(24);
    });

    it('defaults to 24 when cycle is missing', () => {
      expect(cyclePeriodCount(null)).toBe(24);
      expect(cyclePeriodCount(undefined)).toBe(24);
    });
  });

  describe('isWeeklyCycle', () => {
    it('is true only when cycleWeeks is a positive number', () => {
      expect(isWeeklyCycle({ cycleMonths: 6, cycleWeeks: 24 })).toBe(true);
      expect(isWeeklyCycle({ cycleMonths: 6 })).toBe(false);
      expect(isWeeklyCycle(null)).toBe(false);
    });
  });

  describe('periodLabel', () => {
    it('labels weeks when cycleWeeks is present', () => {
      expect(periodLabel(3, { cycleMonths: 6, cycleWeeks: 24 })).toBe('Week 3');
    });

    it('falls back to Month when weekly fields are absent', () => {
      expect(periodLabel(2, { cycleMonths: 6 })).toBe('Month 2');
    });
  });

  describe('periodColumnHeader', () => {
    it('returns Week or Month based on cycleWeeks', () => {
      expect(periodColumnHeader({ cycleMonths: 6, cycleWeeks: 24 })).toBe('Week');
      expect(periodColumnHeader({ cycleMonths: 6 })).toBe('Month');
    });
  });

  describe('cycleProgressLabel', () => {
    it('formats weekly progress', () => {
      expect(cycleProgressLabel(3, { cycleMonths: 6, cycleWeeks: 24 })).toBe('3 of 24 weeks');
    });

    it('formats monthly progress when weekly is absent', () => {
      expect(cycleProgressLabel(2, { cycleMonths: 6 })).toBe('2 of 6 months');
    });
  });
});
