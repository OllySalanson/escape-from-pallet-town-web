import { describe, expect, it } from 'vitest';
import { MAP_FILE_LIMITS, UNSAFE_TEXT } from '../world/mapFile';
import { isMapText } from '../world/mapText';
import { isCleanName } from '../world/wordFilter';
import { blankMap } from './draft';
import { isUntouchedBlank } from './drafts';
import { everyGeneratedMapName, generateMapName, isGeneratedMapName } from './mapNames';

/** The same rolls every time, so a name can be pinned. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4_294_967_296;
  };
}

describe("a new map's name", () => {
  it('is never one the game would refuse: every name the generator can make', () => {
    const names = everyGeneratedMapName();
    expect(names.length).toBeGreaterThan(5000);
    const refused = names.filter(
      (name) =>
        !isCleanName(name) ||
        !isMapText(name) ||
        UNSAFE_TEXT.test(name) ||
        name.length > MAP_FILE_LIMITS.maxNameLength ||
        name.trim() !== name,
    );
    expect(refused).toEqual([]);
  });

  it('only ever draws a name from that list', () => {
    const roll = seeded(7);
    for (let draw = 0; draw < 2_000; draw += 1) {
      const name = generateMapName(roll);
      expect(isGeneratedMapName(name), name).toBe(true);
    }
  });

  it('is drawn again by the same rolls, and differs from roll to roll', () => {
    const first = Array.from({ length: 20 }, ((roll) => () => generateMapName(roll))(seeded(42)));
    const again = Array.from({ length: 20 }, ((roll) => () => generateMapName(roll))(seeded(42)));
    expect(again).toEqual(first);
    expect(new Set(first).size).toBeGreaterThan(15);
  });

  it('is what NEW starts a map with - never "My map" - and still counts as untouched, rerolled or not', () => {
    const map = blankMap();
    expect(map.name).not.toBe('My map');
    expect(isGeneratedMapName(map.name)).toBe(true);
    expect(isUntouchedBlank(map)).toBe(true);
    const rerolled = blankMap(undefined, undefined, generateMapName(seeded(3)));
    expect(isUntouchedBlank(rerolled)).toBe(true);
    // A name the maker typed is theirs.
    expect(isUntouchedBlank(blankMap(undefined, undefined, 'MY GARDEN'))).toBe(false);
  });
});
