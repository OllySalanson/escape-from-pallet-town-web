import { describe, expect, it } from 'vitest';
import { getBaseMap } from './baseMap';
import { DEEP_WATER_FROM_ROW, HARBOUR_KINDS, anglerLines, harbourBite, harbourTable, isDeepWater, reeledInLines } from './harbourFishing';
import { HARBOUR_LANDMARKS } from './landmarks';

/** A fixed sequence of rolls, for a bite that is always the same. */
const rolls = (...values: number[]) => {
  let index = 0;
  return () => values[index++ % values.length];
};

describe('fishing off the harbour', () => {
  it('has Magikarp in the shallows and Horsea and Krabby as well out in the deep, from FireRed\'s own sea', () => {
    expect(HARBOUR_KINDS).toEqual(['magikarp', 'horsea', 'krabby']);
    expect(new Set(harbourTable({ x: 10, y: 20 }).entries.map((entry) => entry.speciesId))).toEqual(new Set(['magikarp']));
    expect(new Set(harbourTable({ x: 10, y: DEEP_WATER_FROM_ROW }).entries.map((entry) => entry.speciesId))).toEqual(
      new Set(['horsea', 'magikarp', 'krabby']),
    );
  });

  it('makes the end of the long pier and the breakwater deep water, and the foot of the quays shallow', () => {
    const map = getBaseMap([]);
    const shipNear = HARBOUR_LANDMARKS.find((landmark) => landmark.id === 'ss-anne')!.near!;
    const pierEnd = shipNear.reduce((low, tile) => (tile.y > low.y ? tile : low));
    expect(isDeepWater({ x: pierEnd.x - 3, y: pierEnd.y })).toBe(true);
    expect(map.terrain[pierEnd.y][pierEnd.x - 3]).toBe('water');
    // The water at the foot of the west quay, where a raid lands.
    expect(isDeepWater({ x: 18, y: 20 })).toBe(false);
    expect(map.terrain[20][18]).toBe('water');
  });

  it('reels in a named kind at a level its slot allows, and lets it go', () => {
    const bite = harbourBite({ x: 10, y: 30 }, rolls(0, 0, 0))!;
    expect(HARBOUR_KINDS).toContain(bite.speciesId);
    expect(bite.level).toBeGreaterThanOrEqual(5);
    expect(bite.level).toBeLessThanOrEqual(15);
    const lines = reeledInLines(bite, true, 1);
    expect(lines[0]).toContain(bite.name);
    expect(lines[0]).toContain('slips back');
    expect(lines[1]).toContain(`1 of ${HARBOUR_KINDS.length}`);
    expect(reeledInLines(bite, false, 1)).toHaveLength(1);
    expect(reeledInLines(bite, true, HARBOUR_KINDS.length)[1]).toContain('every kind');
  });

  it('has the angler lend his rod first, then keep the tally', () => {
    expect(anglerLines(false, []).join(' ')).toContain('borrow my rod');
    expect(anglerLines(true, []).join(' ')).toContain('long pier');
    expect(anglerLines(true, ['MAGIKARP']).join(' ')).toContain(`1 of ${HARBOUR_KINDS.length}`);
    expect(anglerLines(true, ['MAGIKARP', 'HORSEA', 'KRABBY']).join(' ')).toContain('every kind');
  });
});
