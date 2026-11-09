import { describe, expect, it } from 'vitest';
import { COAST_WILDLIFE } from '../pokemon/encounters';
import { EVOLUTIONS } from '../pokemon/evolution';
import { WeatherId } from '../pokemon/battle/weather';
import { MAP_FILE_HABITATS } from './mapFile';
import { measureTable } from './encounterMeasure';

/**
 * The Coast habitat is THE COAST's own wildlife, the quarter behind Misty's
 * gym (the gyms plan's step 3): the swimmers and sleepers her gym teaches, at
 * the band a team that beat her is at, laid in the rain. Held here as every
 * habitat is, and measured as the quarter is met: a starter at her lead's
 * level, in the rain (`districtEncounters.test.ts` holds the places the same way).
 */
describe('the coast habitat', () => {
  it('is the table a file names as coast', () => {
    expect(MAP_FILE_HABITATS.coast).toBe(COAST_WILDLIFE);
  });

  it('is the plan’s swimmers: Horsea, Goldeen, Tentacool, Staryu and Poliwhirl', () => {
    const species = COAST_WILDLIFE.entries.map((entry) => entry.speciesId);
    for (const kind of ['horsea', 'goldeen', 'tentacool', 'staryu', 'poliwhirl']) {
      expect(species, kind).toContain(kind);
    }
  });

  it('fields nothing evolved below the level it evolves at', () => {
    for (const entry of COAST_WILDLIFE.entries) {
      const becomes = EVOLUTIONS.find((rule) => rule.to === entry.speciesId && rule.trigger.kind === 'level');
      if (becomes?.trigger.kind === 'level') {
        expect(entry.minLevel, entry.speciesId).toBeGreaterThanOrEqual(becomes.trigger.level);
      }
    }
  });

  it('sits under Misty: every common roll below her lead, the rare one the exception', () => {
    const common = COAST_WILDLIFE.entries.filter((entry) => entry.weight > 1);
    expect(Math.max(...common.map((entry) => entry.maxLevel))).toBeLessThan(15);
  });

  it.each(['bulbasaur', 'charmander', 'squirtle'])('keeps a level-15 %s on its feet in the rain', (starter) => {
    expect(measureTable(COAST_WILDLIFE, starter, 15, 80, WeatherId.Rain).winRate).toBeGreaterThanOrEqual(0.45);
  });

  it('is the Fire starter’s hard ground, as the rain says it should be', () => {
    const rate = (starter: string) => measureTable(COAST_WILDLIFE, starter, 15, 80, WeatherId.Rain).winRate;
    expect(rate('charmander')).toBeLessThan(rate('bulbasaur'));
    expect(rate('charmander')).toBeLessThan(rate('squirtle'));
  });
});
