import { describe, expect, it } from 'vitest';
import { createSeededRng } from './rng';

describe('seeded RNG', () => {
  it('repeats its sequence for the same seed', () => {
    const first = createSeededRng(42);
    const second = createSeededRng(42);

    expect([first.next(), first.int(2, 8), first.chance(0.5), first.pick(['a', 'b', 'c'])])
      .toEqual([second.next(), second.int(2, 8), second.chance(0.5), second.pick(['a', 'b', 'c'])]);
  });

  it('produces a different sequence for a different seed', () => {
    const first = createSeededRng(42);
    const second = createSeededRng(43);

    expect([first.next(), first.next(), first.next()])
      .not.toEqual([second.next(), second.next(), second.next()]);
  });
});
