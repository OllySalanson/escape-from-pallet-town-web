import type { WildEncounterTable } from '../pokemon/encounters';
import { stageAtLevel } from './nightRaids';

/**
 * A newcomer's first raid meets the near ground's wildlife a level below its
 * starter, as it meets the trainers there softened (`trainersForContract`).
 *
 * A fresh Lv 5 starter is a coin flip against a Lv 5 Rattata (41 / 61 / 53% for
 * Bulbasaur, Charmander and Squirtle) and worse against a Lv 5 Pidgey (16 / 70
 * / 16%), and the first wild fights come one after another on the walk out of
 * Mill Square: a Squirtle's first raid wiped at 0:43 to a Millbrook Rattata in
 * the scenario loop, and a retest friend went from 17 HP to 3 in four fights
 * on the way out (22 Nov 2026). At Lv 4 the same fights are 83-99%.
 *
 * Only the early ground's slots - every slot that tops out at `EARLY_GROUND_MAX`
 * or below - are capped, at `FIRST_RAID_WILD_LEVEL`; a deeper place keeps its
 * levels, so a first raid that wanders into a cave still meets a cave. A slot
 * capped below the level its species evolves at holds the stage before
 * (`stageAtLevel`). Applied by `generateRunPlan` on a save's first raid and on
 * its first job, rolling nothing, so no seed moves.
 */
export const FIRST_RAID_WILD_LEVEL = 4;
const EARLY_GROUND_MAX = 6;

export function forANewcomer(table: WildEncounterTable): WildEncounterTable {
  return {
    ...table,
    entries: table.entries.map((entry) =>
      entry.maxLevel > EARLY_GROUND_MAX
        ? entry
        : {
            ...entry,
            speciesId: stageAtLevel(entry.speciesId, Math.min(entry.minLevel, FIRST_RAID_WILD_LEVEL)),
            minLevel: Math.min(entry.minLevel, FIRST_RAID_WILD_LEVEL),
            maxLevel: Math.min(entry.maxLevel, FIRST_RAID_WILD_LEVEL),
          },
    ),
  };
}
