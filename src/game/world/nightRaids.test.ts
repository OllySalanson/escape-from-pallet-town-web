import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { windowLight } from '../base/homeClock';
import type { WildEncounterTable } from '../pokemon/encounters';
import { getSpeciesById } from '../pokemon/species';
import { generateRunPlan } from '../run/runGeneration';
import { MAP_DISTRICTS } from './districts';
import { KEPT_BY_NIGHT, NIGHT_SWAPS } from './generated/nightSwaps';
import { districtEncounterTables } from './localEncounters';
import { atNight, districtTableFor, isNightRaid, nightSpeciesFor } from './nightRaids';

interface CrystalPlace {
  readonly place: string;
  readonly day: readonly string[];
  readonly night: readonly string[];
}

/** The committed snapshot of Crystal's own day and night grass, which the swaps are held to. */
const CRYSTAL = JSON.parse(
  readFileSync(join(__dirname, '../../../tools/encounters/crystal-night.json'), 'utf8'),
) as { readonly places: readonly CrystalPlace[] };

/** Twelve noon and eleven at night on the twelfth of October, local time. */
const at = (hour: number, minute = 0) => new Date(2026, 9, 12, hour, minute);

const speciesOf = (table: WildEncounterTable | undefined) => table?.entries.map((entry) => entry.speciesId) ?? [];
const slotsOf = (table: WildEncounterTable | undefined) =>
  table?.entries.map(({ minLevel, maxLevel, weight }) => ({ minLevel, maxLevel, weight }));

describe('the night', () => {
  it('falls when the window at home has the stars out, and not at dusk', () => {
    expect(isNightRaid(at(23))).toBe(true);
    expect(isNightRaid(at(3))).toBe(true);
    expect(isNightRaid(at(12))).toBe(false);
    expect(isNightRaid(at(19, 30))).toBe(false);
    for (let hour = 0; hour < 24; hour += 1) {
      expect(isNightRaid(at(hour, 30)), `${hour}:30`).toBe(windowLight(at(hour, 30)) === 'night');
    }
  });
});

describe("Crystal's night, read back", () => {
  it('swaps out only species that keep daylight hours on every road Crystal has', () => {
    for (const swap of NIGHT_SWAPS) {
      const outByDay = CRYSTAL.places.filter((place) => place.day.includes(swap.day));
      expect(outByDay.length, swap.day).toBeGreaterThan(0);
      for (const place of outByDay) {
        expect(place.night, `${swap.day} is out by night on ${place.place}`).not.toContain(swap.day);
      }
    }
    // The one the whole rule is about: Rattata is out on most roads at night.
    expect(NIGHT_SWAPS.some((swap) => swap.day === 'rattata')).toBe(false);
  });

  it('gives each slot to what Crystal puts there by night, on the places it names', () => {
    for (const swap of NIGHT_SWAPS) {
      expect(swap.places.length, swap.day).toBeGreaterThanOrEqual(2);
      for (const name of swap.places) {
        const place = CRYSTAL.places.find((entry) => entry.place === name)!;
        const slots = place.day.flatMap((species, slot) => (species === swap.day ? [slot] : []));
        expect(
          slots.some((slot) => place.night[slot] === swap.night),
          `${swap.night} takes ${swap.day}'s slot on ${name}`,
        ).toBe(true);
      }
    }
  });

  it('names only the 151 this game has', () => {
    for (const species of [...NIGHT_SWAPS.flatMap((swap) => [swap.day, swap.night]), ...KEPT_BY_NIGHT]) {
      expect(getSpeciesById(species), species).toBeDefined();
    }
  });

  it('leaves Pidgey out at night, because the 151 have no owl', () => {
    expect(KEPT_BY_NIGHT).toContain('pidgey');
    expect(nightSpeciesFor('pidgey')).toBe('pidgey');
    expect(nightSpeciesFor('caterpie')).toBe('oddish');
    expect(nightSpeciesFor('spearow')).toBe('rattata');
    expect(nightSpeciesFor('rattata')).toBe('rattata');
  });
});

describe('wildlife at night', () => {
  it('changes which species a slot holds and nothing else about the table', () => {
    for (const district of MAP_DISTRICTS.filter((entry) => entry.encounters)) {
      const day = district.encounters!;
      const night = districtTableFor(district, true)!;
      expect(night.stepEncounterRate, district.id).toBe(day.stepEncounterRate);
      expect(slotsOf(night), district.id).toEqual(slotsOf(day));
      expect(districtTableFor(district, false), district.id).toBe(day);
    }
  });

  it('brings night species into the grass where day ones were', () => {
    const tables = districtEncounterTables(undefined, true);
    const day = districtEncounterTables(undefined, false);
    expect(speciesOf(day['pallet-high-wood'])).toContain('caterpie');
    expect(speciesOf(tables['pallet-high-wood'])).not.toContain('caterpie');
    expect(speciesOf(tables['pallet-high-wood'])).toContain('oddish');
    expect(speciesOf(tables['pallet-high-wood'])).toContain('venonat');
    expect(speciesOf(tables['pallet-delve'])).toContain('clefairy');
    expect(speciesOf(tables['route-1-meadows'])).not.toContain('spearow');
    // And the whole game is a different place after dark, not one table.
    const changed = Object.keys(day).filter(
      (id) => speciesOf(day[id]).join() !== speciesOf(tables[id]).join(),
    );
    expect(changed.length).toBeGreaterThan(30);
  });

  it("lets a place keep its own night where the rule would take it past its difficulty", () => {
    const rows = MAP_DISTRICTS.find((district) => district.id === 'pallet-allotments')!;
    expect(speciesOf(atNight(rows.encounters!))).toContain('oddish');
    expect(speciesOf(districtTableFor(rows, true))).toEqual(
      ['venonat', 'diglett', 'oddish', 'bellsprout', 'bulbasaur'],
    );
  });

  it('is decided when the raid is generated, and spends the same randomness as the day', () => {
    const seed = 0x5eed;
    const day = generateRunPlan(seed);
    const night = generateRunPlan(seed, undefined, undefined, undefined, undefined, [], {}, [], [], true);

    expect(day.night).toBe(false);
    expect(night.night).toBe(true);
    // Every roll that is not a species is the day's, to the slot.
    expect(night.loot).toEqual(day.loot);
    expect(night.trainers).toEqual(day.trainers);
    expect(night.extractionPoints).toEqual(day.extractionPoints);
    expect(night.hunter).toEqual(day.hunter);
    for (const [id, table] of Object.entries(day.districtEncounters)) {
      expect(slotsOf(night.districtEncounters[id]), id).toEqual(slotsOf(table));
      expect(night.districtEncounters[id].stepEncounterRate, id).toBe(table.stepEncounterRate);
      expect(speciesOf(night.districtEncounters[id]), id).toEqual(
        speciesOf(districtTableFor(MAP_DISTRICTS.find((district) => district.id === id)!, true)),
      );
    }
  });
});
