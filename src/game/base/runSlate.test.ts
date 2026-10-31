import { describe, expect, it } from 'vitest';
import { RUN_WORTH_CHALKING, slateWords, strikeAt, worthChalking } from './runSlate';

describe('the slate by the runner', () => {
  it('is for a run, and one raid out is a raid', () => {
    expect(worthChalking(0)).toBe(false);
    expect(worthChalking(RUN_WORTH_CHALKING - 1)).toBe(false);
    expect(worthChalking(RUN_WORTH_CHALKING)).toBe(true);
    expect(slateWords(3)).toBe('3 OUT');
  });

  it('is struck through after the groan has started, stays up to be seen, and is wiped', () => {
    expect(strikeAt(0)).toBe(0);
    const shares: number[] = [];
    let ms = 0;
    for (; strikeAt(ms) !== null; ms += 50) {
      shares.push(strikeAt(ms)!);
    }
    expect(shares.at(-1)).toBe(1);
    expect(ms).toBeGreaterThan(3000);
    expect([...shares].sort((a, b) => a - b)).toEqual(shares);
    expect(strikeAt(ms + 1000)).toBeNull();
  });
});
