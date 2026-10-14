import { describe, expect, it } from 'vitest';
import { VOLCANO_NIGHT_WILDLIFE, VOLCANO_WILDLIFE } from '../pokemon/encounters';
import { EVOLUTIONS } from '../pokemon/evolution';
import { CAVE_STYLE_HABITATS, MAP_FILE_HABITATS, MAP_FILE_NIGHT_HABITATS } from './mapFile';
import { measureTable } from './encounterMeasure';

/**
 * The volcano habitat is FireRed's Mt. Ember at the vale's levels, and a map
 * file may lay it anywhere, so it is held here to what `districtEncounters`
 * holds Greystone Vale's places to - a level-8 starter of each kind wins at
 * least 45% of what it meets, by day and by night - and to what makes it the
 * volcano's: Ponyta and Magmar live in it and nowhere else.
 */
describe('the volcano habitat', () => {
  it('is the table a file names as volcano, and a cave dressed as a volcano rolls it', () => {
    expect(MAP_FILE_HABITATS.volcano).toBe(VOLCANO_WILDLIFE);
    expect(MAP_FILE_NIGHT_HABITATS.volcano).toBe(VOLCANO_NIGHT_WILDLIFE);
    expect(CAVE_STYLE_HABITATS.ember).toBe('volcano');
  });

  it('is where Ponyta and Magmar live, and nowhere else', () => {
    for (const species of ['ponyta', 'magmar']) {
      const homes = Object.entries(MAP_FILE_HABITATS).filter(([, table]) =>
        table.entries.some((entry) => entry.speciesId === species),
      );
      expect(homes.map(([habitat]) => habitat), species).toEqual(['volcano']);
    }
  });

  it('is its day table slot for slot after dark, with only the Spearow gone to Rattata', () => {
    expect(VOLCANO_NIGHT_WILDLIFE.stepEncounterRate).toBe(VOLCANO_WILDLIFE.stepEncounterRate);
    VOLCANO_WILDLIFE.entries.forEach((day, index) => {
      const night = VOLCANO_NIGHT_WILDLIFE.entries[index];
      expect({ ...night, speciesId: day.speciesId }).toEqual(day);
      expect(night.speciesId).toBe(day.speciesId === 'spearow' ? 'rattata' : day.speciesId);
    });
  });

  it.each([VOLCANO_WILDLIFE, VOLCANO_NIGHT_WILDLIFE])('fields nothing evolved below the level it evolves at', (table) => {
    for (const entry of table.entries) {
      const becomes = EVOLUTIONS.find((rule) => rule.to === entry.speciesId && rule.trigger.kind === 'level');
      if (becomes?.trigger.kind === 'level') {
        expect(entry.minLevel, entry.speciesId).toBeGreaterThanOrEqual(becomes.trigger.level);
      }
    }
  });

  it.each(['bulbasaur', 'charmander', 'squirtle'])('keeps a level-8 %s on its feet, day and night', (starter) => {
    expect(measureTable(VOLCANO_WILDLIFE, starter, 8, 60).winRate).toBeGreaterThanOrEqual(0.45);
    expect(measureTable(VOLCANO_NIGHT_WILDLIFE, starter, 8, 60).winRate).toBeGreaterThanOrEqual(0.45);
  });
});
