import type { RaidContract } from './contracts';
import { workLeftByContract } from '../world/workedLandmarks';
import { boardContracts, type StandingBoardProgress } from './standingBoard';

/** What became of the contract a raid carried, as its result screen needs it. */
export interface ContractOutcome {
  /** This exit banked it. */
  readonly banked: boolean;
  /** The save paid it out - false when it had been banked on an earlier raid. */
  readonly granted: boolean;
  readonly stopsComplete: boolean;
  readonly exitLabel: string;
  /**
   * The progress the next board will be dealt from - the save as it stands
   * *after* this raid, bosses beaten in it included.
   */
  readonly progressAfter: StandingBoardProgress;
}

/**
 * Whether the board the player is about to be shown still lists this contract.
 * The board is a pure function of progress and a raid changes progress: the
 * sealed contract is drawn behind a gate still shut, so the raid that beats its
 * boss to reach the stop is the raid that takes it off the board.
 */
export function isStillOnBoard(contract: RaidContract, progressAfter: StandingBoardProgress): boolean {
  // A standing contract's id is its round and its map, which a redealt board
  // shares with the one it replaced - so the id alone would call PAST THE
  // ORCHARD FENCE the same contract as PAST THE TOLL BRIDGE.
  const asked = JSON.stringify([contract.name, contract.markers, contract.requiredExitLabel]);
  return boardContracts(progressAfter).some(
    (offer) =>
      offer.id === contract.id &&
      JSON.stringify([offer.name, offer.markers, offer.requiredExitLabel]) === asked,
  );
}

/**
 * The way a job was lost at the very last step - every stop made, and walked
 * out of the wrong exit - as `SMUGGLERS' PATH is not DEER GAP`, or null when
 * that is not what happened. The result screen's summary leads with it: said
 * only in the contract's own row, which is the last thing in its pane, it was
 * under the fold, under a verdict of "You got out with a little.", on the one
 * raid where the player most needed telling (break-it test, 23 Nov 2026).
 */
export function missedGate(contract: RaidContract, outcome: ContractOutcome): string | null {
  return !outcome.banked && outcome.stopsComplete && contract.requiredExitLabel
    ? `${outcome.exitLabel} is not ${contract.requiredExitLabel}`
    : null;
}

/**
 * The result screen's line for a contract. It promises the contract back only
 * when the board that will be dealt holds it: "stays on the board" was once said
 * of a sealed contract to a player who had just beaten its boss, and the board
 * they walked back to had a different contract on it.
 */
export function contractReportLine(contract: RaidContract, outcome: ContractOutcome): string {
  if (outcome.banked) {
    // What the world keeps is said on the raid that bought it and never again:
    // it is a change to the map, so a player who reads it once knows to expect
    // it, and `world/workedLandmarks.ts` derives it from this same list.
    const kept = workLeftByContract(contract.id);
    return outcome.granted
      ? `${contract.reward.summary}${kept ? ` ${kept.note}` : ''}`
      : 'Already banked on an earlier raid, so there is no new unlock this time.';
  }
  const stays = isStillOnBoard(contract, outcome.progressAfter);
  const gate = missedGate(contract, outcome);
  if (gate !== null) {
    const missed = `You had it, and ${gate}. It came home unpaid`;
    return stays
      ? `${missed} and stays on the board.`
      : `${missed}, and the board has moved on: what you opened out there stays open.`;
  }
  return stays
    ? 'Unfinished, so it stays on the board for the next raid.'
    : 'Unfinished, and the board has moved on: what you opened out there stays open.';
}

/**
 * The result screen's contract row for a raid lost with a job in hand. A wipe
 * said nothing about the job at all: a player who went down carrying the
 * Sealed dispatch learned it was still open only when the rim offered it again
 * (the overnight retest's job chaser, 23 Nov 2026).
 */
export function wipedContractReport(
  contract: RaidContract,
  progressAfter: StandingBoardProgress,
): { readonly description: string; readonly complete: false; readonly reward: string } {
  return {
    description: contract.description,
    complete: false,
    reward: isStillOnBoard(contract, progressAfter)
      ? 'Lost with the raid, so it went unpaid. It stays on the board for the next raid.'
      : 'Lost with the raid, so it went unpaid, and the board has moved on.',
  };
}

