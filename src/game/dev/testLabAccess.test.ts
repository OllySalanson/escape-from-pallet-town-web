import { describe, expect, it } from 'vitest';
import { isTestLabRequested } from './testLabAccess';

describe('Test Lab access guard', () => {
  it('allows the direct route only in a development build', () => {
    expect(isTestLabRequested(true, '?test-lab=1')).toBe(true);
    expect(isTestLabRequested(true, '')).toBe(false);
    expect(isTestLabRequested(false, '?test-lab=1')).toBe(false);
  });
});
