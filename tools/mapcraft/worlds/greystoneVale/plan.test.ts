import { describe, expect, it } from 'vitest';
import { MAP_FILE_LIMITS } from '../../../../src/game/world/mapFile';
import { checkPlan, planBounds, unreachableDistricts } from '../../worldPlan';
import { GREYSTONE_VALE } from './plan';

describe('the Greystone Vale plan', () => {
  it('has no problems, and every district can be walked to from the village', () => {
    expect(checkPlan(GREYSTONE_VALE)).toEqual([]);
    expect(unreachableDistricts(GREYSTONE_VALE, 'millbrook')).toEqual([]);
  });

  it('has grown into the room it kept, and fits a map file exactly', () => {
    // Planned as nine districts, 192 square, with a column and a row to spare;
    // grown into them once the nine were drawn.
    const bounds = planBounds(GREYSTONE_VALE);
    expect(bounds.columns * GREYSTONE_VALE.districtSize).toBe(MAP_FILE_LIMITS.maxWidth);
    expect(bounds.rows * GREYSTONE_VALE.districtSize).toBe(MAP_FILE_LIMITS.maxHeight);
    expect(GREYSTONE_VALE.builtIn).toBe(true);
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
    const cave = GREYSTONE_VALE.caves?.[0];
    expect(cave?.mouths.map((mouth) => mouth.district)).toEqual([
      'greystone-peaks',
      'tanglewood',
      'gull-strand',
    ]);
    expect(
      GREYSTONE_VALE.crossings.filter((crossing) => crossing.hidden).length,
    ).toBeGreaterThanOrEqual(2);
  });
});
