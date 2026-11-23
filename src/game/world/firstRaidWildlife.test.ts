import { describe, expect, it } from 'vitest';
import { frontDoorFor, generateRunPlan } from '../run/runGeneration';
import { districtsForMap } from './districts';
import { winRateAgainst } from './encounterMeasure';
import { FIRST_RAID_WILD_LEVEL, forANewcomer } from './firstRaidWildlife';

/**
 * A newcomer's first raid meets the near ground's wildlife a level below a
 * fresh starter (scenario loop and retest, 22 Nov 2026: a Squirtle's first
 * raid wiped at 0:43 to a Millbrook Rattata).
 */
const STARTERS = ['bulbasaur', 'charmander', 'squirtle'] as const;
const districtId = (name: string) => districtsForMap('greystone-vale').find((district) => district.name === name)!.id;
const planOf = (firstRaid: boolean) =>
  generateRunPlan(7, undefined, frontDoorFor('greystone-vale')!.id, undefined, undefined, [], { firstRaid });

describe("a newcomer's first raid", () => {
  it('meets the meadow by Mill Square at Lv 4 at most, and every later raid as it was', () => {
    const fold = districtId('THE DROVERS’ FOLD');
    const first = planOf(true).districtEncounters[fold];
    const later = planOf(false).districtEncounters[fold];
    expect(Math.max(...first.entries.map((entry) => entry.maxLevel))).toBe(FIRST_RAID_WILD_LEVEL);
    expect(Math.max(...later.entries.map((entry) => entry.maxLevel))).toBeGreaterThan(FIRST_RAID_WILD_LEVEL);
    // The same slots, the same rate: only the levels.
    expect(first.entries.map((entry) => entry.weight)).toEqual(later.entries.map((entry) => entry.weight));
    expect(first.stepEncounterRate).toBe(later.stepEncounterRate);
  });

  it('leaves a deeper place its levels', () => {
    const first = planOf(true).districtEncounters;
    const later = planOf(false).districtEncounters;
    const deep = Object.keys(later).filter((id) => later[id].entries.every((entry) => entry.maxLevel > 6));
    expect(deep.length).toBeGreaterThan(0);
    for (const id of deep) {
      expect(first[id].entries, id).toEqual(later[id].entries);
    }
  });

  it('holds the stage before for a slot capped below where it evolves', () => {
    const table = forANewcomer({ stepEncounterRate: 0.1, entries: [{ speciesId: 'metapod', minLevel: 6, maxLevel: 6, weight: 1 }] });
    expect(table.entries[0]).toMatchObject({ speciesId: 'caterpie', minLevel: 4, maxLevel: 4 });
  });

  it('is a fight every fresh starter wins at least four times in five', () => {
    const fold = planOf(true).districtEncounters[districtId('THE DROVERS’ FOLD')];
    for (const entry of fold.entries) {
      for (const starter of STARTERS) {
        expect(winRateAgainst(starter, 5, entry.speciesId, entry.maxLevel), `${starter} v ${entry.speciesId}`).toBeGreaterThanOrEqual(0.8);
      }
    }
  });
});
