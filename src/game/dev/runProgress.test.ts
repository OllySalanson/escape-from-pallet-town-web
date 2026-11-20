import { describe, expect, it } from 'vitest';
import { RAID_CONTRACTS } from '../objectives/contracts';
import { NEAR_JOBS } from '../objectives/standingBoard';
import { CHART_PIECES } from '../treasure/treasureMap';
import { KOGA_BOSS_ID, MISTY_BOSS_ID } from '../world/valeQuarters';
import { readRunProgress, runProgress, type ProgressFields } from './runProgress';

const ALL_AUTHORED = RAID_CONTRACTS.map((contract) => contract.id);
const finished: ProgressFields = {
  firstContractExtracted: true,
  completedContracts: ALL_AUTHORED,
  standingContractsBanked: NEAR_JOBS,
  defeatedBosses: [MISTY_BOSS_ID, KOGA_BOSS_ID],
  treasureHunt: { roomOpen: true, pinned: CHART_PIECES.map((piece) => piece.id), chestOpened: true },
};

const doneIds = (fields: ProgressFields): string[] =>
  runProgress(fields).milestones.filter((milestone) => milestone.done).map((milestone) => milestone.id);

describe('runProgress', () => {
  it('has nothing done on a new save, and the four finish-line milestones are the captain’s', () => {
    const progress = runProgress({});
    expect(progress.done).toBe(0);
    expect(progress.finished).toBe(false);
    expect(progress.milestones.filter((milestone) => milestone.finish).map((milestone) => milestone.id)).toEqual([
      'contract-chain',
      'misty',
      'koga',
      'treasure',
    ]);
  });

  it('is finished only when the chain, both gyms and the chest are all done', () => {
    expect(runProgress(finished).finished).toBe(true);
    expect(runProgress(finished).done).toBe(runProgress(finished).total);
    expect(runProgress({ ...finished, defeatedBosses: [MISTY_BOSS_ID] }).finished).toBe(false);
    expect(runProgress({ ...finished, treasureHunt: { ...finished.treasureHunt, chestOpened: false } }).finished).toBe(false);
    expect(runProgress({ ...finished, standingContractsBanked: NEAR_JOBS - 1 }).finished).toBe(false);
  });

  it('counts the chain banked only once the authored contracts in play and the near jobs are banked', () => {
    // The suite runs with nothing retired, so every authored contract is in play here.
    expect(doneIds({ standingContractsBanked: NEAR_JOBS })).not.toContain('contract-chain');
    expect(doneIds({ completedContracts: ALL_AUTHORED })).not.toContain('contract-chain');
    expect(doneIds({ completedContracts: ALL_AUTHORED, standingContractsBanked: NEAR_JOBS })).toContain('contract-chain');
    const chain = runProgress({ standingContractsBanked: 1 }).milestones.find((each) => each.id === 'contract-chain');
    expect(chain?.count).toEqual({ have: 1, need: NEAR_JOBS });
  });

  it('counts the chart a piece at a time and ignores pieces it does not know', () => {
    const chart = (pinned: readonly string[]) =>
      runProgress({ treasureHunt: { roomOpen: true, pinned } }).milestones.find((each) => each.id === 'chart-whole');
    expect(chart([CHART_PIECES[0].id, 'not-a-piece'])?.count).toEqual({ have: 1, need: CHART_PIECES.length });
    expect(chart(CHART_PIECES.map((piece) => piece.id))?.done).toBe(true);
  });

  it('reads the finish line off the stored save text, and nothing off text that is not a save', () => {
    expect(readRunProgress(JSON.stringify({ version: 7, raidProgress: finished }))?.finished).toBe(true);
    expect(readRunProgress(null)).toBeNull();
    expect(readRunProgress('not json')).toBeNull();
    expect(readRunProgress('{"version":7}')).toBeNull();
  });
});
