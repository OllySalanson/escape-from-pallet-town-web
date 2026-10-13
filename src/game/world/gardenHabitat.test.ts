import { describe, expect, it } from 'vitest';
import { LOST_GARDEN_WILDLIFE } from '../pokemon/encounters';
import { EVOLUTIONS } from '../pokemon/evolution';
import { MAP_FILE_HABITATS } from './mapFile';
import { measureTable } from './encounterMeasure';
import { districtTableFor } from './nightRaids';

/**
 * The Lost Garden's habitat: the vale's grass Pokemon, and Tangela, which no
 * other table has. A map file may lay it anywhere, so it is held here to what
 * `districtEncounters` holds Greystone Vale's places to - a level-8 starter of
 * each kind wins at least 45% of what it meets - and to what makes it the
 * garden's: the rarest grass Pokemon are in it, and only Exeggcute is anywhere
 * else.
 */
describe('the garden habitat', () => {
  it('is the table a file names as garden', () => {
    expect(MAP_FILE_HABITATS['garden']).toBe(LOST_GARDEN_WILDLIFE);
  });

  it('is where Tangela lives, and nowhere else', () => {
    const tangela = Object.entries(MAP_FILE_HABITATS).filter(([, table]) =>
      table.entries.some((entry) => entry.speciesId === 'tangela'),
    );
    expect(tangela.map(([habitat]) => habitat)).toEqual(['garden']);
    expect(LOST_GARDEN_WILDLIFE.entries.map((entry) => entry.speciesId)).toContain('exeggcute');
  });

  it("holds a wild Bulbasaur once in a hundred encounters, the captain's call, and nowhere else", () => {
    const total = LOST_GARDEN_WILDLIFE.entries.reduce((sum, entry) => sum + entry.weight, 0);
    const bulbasaur = LOST_GARDEN_WILDLIFE.entries.find((entry) => entry.speciesId === 'bulbasaur');
    expect(bulbasaur?.weight).toBe(1);
    expect(1 / total).toBeGreaterThan(0.009);
    expect(1 / total).toBeLessThanOrEqual(0.01);
    const elsewhere = Object.entries(MAP_FILE_HABITATS).filter(
      ([habitat, table]) => habitat !== 'garden' && table.entries.some((entry) => entry.speciesId === 'bulbasaur'),
    );
    expect(elsewhere).toEqual([]);
  });

  it('fields nothing evolved below the level it evolves at', () => {
    for (const entry of LOST_GARDEN_WILDLIFE.entries) {
      const becomes = EVOLUTIONS.find(
        (rule) => rule.to === entry.speciesId && rule.trigger.kind === 'level',
      );
      if (becomes?.trigger.kind === 'level') {
        expect(entry.minLevel, entry.speciesId).toBeGreaterThanOrEqual(becomes.trigger.level);
      }
    }
  });

  it('is the same garden after dark', () => {
    const night = districtTableFor({ encounters: LOST_GARDEN_WILDLIFE }, true);
    expect(night?.entries.map((entry) => entry.speciesId)).toEqual(
      LOST_GARDEN_WILDLIFE.entries.map((entry) => entry.speciesId),
    );
  });

  it.each(['bulbasaur', 'charmander', 'squirtle'])('keeps a level-8 %s on its feet', (starter) => {
    expect(measureTable(LOST_GARDEN_WILDLIFE, starter, 8, 60).winRate).toBeGreaterThanOrEqual(0.45);
  });
});
