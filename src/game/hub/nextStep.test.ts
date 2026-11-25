import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_RAID_PROGRESS, type RaidProgress } from '../save/SaveManager';
import { retireMapsForTests, RETIRED_MAPS } from '../world/mapRoster';
import { KOGA_BOSS_ID, MISTY_BOSS_ID } from '../world/valeQuarters';
import { jobsBanked, landingToWalkTo, nextStepLines } from './nextStep';

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
    expect(line).toMatch(/^Next, a job: [A-Z ]+\. Choose it at the RAID ARENA's rail before you jump\.$/);
  });

  it('after the first job, the next, and favours', () => {
    const lines = nextStepLines(raided(2, { standingContractsBanked: 1 }));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^Next, .* And folk about the harbour may ask you a favour now\.$/);
  });

  it('once the near jobs are banked, a landing to walk to and the next gym', () => {
    const progress = raided(4, { standingContractsBanked: 2 });
    const landing = landingToWalkTo(progress);
    expect(landing?.mapId).toBe('greystone-vale');
    expect(nextStepLines(progress)).toEqual([
      `Walk to ${landing!.label.toUpperCase()} on a raid, and you can start the next one from there.`,
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
});
