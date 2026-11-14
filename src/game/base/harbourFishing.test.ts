import { describe, expect, it } from 'vitest';
import { WORKSHOP_UPGRADES } from '../hub/workshop';
import { MOORED_ROWING_BOATS, getBaseMap } from './baseMap';
import { BASE_TILESET } from './baseTileset';
import {
  DEEP_WATER_FROM_ROW,
  HARBOUR_KINDS,
  anglerLines,
  harbourBite,
  harbourTable,
  isDeepWater,
  openWater,
  reeledInLines,
} from './harbourFishing';
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

  it.each([
    ['nothing built', [] as string[]],
    ['everything built', WORKSHOP_UPGRADES.map((upgrade) => upgrade.id)],
  ])('never casts onto a boat or a hull, with %s', (_name, built) => {
    const map = getBaseMap(built);
    const open = openWater(map);
    const afloat = map.planted.filter(
      (planted) =>
        planted.name === 'raidFerry' ||
        planted.name === 'ssAnne' ||
        MOORED_ROWING_BOATS.some((boat) => boat.name === planted.name && boat.x === planted.x && boat.y === planted.y),
    );
    // The six rowing boats at the quay walls, the Seagallop and the S.S. Anne.
    expect(afloat.length).toBe(MOORED_ROWING_BOATS.length + 2);
    const castable: string[] = [];
    for (const boat of afloat) {
      const prop = BASE_TILESET.props[boat.name];
      prop.cells.forEach((cell, index) => {
        const x = boat.x + (index % prop.width);
        const y = boat.y + Math.floor(index / prop.width);
        if (cell.tile >= 0 && open[y][x]) castable.push(`${boat.name} at ${x},${y}`);
      });
    }
    expect(castable).toEqual([]);
    // The red rowing boat under the fish stall, which a playtest reeled a MAGIKARP out of from (38,20).
    expect(open[21][38]).toBe(false);
    // And the sea itself still bites: beside that boat, at the foot of the west quay and off the end of the long pier.
    expect(open[21][40]).toBe(true);
    expect(open[20][18]).toBe(true);
    const shipNear = HARBOUR_LANDMARKS.find((landmark) => landmark.id === 'ss-anne')!.near!;
    const pierEnd = shipNear.reduce((low, tile) => (tile.y > low.y ? tile : low));
    expect(open[pierEnd.y][pierEnd.x - 3]).toBe(true);
  });
});
