import { describe, expect, it } from 'vitest';
import { BUILT_IN_MAP_FILE_LIMITS, MAP_FILE_LIMITS } from '../../../../src/game/world/mapFile';
import {
  checkPlan,
  districtsOutOfReach,
  planBounds,
  unreachableDistricts,
} from '../../worldPlan';
import { GREYSTONE_VALE } from './plan';

/** The fourteen districts drawn before the vale grew its ring, where they were drawn. */
const DRAWN: Readonly<Record<string, readonly [number, number]>> = {
  millbrook: [0, 1],
  'high-moor': [0, 0],
  'greystone-peaks': [1, 0],
  'pine-hollow': [2, 0],
  'the-crossing': [1, 1],
  tanglewood: [2, 1],
  reedmere: [0, 2],
  'gull-strand': [1, 2],
  'orchard-terraces': [2, 2],
  'power-station': [3, 0],
  'safari-marsh': [3, 1],
  'the-wreck': [3, 2],
  'sunken-quarter': [1, 3],
  'smugglers-cove': [0, 3],
};

/** The far places with a square of their own; the sixth, the Bunker, is under the power station. */
const FAR = ['stormcrown', 'moor-chapel', 'lost-garden', 'frostreef', 'ember-isle'] as const;

describe('the Greystone Vale plan', () => {
  it('has no problems, and every district has a way in from the village', () => {
    expect(checkPlan(GREYSTONE_VALE)).toEqual([]);
    expect(districtsOutOfReach(GREYSTONE_VALE, 'millbrook')).toEqual([]);
    // No road reaches four of the far places: only a cave or a boat does.
    expect(unreachableDistricts(GREYSTONE_VALE, 'millbrook')).toEqual([
      'stormcrown',
      'lost-garden',
      'frostreef',
      'ember-isle',
    ]);
  });

  it('is six districts square, a built-in map file exactly, and bigger than a player may draw', () => {
    // Planned as nine districts, 192 square; grown to the 256 a map file held,
    // and then to a ring round that once the size was measured (README).
    const bounds = planBounds(GREYSTONE_VALE);
    expect([bounds.columns, bounds.rows]).toEqual([6, 6]);
    expect(bounds.columns * GREYSTONE_VALE.districtSize).toBe(BUILT_IN_MAP_FILE_LIMITS.maxWidth);
    expect(bounds.rows * GREYSTONE_VALE.districtSize).toBe(BUILT_IN_MAP_FILE_LIMITS.maxHeight);
    expect(BUILT_IN_MAP_FILE_LIMITS.maxWidth).toBeGreaterThan(MAP_FILE_LIMITS.maxWidth);
    expect(GREYSTONE_VALE.builtIn).toBe(true);
  });

  it('keeps every district already drawn where it was, and grows a ring round them', () => {
    for (const [id, cell] of Object.entries(DRAWN))
      expect(GREYSTONE_VALE.districts.find((district) => district.id === id)?.cell, id).toEqual(cell);
    const ring = (cell: readonly [number, number]) =>
      cell[0] === -1 || cell[0] === 4 || cell[1] === -1 || cell[1] === 4;
    for (const id of FAR)
      expect(ring(GREYSTONE_VALE.districts.find((district) => district.id === id)!.cell), id).toBe(true);
  });

  it('opens the old ways out east and south onto what it grew into', () => {
    const joins = (a: string, b: string) =>
      GREYSTONE_VALE.crossings.some(
        (crossing) => crossing.between.includes(a) && crossing.between.includes(b),
      );
    expect(joins('pine-hollow', 'power-station')).toBe(true);
    expect(joins('tanglewood', 'safari-marsh')).toBe(true);
    expect(joins('orchard-terraces', 'the-wreck')).toBe(true);
    expect(joins('gull-strand', 'sunken-quarter')).toBe(true);
    expect(joins('reedmere', 'smugglers-cove')).toBe(true);
    const names = GREYSTONE_VALE.exits.map((exit) => exit.name);
    for (const old of ['Pine Trail', 'Eastern Track', 'Orchard Lane', "Fisher's Jetty"]) {
      expect(names).not.toContain(old);
    }
    // A raid needs a way out that opens later, and boats and the tide are those.
    expect(GREYSTONE_VALE.exits.filter((exit) => exit.opens?.when === 'after').map((exit) => exit.name)).toEqual([
      'Salvage Launch',
      'Low Water Stair',
      "Smugglers' Boat",
      "Whaler's Boat",
      'Cinder Boat',
    ]);
  });

  it('gives every district an idea and a terrain, and the village the front door', () => {
    for (const district of GREYSTONE_VALE.districts) {
      expect(district.idea.length, district.id).toBeGreaterThan(40);
      expect(district.terrain, district.id).toBeDefined();
    }
    // The first landing a map file lists is its front door, and districts are stitched in plan order.
    expect(GREYSTONE_VALE.districts[0].id).toBe('millbrook');
    expect(
      GREYSTONE_VALE.landmarks?.find((landmark) => landmark.kind === 'landing')?.district,
    ).toBe('millbrook');
  });

  it('plans a cave with mouths at both ends of the vale, and hidden routes through the woods', () => {
    const cave = GREYSTONE_VALE.caves?.find((candidate) => candidate.id === 'greystone-caves');
    expect(cave?.mouths.map((mouth) => mouth.district)).toEqual([
      'greystone-peaks',
      'tanglewood',
      'gull-strand',
      'stormcrown',
    ]);
    expect(
      GREYSTONE_VALE.crossings.filter((crossing) => crossing.hidden).length,
    ).toBeGreaterThanOrEqual(2);
  });

  describe('the far places', () => {
    const district = (id: string) => GREYSTONE_VALE.districts.find((candidate) => candidate.id === id)!;
    const bunker = GREYSTONE_VALE.caves?.find((cave) => cave.id === 'the-bunker');

    it('each carries its brief - the way in, why it is hard, what is only there, what it needs - and no landing', () => {
      for (const reach of [...FAR.map((id) => district(id).reach), bunker?.reach]) {
        expect(reach).toBeDefined();
        expect(reach!.needs.length).toBeGreaterThan(0);
      }
      const landings = (GREYSTONE_VALE.landmarks ?? []).filter((landmark) => landmark.kind === 'landing');
      expect(landings.filter((landing) => (FAR as readonly string[]).includes(landing.district))).toEqual([]);
    });

    it('each has a way out of its own, so a raid that got there need not go back', () => {
      for (const id of FAR)
        expect(GREYSTONE_VALE.exits.some((exit) => exit.district === id), id).toBe(true);
    });

    it('reaches Stormcrown only from the deepest cave floor', () => {
      const cave = GREYSTONE_VALE.caves!.find((candidate) => candidate.id === 'greystone-caves')!;
      const deepest = Math.max(...cave.mouths.map((mouth) => mouth.floor ?? 0));
      expect(deepest).toBe(cave.floors);
      expect(cave.mouths.find((mouth) => mouth.floor === deepest)?.district).toBe('stormcrown');
      expect(GREYSTONE_VALE.crossings.some((crossing) => crossing.between.includes('stormcrown'))).toBe(false);
    });

    it('opens the way to the Moor Chapel only after dark', () => {
      const ways = GREYSTONE_VALE.crossings.filter((crossing) => crossing.between.includes('moor-chapel'));
      expect(ways).toEqual([expect.objectContaining({ opens: 'night', hidden: true })]);
      expect(ways[0].between).toContain('high-moor');
    });

    it('reaches the Lost Garden only through the cave behind the falls', () => {
      expect(GREYSTONE_VALE.crossings.some((crossing) => crossing.between.includes('lost-garden'))).toBe(false);
      const falls = GREYSTONE_VALE.caves!.find((cave) => cave.id === 'falls-cave')!;
      expect(falls.mouths.map((mouth) => mouth.district)).toEqual(['power-station', 'lost-garden']);
    });

    it('puts the Bunker under the station, behind the Card Key', () => {
      expect(bunker?.mouths).toEqual([expect.objectContaining({ district: 'power-station', locked: 'card-key' })]);
      expect(GREYSTONE_VALE.cardKey?.card).toBe('pine-hollow');
    });

    it('reaches the islands only by boat, across open sea, while the tide lets one sail', () => {
      for (const island of ['frostreef', 'ember-isle']) {
        expect(GREYSTONE_VALE.crossings.some((crossing) => crossing.between.includes(island)), island).toBe(false);
        const boats = (GREYSTONE_VALE.sailings ?? []).filter((sailing) => sailing.to.district === island);
        expect(boats, island).toHaveLength(1);
        expect(boats[0].via.length, island).toBeGreaterThan(0);
      }
      const from = (island: string) =>
        GREYSTONE_VALE.sailings?.find((sailing) => sailing.to.district === island)?.from.district;
      expect(from('frostreef')).toBe('the-wreck');
      expect(from('ember-isle')).toBe('smugglers-cove');
    });
  });
});
