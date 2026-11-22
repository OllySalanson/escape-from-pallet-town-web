import { windowLight } from '../base/homeClock';
import type { WildEncounterTable } from '../pokemon/encounters';
import type { MapDistrict } from './districts';
import { EVOLUTIONS } from '../pokemon/evolution';
import { NIGHT_SWAPS } from './generated/nightSwaps';

/**
 * A raid played at night meets what comes out at night.
 *
 * Night is the player's own: the same local clock THE BOLTHOLE's front window
 * reads (`base/homeClock.ts`), so a raid is a night raid exactly when the
 * window at home has the stars out. It is decided once, when the raid deploys,
 * and rides on the plan (`RunPlan.night`), so a raid begun at five to nine is a
 * day raid to the end of its clock and nothing changes under a player's feet.
 * Nothing is drawn darker - a night raid is told by its wildlife and by one
 * word on the clock - because the game is read at one brightness.
 *
 * What changes is the tall grass, and only by swapping a species for another:
 * every table keeps its slots, levels, weights and rate, so a night raid is the
 * same fight-for-fight difficulty in shape and the per-raid variation spends
 * exactly the randomness it always did. Which species swap is not this file's
 * to say. FireRed has no clock; Crystal is the game night came from, and
 * `tools/encounters/crystalNight.mjs` reads its own day and night tables into
 * `generated/nightSwaps.ts` - a species that keeps daylight hours on every road
 * Crystal has gives its slot to whatever Crystal most often puts there by night,
 * within the 151. That is why Pidgey stays: Crystal's night bird is Hoothoot,
 * and the 151 have no owl.
 */

/** Whether a raid deployed at `now` is a night raid: the window at home shows stars. */
export function isNightRaid(now: Date): boolean {
  return windowLight(now) === 'night';
}

const NIGHT_SPECIES: ReadonlyMap<string, string> = new Map(
  NIGHT_SWAPS.map((swap) => [swap.day, swap.night]),
);

/** What a species' slot holds by night: its night species, or itself. */
export function nightSpeciesFor(speciesId: string): string {
  return NIGHT_SPECIES.get(speciesId) ?? speciesId;
}

/**
 * The stage of a line a slot at `level` holds: never an evolved form below
 * the level FireRed evolves it at. Crystal's night swaps are Crystal's levels,
 * and a Raticate taking a Lv 3 Ekans's slot on the Peaks was a Raticate at 3,
 * which no FireRed grass ever holds (the 20 Nov playtest, twice). It walks
 * back only across level evolutions; a stone or trade form is left alone.
 */
export function stageAtLevel(speciesId: string, level: number): string {
  let current = speciesId;
  for (;;) {
    const rule = EVOLUTIONS.find((each) => each.to === current && each.trigger.kind === 'level');
    if (rule?.trigger.kind !== 'level' || level >= rule.trigger.level) {
      return current;
    }
    current = rule.from;
  }
}

/** A table as it is rolled at night: every slot as it was, its species swapped. */
export function atNight(table: WildEncounterTable): WildEncounterTable {
  return {
    ...table,
    entries: table.entries.map((entry) => ({
      ...entry,
      speciesId: stageAtLevel(nightSpeciesFor(entry.speciesId), entry.minLevel),
    })),
  };
}

/** `atNight` when `night`, the table as it stands otherwise. */
export function forTheHour(table: WildEncounterTable, night: boolean): WildEncounterTable {
  return night ? atNight(table) : table;
}

/**
 * What a place's grass holds at this hour: by night its own authored night
 * table if it has one (`MapDistrict.nightEncounters` - a place the rule would
 * take past its difficulty), else its day table as the rule swaps it.
 */
export function districtTableFor(
  district: Pick<MapDistrict, 'encounters' | 'nightEncounters'>,
  night: boolean,
): WildEncounterTable | undefined {
  if (!night || district.encounters === undefined) {
    return district.encounters;
  }
  return district.nightEncounters ?? atNight(district.encounters);
}
