import { describe, expect, it } from 'vitest';
import { MAP_FILE_LIMITS } from '../../../../src/game/world/mapFile';
import { checkPlan, planBounds, unreachableDistricts } from '../../worldPlan';
import { GREYSTONE_VALE } from './plan';

describe('the Greystone Vale plan', () => {
  it('has no problems, and every district can be walked to from the village', () => {
    expect(checkPlan(GREYSTONE_VALE)).toEqual([]);
    expect(unreachableDistricts(GREYSTONE_VALE, 'millbrook')).toEqual([]);
  });

  it('keeps room to grow a column and a row inside a map file', () => {
    const bounds = planBounds(GREYSTONE_VALE);
    expect((bounds.columns + 1) * GREYSTONE_VALE.districtSize).toBeLessThanOrEqual(
      MAP_FILE_LIMITS.maxWidth,
    );
    expect((bounds.rows + 1) * GREYSTONE_VALE.districtSize).toBeLessThanOrEqual(
      MAP_FILE_LIMITS.maxHeight,
    );
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
