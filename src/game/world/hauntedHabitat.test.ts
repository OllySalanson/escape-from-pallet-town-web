import { describe, expect, it } from 'vitest';
import { HAUNTED_WILDLIFE } from '../pokemon/encounters';
import { EVOLUTIONS } from '../pokemon/evolution';
import { MAP_FILE_HABITATS } from './mapFile';
import { measureTable } from './encounterMeasure';
import { atNight } from './nightRaids';

/**
 * The haunted habitat is FireRed's Pokemon Tower at a far place's levels, and a
 * map file may lay it anywhere, so it is held here to what `districtEncounters`
 * holds Greystone Vale's places to: a level-8 starter of each kind wins at least
 * 45% of what it meets.
 */
describe('the haunted habitat', () => {
  it('is the table a file names as haunted', () => {
    expect(MAP_FILE_HABITATS.haunted).toBe(HAUNTED_WILDLIFE);
  });

  it('is the Pokemon Tower’s ghosts, in the tower’s own proportions', () => {
    const weights = Object.fromEntries(HAUNTED_WILDLIFE.entries.map((entry) => [entry.speciesId, entry.weight]));
    expect(weights).toEqual({ gastly: 90, cubone: 9, haunter: 1 });
  });

  it('is the same table by night, because nobody walks it by day', () => {
    expect(atNight(HAUNTED_WILDLIFE)).toEqual(HAUNTED_WILDLIFE);
  });

  it('fields nothing evolved below the level it evolves at', () => {
    for (const entry of HAUNTED_WILDLIFE.entries) {
      const becomes = EVOLUTIONS.find(
        (rule) => rule.to === entry.speciesId && rule.trigger.kind === 'level',
      );
      if (becomes?.trigger.kind === 'level') {
        expect(entry.minLevel, entry.speciesId).toBeGreaterThanOrEqual(becomes.trigger.level);
      }
    }
  });

  it.each(['bulbasaur', 'charmander', 'squirtle'])('keeps a level-8 %s on its feet', (starter) => {
    expect(measureTable(HAUNTED_WILDLIFE, starter, 8, 60).winRate).toBeGreaterThanOrEqual(0.45);
  });
});
