import { describe, expect, it } from 'vitest';
import { DEFAULT_RAID_PROGRESS } from '../save/SaveManager';
import { gatesForMap } from '../world/gates';
import { FIRST_CONTRACT, RAID_CONTRACTS } from './contracts';
import { contractReportLine, isStillOnBoard, missedGate } from './contractReport';
import { standingBoard, type StandingBoardProgress } from './standingBoard';

const CHAIN_BANKED: StandingBoardProgress = {
  ...DEFAULT_RAID_PROGRESS,
  unlockedInsertions: ['floodplain-relay', 'town-square', 'route-1', 'viridian-forest'],
  completedContracts: RAID_CONTRACTS.map((contract) => contract.id),
  standingContractsBanked: 0,
};

/** The first round of the standing board that deals a sealed contract, and that contract. */
function firstSealedBoard() {
  for (let round = 0; round < 40; round += 1) {
    const progress = { ...CHAIN_BANKED, standingContractsBanked: round };
    const sealed = standingBoard(progress).find((contract) => contract.sealedBehind);
    if (sealed) {
      return { progress, sealed };
    }
  }
  throw new Error('no round of the standing board deals a sealed contract');
}

describe('the result screen\'s line for a contract that was not banked', () => {
  it('promises an authored contract back, because the chain does not move until it is banked', () => {
    const line = contractReportLine(FIRST_CONTRACT, {
      banked: false,
      granted: false,
      stopsComplete: false,
      exitLabel: 'SOUTH GATE',
      progressAfter: DEFAULT_RAID_PROGRESS,
    });
    expect(line).toBe('Unfinished, so it stays on the board for the next raid.');
  });

  /**
   * Playtest 4, bug 3: PAST THE TOLL BRIDGE, Briggs beaten, cache taken, out by
   * the wrong exit - "It came home unpaid and stays on the board", and the board
   * at base offered PAST THE ORCHARD FENCE.
   */
  it('never promises back a sealed contract whose boss this raid beat', () => {
    const { progress, sealed } = firstSealedBoard();
    const keeper = gatesForMap(sealed.mapId).find(
      (gate) => gate.label === sealed.sealedBehind!.gateLabel,
    )!.bossId!;
    expect(isStillOnBoard(sealed, progress)).toBe(true);

    // Beating the boss is what finishing it takes, and is written at the win.
    const progressAfter = { ...progress, defeatedBosses: [...progress.defeatedBosses, keeper] };

    const outcome = { banked: false, granted: false, exitLabel: 'SIGNAL FIRE', progressAfter };
    for (const stopsComplete of [true, false]) {
      const line = contractReportLine(sealed, { ...outcome, stopsComplete });
      expect(line).not.toContain('stays on the board');
      expect(line).toContain('the board has moved on');
    }
    // And with the boss still standing it is there to be tried again, and says so.
    expect(
      contractReportLine(sealed, { ...outcome, stopsComplete: false, progressAfter: progress }),
    ).toContain('stays on the board');
  });
});

describe('the way a job was lost at its very last step', () => {
  /** Break-it test, 23 Nov 2026: the sealed dispatch carried out of SMUGGLERS' PATH, not DEER GAP. */
  it('names the exit taken and the one it needed, only when every stop was made', () => {
    const carried = RAID_CONTRACTS.find((contract) => contract.requiredExitLabel)!;
    const outcome = {
      banked: false,
      granted: false,
      stopsComplete: true,
      exitLabel: 'SOUTH GATE',
      progressAfter: DEFAULT_RAID_PROGRESS,
    };

    expect(missedGate(carried, outcome)).toBe(`SOUTH GATE is not ${carried.requiredExitLabel}`);
    expect(contractReportLine(carried, outcome)).toContain(`You had it, and SOUTH GATE is not ${carried.requiredExitLabel}.`);
    expect(missedGate(carried, { ...outcome, stopsComplete: false })).toBe(null);
    expect(missedGate(carried, { ...outcome, banked: true, granted: true })).toBe(null);
    // A job any exit banks is never lost at the gate.
    expect(missedGate(RAID_CONTRACTS.find((contract) => !contract.requiredExitLabel)!, outcome)).toBe(null);
  });
});
