import { describe, expect, it } from 'vitest';
import { SAFARI_ZONE_WILDLIFE } from '../pokemon/encounters';
import { EVOLUTIONS } from '../pokemon/evolution';
import { MAP_FILE_HABITATS } from './mapFile';
import { measureTable } from './encounterMeasure';

/**
 * The Safari Zone habitat is FireRed's own table at a later map's levels, and a
 * map file may lay it anywhere, so it is held here to what `districtEncounters`
 * holds Greystone Vale's places to: a level-8 starter of each kind wins at least
 * 45% of what it meets.
 */
describe('the Safari Zone habitat', () => {
  it('is the table a file names as safari', () => {
    expect(MAP_FILE_HABITATS['safari']).toBe(SAFARI_ZONE_WILDLIFE);
  });

  it('fields nothing evolved below the level it evolves at', () => {
    for (const entry of SAFARI_ZONE_WILDLIFE.entries) {
      const becomes = EVOLUTIONS.find(
        (rule) => rule.to === entry.speciesId && rule.trigger.kind === 'level',
      );
      if (becomes?.trigger.kind === 'level') {
        expect(entry.minLevel, entry.speciesId).toBeGreaterThanOrEqual(becomes.trigger.level);
      }
    }
  });

  it.each(['bulbasaur', 'charmander', 'squirtle'])('keeps a level-8 %s on its feet', (starter) => {
    expect(measureTable(SAFARI_ZONE_WILDLIFE, starter, 8, 60).winRate).toBeGreaterThanOrEqual(0.45);
  });
});
