import { describe, expect, it } from 'vitest';
import { MARSH_WILDLIFE } from '../pokemon/encounters';
import { EVOLUTIONS } from '../pokemon/evolution';
import { getWorldMap } from '../worldMap';
import { districtAt, districtsForMap, weatherAt } from './districts';
import { measureTable } from './encounterMeasure';
import { gatesForMap } from './gates';
import { MAP_FILE_HABITATS } from './mapFile';
import { builtInFileMap } from './playerMaps';
import { createRunTrainerEncounters } from './trainers';
import { KOGA_BOSS_ID, MISTY_BOSS_ID, quarterOfPlace, VALE_QUARTERS } from './valeQuarters';

/**
 * THE MARSH, the quarter Koga's gym holds (the gyms plan's step 5): the Safari
 * reserve and the wreck's cape, behind every road in from the open vale. Its
 * places roll the Marsh's own wildlife, everything in it punishing a touch, at
 * the band a team that beat him is at; each of his doors has a guard and a
 * notice that say so before it costs anything; and his gym stands in open
 * Tanglewood, its hall open from the first raid.
 */

const VALE = 'greystone-vale' as const;
const MARSH = VALE_QUARTERS.find((quarter) => quarter.gym?.bossId === KOGA_BOSS_ID)!;

const places = () => districtsForMap(VALE);
const encounter = (id: string) => createRunTrainerEncounters().find((one) => one.trainer.id === id)!;

describe('THE MARSH, past Koga', () => {
  it('rolls the Marsh’s own wildlife over every place of it, and nowhere else', () => {
    const inQuarter = places().filter((place) => quarterOfPlace(place, places()) === MARSH);
    expect(inQuarter.map((place) => place.name)).toEqual(expect.arrayContaining(['SAFARI MARSH', 'THE WRECK']));
    for (const place of inQuarter) {
      expect(place.encounters, place.name).toBe(MARSH_WILDLIFE);
    }
    const elsewhere = places().filter(
      (place) => place.encounters === MARSH_WILDLIFE && quarterOfPlace(place, places()) !== MARSH,
    );
    expect(elsewhere.map((place) => place.name)).toEqual([]);
  });

  it('is the table a file names as poison-marsh, and fields nothing evolved below the level it evolves at', () => {
    expect(MAP_FILE_HABITATS['poison-marsh']).toBe(MARSH_WILDLIFE);
    for (const entry of MARSH_WILDLIFE.entries) {
      const becomes = EVOLUTIONS.find((rule) => rule.to === entry.speciesId && rule.trigger.kind === 'level');
      if (becomes?.trigger.kind === 'level') {
        expect(entry.minLevel, entry.speciesId).toBeGreaterThanOrEqual(becomes.trigger.level);
      }
    }
  });

  it('is the plan’s threat: Nidoran and Paras that punish a touch, Venonat, Tauros and Koga’s own poison', () => {
    const species = MARSH_WILDLIFE.entries.map((entry) => entry.speciesId);
    for (const kind of ['nidoran-f', 'nidoran-m', 'paras', 'venonat', 'tauros', 'koffing', 'grimer']) {
      expect(species, kind).toContain(kind);
    }
  });

  it('sits under Koga: every roll below his lead', () => {
    const koga = createRunTrainerEncounters().find((one) => one.bossId === KOGA_BOSS_ID)!.trainer;
    const lead = Math.max(...koga.party.map((pokemon) => pokemon.level));
    expect(Math.max(...MARSH_WILDLIFE.entries.map((entry) => entry.maxLevel))).toBeLessThan(lead);
  });

  it.each(['bulbasaur', 'charmander', 'squirtle'])('keeps a level-20 %s on its feet', (starter) => {
    expect(measureTable(MARSH_WILDLIFE, starter, 20, 80).winRate).toBeGreaterThanOrEqual(0.45);
  });

  /**
   * His gym is in open ground, so a save meets it before it can beat him: the
   * hall is walked into, his trainers stand in it, and nothing of it is in the
   * Marsh's weather or wildlife.
   */
  it('stands his gym in open Tanglewood, its hall walked into from the Eastern Track', () => {
    const map = getWorldMap(VALE, []);
    for (const id of ['vale-gym-koga', 'vale-gym-koga-nate', 'vale-gym-koga-phil']) {
      const { position } = encounter(id);
      expect(map.collision[position.y][position.x], id).toBe(false);
      expect(weatherAt(VALE, position)).toBeNull();
    }
    const gym = builtInFileMap(VALE)!.file.buildings.find((building) => building.kind === 'fuchsia-gym')!;
    expect(districtAt(VALE, gym)?.name).toBe('TANGLEWOOD');
    expect(encounter('vale-gym-koga').challengedAfter).toBe(MISTY_BOSS_ID);
  });

  /**
   * FireRed's Route 23 keeps its badge gates with a guard who says which badge
   * opens them; here each of Koga's doors has one, on the open side, with the
   * quarter's notice beside him saying what lies past it.
   */
  it('has a guard and a notice at each of Koga’s doors, saying the badge and the poison', () => {
    const file = builtInFileMap(VALE)!.file;
    const doors = gatesForMap(VALE).filter((gate) => 'bossId' in gate && gate.bossId === KOGA_BOSS_ID);
    // Three while the Station is open ground: the third goes to Lt. Surge.
    expect(doors).toHaveLength(3);
    const near = (spot: { x: number; y: number }, tiles: readonly { x: number; y: number }[]) =>
      tiles.some((tile) => Math.abs(tile.x - spot.x) + Math.abs(tile.y - spot.y) <= 8);
    for (const door of doors) {
      const guards = (file.people ?? []).filter(
        (person) => person.area === undefined && near(person, door.tiles) && person.lines.join(' ').includes('SOUL BADGE'),
      );
      const notices = (file.signs ?? []).filter(
        (sign) => sign.area === undefined && near(sign, door.tiles) && sign.lines[0].startsWith('THE MARSH'),
      );
      expect(`${door.label} ${guards.length} ${notices.length}`).toBe(`${door.label} 1 1`);
      // Both stand outside the quarter, where a save without the badge reads them.
      for (const spot of [...guards, ...notices]) {
        expect(quarterOfPlace(districtAt(VALE, spot)!, places())).not.toBe(MARSH);
      }
      expect(notices[0].lines.join(' ')).toMatch(/poisons you back/);
    }
  });
});
