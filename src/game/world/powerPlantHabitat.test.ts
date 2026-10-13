import { describe, expect, it } from 'vitest';
import { POWER_PLANT_WILDLIFE } from '../pokemon/encounters';
import { EVOLUTIONS } from '../pokemon/evolution';
import { MAP_FILE_HABITATS } from './mapFile';
import { measureTable } from './encounterMeasure';

/**
 * The Power Plant habitat is FireRed's own table at a later map's levels, and a
 * map file may lay it anywhere, so it is held here to what `districtEncounters`
 * holds Greystone Vale's places to: a level-8 starter of each kind wins at least
 * 45% of what it meets.
 */
describe('the Power Plant habitat', () => {
  it('is the table a file names as power-plant', () => {
    expect(MAP_FILE_HABITATS['power-plant']).toBe(POWER_PLANT_WILDLIFE);
  });

  it('fields nothing evolved below the level it evolves at', () => {
    for (const entry of POWER_PLANT_WILDLIFE.entries) {
      const becomes = EVOLUTIONS.find(
        (rule) => rule.to === entry.speciesId && rule.trigger.kind === 'level',
      );
      if (becomes?.trigger.kind === 'level') {
        expect(entry.minLevel, entry.speciesId).toBeGreaterThanOrEqual(becomes.trigger.level);
      }
    }
  });

  it.each(['bulbasaur', 'charmander', 'squirtle'])('keeps a level-8 %s on its feet', (starter) => {
    expect(measureTable(POWER_PLANT_WILDLIFE, starter, 8, 60).winRate).toBeGreaterThanOrEqual(0.45);
  });
});
