/** A compact deterministic PRNG for generating reproducible raid plans. */
export interface SeededRng {
  next(): number;
  int(minInclusive: number, maxInclusive: number): number;
  chance(probability: number): boolean;
  pick<T>(values: readonly T[]): T;
  shuffle<T>(values: readonly T[]): T[];
}

/**
 * Where each stream has got to, by stream, so a raid in progress can be written
 * down and taken up again on the very same rolls (`run/raidResume.ts`). Kept
 * beside the streams rather than on them, so `SeededRng` stays the five calls
 * every roll in the game is made through.
 */
const positions = new WeakMap<SeededRng, () => number>();

/** Where `rng` has got to, for `createSeededRng(seed, at)` to carry on from; null for a stream not made here. */
export function seededRngPosition(rng: SeededRng): number | null {
  return positions.get(rng)?.() ?? null;
}

/**
 * A stream from `seed`, or - given `at`, a `seededRngPosition` - the same
 * stream taken up exactly where it had got to.
 */
export function createSeededRng(seed: number, at?: number): SeededRng {
  let state = (at ?? seed) >>> 0;
  const next = (): number => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };

  const rng: SeededRng = {
    next,
    int: (minInclusive, maxInclusive) =>
      minInclusive + Math.floor(next() * (maxInclusive - minInclusive + 1)),
    chance: (probability) => next() < probability,
    pick: <T>(values: readonly T[]): T => {
      if (values.length === 0) {
        throw new Error('Cannot pick from an empty collection.');
      }
      return values[Math.floor(next() * values.length)];
    },
    shuffle: <T>(values: readonly T[]): T[] => {
      const shuffled = [...values];
      for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(next() * (index + 1));
        [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
      }
      return shuffled;
    },
  };
  positions.set(rng, () => state >>> 0);
  return rng;
}
