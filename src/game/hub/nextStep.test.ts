import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_RAID_PROGRESS, type RaidProgress } from '../save/SaveManager';
import { retireMapsForTests, RETIRED_MAPS } from '../world/mapRoster';
import { KOGA_BOSS_ID, MISTY_BOSS_ID } from '../world/valeQuarters';
import { readFileSync } from 'node:fs';
import { CHART_PIECES } from '../treasure/treasureMap';
import { Stash } from '../stash';
import { CHARMANDER, Pokemon } from '../pokemon';
import { chaseLine, jobsBanked, landingToWalkTo, LEGEND_REACH_LEVELS, nextStepLines, VALE_LEGENDS, vaultOf } from './nextStep';

const raided = (raids: number, more: Partial<RaidProgress> = {}): RaidProgress => ({
  ...DEFAULT_RAID_PROGRESS,
  raidRecord: { 'greystone-vale': { deployed: raids, extracted: raids, wiped: 0 } },
  ...more,
});

/**
 * One thing at a time, in the order a newcomer meets the game: the critic came
 * home from a first raid to six goal systems at once (problem 9).
 */
describe('the one next thing Oak says', () => {
  beforeEach(() => retireMapsForTests(RETIRED_MAPS));
  afterEach(() => retireMapsForTests([]));

  it('says nothing to a save that has not been on a raid: the lab has its own first words', () => {
    expect(nextStepLines(DEFAULT_RAID_PROGRESS)).toEqual([]);
  });

  it('after the first raid, names the job on the rail', () => {
    const [line, ...rest] = nextStepLines(raided(1));
    expect(rest).toEqual([]);
    expect(line).toMatch(/^Next, a job: [A-Z ]+\. Pick it at the RAID ARENA, before you jump\.$/);
  });

  it('after the first job, the next, and favours', () => {
    const lines = nextStepLines(raided(2, { standingContractsBanked: 1 }));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^Next, .* And folk about the harbour may ask you a favour now\.$/);
  });

  it('counts the job after a banked one, so the same name reads as counted', () => {
    // "Next, SEALED DISPATCH is on the rail" under JOB DONE AND BANKED read as
    // if the dispatch just banked had not counted (first-hour playtest, 26 Nov 2026).
    expect(nextStepLines(raided(2, { standingContractsBanked: 1 }))[0]).toMatch(/^Next, your second job: [A-Z' ,.!-]+, on the rail\./);
  });

  it('says the same after a raid that banked nothing, never that a new job is up', () => {
    // The gyms playtest of 26 Nov 2026 heard "Next, a new LINE SURVEY is on
    // the rail." after raids that banked no job at all.
    const once = nextStepLines(raided(2, { standingContractsBanked: 1 }));
    const later = nextStepLines(raided(5, { standingContractsBanked: 1 }));
    expect(later).toEqual(once);
    expect(later[0]).not.toMatch(/\bnew\b/);
  });

  it('once the near jobs are banked, a landing to walk to and the next gym', () => {
    const progress = raided(4, { standingContractsBanked: 2 });
    const landing = landingToWalkTo(progress);
    expect(landing?.mapId).toBe('greystone-vale');
    expect(nextStepLines(progress)).toEqual([
      `Walk to ${landing!.label.toUpperCase()} on a raid, and you can land there next time.`,
      expect.stringContaining('MISTY'),
    ]);
  });

  it('names a landing not yet walked to, and never one behind a gym still shut', () => {
    const progress = raided(4, { standingContractsBanked: 2 });
    const first = landingToWalkTo(progress)!;
    const next = landingToWalkTo({ ...progress, reachedInsertions: [first.id] });
    expect(next?.id).not.toBe(first.id);
    for (const reached of [[] as string[], [first.id]]) {
      const named = landingToWalkTo({ ...progress, reachedInsertions: reached });
      expect(named?.id).not.toMatch(/old-quay|cove-steps|rest-house|salvage/);
    }
  });

  it('names the next gym in order, and nothing once both are beaten and every landing walked', () => {
    const misty = nextStepLines(raided(9, { standingContractsBanked: 5, defeatedBosses: [MISTY_BOSS_ID] }));
    expect(misty.at(-1)).toContain('KOGA');
    const all = raided(20, { standingContractsBanked: 9, defeatedBosses: [MISTY_BOSS_ID, KOGA_BOSS_ID] });
    expect(nextStepLines(all).join(' ')).not.toMatch(/MISTY|KOGA/);
  });

  it('counts both kinds of banked job', () => {
    expect(jobsBanked({ completedContracts: ['a'], standingContractsBanked: 2 })).toBe(3);
  });

  /**
   * The overnight critic's problem 17 (25 Nov 2026): "After both badges the
   * game has nothing to say." The treasure map first, then the legends.
   */
  describe('after both badges', () => {
    const done = raided(20, { standingContractsBanked: 9, defeatedBosses: [MISTY_BOSS_ID, KOGA_BOSS_ID] });

    it('names the treasure map first, stage by stage', () => {
      expect(nextStepLines(done).at(-1)).toContain('a bottle has washed up on THE BEACH');
      expect(chaseLine(done, { held: (itemId) => (itemId === 'bottled-chart' ? 1 : 0) })).toContain('take that bottled chart to MARLOW');
      expect(chaseLine({ ...done, treasureHunt: { roomOpen: true, pinned: ['shore'], chestOpened: false } })).toContain(
        `still wants ${CHART_PIECES.length - 1} more pieces`,
      );
      const whole = { roomOpen: true, pinned: CHART_PIECES.map((piece) => piece.id), chestOpened: false };
      expect(chaseLine({ ...done, treasureHunt: whole })).toContain("SMUGGLERS' COVE");
      expect(chaseLine({ ...done, treasureHunt: whole }, { held: (itemId) => (itemId === 'sea-chest' ? 1 : 0) })).toContain('carry the SEA CHEST');
    });

    it('then the legends not yet caught, a different one each raid, and nothing once every one is caught', () => {
      const chest = { ...done, treasureHunt: { roomOpen: true, pinned: CHART_PIECES.map((piece) => piece.id), chestOpened: true } };
      expect(chaseLine(chest)).toBe('Next, a legend: ZAPDOS sleeps in the TURBINE HALL under the POWER STATION, at Lv 50. Beat it, and you get one throw.');
      expect(chaseLine({ ...chest, pokedexOwned: [145] })).toContain('ARTICUNO');
      // The next raid, the next one in turn.
      expect(chaseLine({ ...chest, raidRecord: { 'greystone-vale': { deployed: 21, extracted: 21, wiped: 0 } } })).toContain('ARTICUNO');
      expect(chaseLine({ ...chest, pokedexOwned: VALE_LEGENDS.map((legend) => legend.dexId) })).toBeUndefined();
    });

    it('names only legends the vale really holds, at the level it holds them', () => {
      const vale = JSON.parse(readFileSync('src/game/world/maps/greystoneVale.json', 'utf8')) as {
        pokemon: { species: string; level: number; legendary?: boolean }[];
      };
      const standing = vale.pokemon.filter((pokemon) => pokemon.legendary).map((pokemon) => `${pokemon.species} ${pokemon.level}`).sort();
      expect(VALE_LEGENDS.map((legend) => `${legend.speciesId} ${legend.level}`).sort()).toEqual(standing);
    });

    it('tells a team far below a legend the gap, rather than to beat it', () => {
      const chest = { ...done, treasureHunt: { roomOpen: true, pinned: CHART_PIECES.map((piece) => piece.id), chestOpened: true } };
      expect(chaseLine(chest, { bestLevel: 18 })).toBe(
        "Next, a legend: ZAPDOS sleeps in the TURBINE HALL under the POWER STATION, at Lv 50. Your best is Lv 18. Grow into it - it isn't going anywhere.",
      );
      expect(chaseLine(chest, { bestLevel: 50 - LEGEND_REACH_LEVELS })).toContain('Beat it, and you get one throw.');
    });

    it('reads the vault off a stash: what it holds, and its best level', () => {
      const stash = new Stash();
      stash.addPokemon(new Pokemon(CHARMANDER, 12));
      stash.addPokemon(new Pokemon(CHARMANDER, 23));
      stash.addItem('bottled-chart', 1);
      const vault = vaultOf(stash);
      expect(vault.bestLevel).toBe(23);
      expect(vault.held?.('bottled-chart')).toBe(1);
      expect(chaseLine(done, vault)).toContain('take that bottled chart');
    });
  });
});
