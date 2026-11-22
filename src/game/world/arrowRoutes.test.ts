import { describe, expect, it } from 'vitest';
import { FLOODPLAIN_REED_WILDLIFE } from '../pokemon/encounters';
import { districtsForMap } from './districts';
import { ARROW_ROUTE_PLACES, ARROW_ROUTE_RATE, isArrowRouteGround, tableForStep } from './arrowRoutes';

/**
 * A step along the gold arrow in Reedmere, Pine Hollow, the Safari Marsh and
 * the Turbine Hall rolls at two thirds of the place's rate, and nothing else
 * changes (AI playtests 4 and 5, 22 Nov 2026).
 */
const middleOf = (name: string) => {
  const area = districtsForMap('greystone-vale').find((district) => district.name === name)!.areas[0];
  return { x: area.x + Math.floor(area.width / 2), y: area.y + Math.floor(area.height / 2) };
};

describe('the gold arrow’s routes', () => {
  it('names places the vale has, every one of them wild ground', () => {
    for (const name of ARROW_ROUTE_PLACES) {
      const place = districtsForMap('greystone-vale').find((district) => district.name === name);
      expect(place, name).toBeDefined();
      expect(place!.encounters, name).toBeDefined();
      expect(isArrowRouteGround('greystone-vale', middleOf(name)), name).toBe(true);
    }
  });

  it('cuts a third off the rate of a step along the arrow there, and nothing else', () => {
    const reedmere = middleOf('REEDMERE');
    const eased = tableForStep(FLOODPLAIN_REED_WILDLIFE, 'greystone-vale', reedmere, true);
    expect(ARROW_ROUTE_RATE).toBeCloseTo(2 / 3);
    expect(eased.stepEncounterRate).toBeCloseTo(FLOODPLAIN_REED_WILDLIFE.stepEncounterRate * (2 / 3));
    expect(eased.entries).toBe(FLOODPLAIN_REED_WILDLIFE.entries);
    // Off the arrow, or along it anywhere else, the place's own table.
    expect(tableForStep(FLOODPLAIN_REED_WILDLIFE, 'greystone-vale', reedmere, false)).toBe(FLOODPLAIN_REED_WILDLIFE);
    expect(tableForStep(FLOODPLAIN_REED_WILDLIFE, 'greystone-vale', middleOf('MILLBROOK'), true)).toBe(FLOODPLAIN_REED_WILDLIFE);
  });
});
