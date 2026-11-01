import { describe, expect, it } from 'vitest';
import { goesStraightOver, isFirstRaid } from './firstRaid';
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
