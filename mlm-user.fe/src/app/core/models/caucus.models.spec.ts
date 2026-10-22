import { describe, expect, it } from 'vitest';
import { canSubmitCaucusAppeal, caucusAppealTrimmedLength } from './caucus.models';

describe('caucus appeal validators', () => {
  it('rejects messages shorter than 10 trimmed characters', () => {
    expect(caucusAppealTrimmedLength('   hi   ')).toBe(2);
    expect(canSubmitCaucusAppeal('   hi   ')).toBe(false);
  });

  it('accepts messages between 10 and 2000 characters', () => {
    const msg = 'Please restore my membership.';
    expect(canSubmitCaucusAppeal(msg)).toBe(true);
  });

  it('rejects empty appeal', () => {
    expect(canSubmitCaucusAppeal('')).toBe(false);
  });
});
