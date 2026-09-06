/** A compact deterministic PRNG for generating reproducible raid plans. */
export interface SeededRng {
  next(): number;
  int(minInclusive: number, maxInclusive: number): number;
  chance(probability: number): boolean;
  pick<T>(values: readonly T[]): T;
  shuffle<T>(values: readonly T[]): T[];
}

export function createSeededRng(seed: number): SeededRng {
  let state = seed >>> 0;
  const next = (): number => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };

  return {
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
}
