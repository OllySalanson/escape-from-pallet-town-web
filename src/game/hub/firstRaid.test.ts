import { describe, expect, it } from 'vitest';
import { FIRST_JUMP_ANSWERS, FIRST_JUMP_QUESTION_LONGEST, firstJumpQuestion, goesStraightOver, isFirstRaid } from './firstRaid';
import { buildContractBoard } from './contractBoard';
import { DEFAULT_RAID_PROGRESS } from '../save/SaveManager';

describe('the way into a first raid', () => {
  it('is a new save, and only until it has gone on one', () => {
    expect(isFirstRaid(DEFAULT_RAID_PROGRESS)).toBe(true);
    expect(isFirstRaid({ raidRecord: { 'greystone-vale': { deployed: 1 } } })).toBe(false);
  });

  it('is behind a save written before raids were counted, with a contract banked', () => {
    expect(isFirstRaid({ completedContracts: ['floodplain-kit'] })).toBe(false);
    expect(isFirstRaid({ standingContractsBanked: 2 })).toBe(false);
  });

  it('skips the card only when there is nothing on it to decide', () => {
    expect(goesStraightOver(true, 1, undefined, false)).toBe(true);
    expect(goesStraightOver(false, 1, undefined, false)).toBe(false);
    expect(goesStraightOver(true, 2, undefined, false)).toBe(false);
    expect(goesStraightOver(true, 1, 'Nobody is coming.', false)).toBe(false);
    expect(goesStraightOver(true, 1, undefined, true)).toBe(false);
  });

  it('has no job on the board until it has gone out once, and then it has', () => {
    expect(buildContractBoard(DEFAULT_RAID_PROGRESS).rows).toEqual([]);
    expect(
      buildContractBoard({ ...DEFAULT_RAID_PROGRESS, raidRecord: { 'greystone-vale': { deployed: 1 } } }).rows.length,
    ).toBeGreaterThan(0);
  });
});

/** The critic's problem 5: the first jump had no confirm, and nothing said what the bench, rack and locker were. */
describe('the question at the rail before the first jump', () => {
  const kit = { carried: [{ itemId: 'poke-ball', quantity: 3 }], locked: [{ itemId: 'potion', quantity: 3 }] };

  it('says what each station packed, and asks', () => {
    expect(firstJumpQuestion({ team: ['Charmander'], ...kit })).toBe(
      'CHARMANDER off the BENCH, 3 POKÉ BALLS off the RACK, 3 POTIONS safe in the LOCKER. Jump in?',
    );
    expect(FIRST_JUMP_ANSWERS).toEqual(['JUMP IN', 'NOT YET']);
  });

  it("fits the box's two rows for every starter", () => {
    for (const starter of ['Bulbasaur', 'Charmander', 'Squirtle']) {
      expect(firstJumpQuestion({ team: [starter], ...kit }).length).toBeLessThanOrEqual(FIRST_JUMP_QUESTION_LONGEST);
    }
  });

  it('leaves out a station that packed nothing', () => {
    expect(firstJumpQuestion({ team: ['Squirtle'], carried: [], locked: [] })).toBe('SQUIRTLE off the BENCH. Jump in?');
  });
});

