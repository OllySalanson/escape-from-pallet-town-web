import { isFirstRaid } from './firstRaid';
import { contractCarryIn, type RaidContract } from '../objectives/contracts';
import { formatStacks } from '../objectives/RunObjectives';
import {
  boardContracts,
  isStandingBoardOpen,
  type StandingBoardProgress,
} from '../objectives/standingBoard';

/**
 * What the lobby's contract board says, worded here so it is testable without
 * the lobby - in the manner of `battlePresentation.ts`.
 *
 * The board is one list whether the contracts on it were authored or drawn from
 * the standing board, so a row is built from the contract alone. Everything a
 * contract will cost is said before the player picks where to drop in: the door
 * it is behind, the exit that banks it, what has to be packed, and the hunter
 * it adds - the rule the final check and the trainer watch already follow.
 */

export interface ContractBoardRow {
  readonly contractId: string;
  readonly mapId: RaidContract['mapId'];
  readonly name: string;
  readonly description: string;
  /** Everything the contract will cost, as one line. Empty when it asks nothing but the walk. */
  readonly asks: string;
  readonly reward: string;
  /** Tiers of hunter this contract adds, so the lobby can weight a raised row. */
  readonly hunterPressure: number;
}

export interface ContractBoardModel {
  readonly heading: string;
  readonly note: string;
  readonly rows: readonly ContractBoardRow[];
}

export function buildContractBoard(progress: StandingBoardProgress): ContractBoardModel {
  // The first raid is for finding out what a raid is, so nothing is on offer for it.
  const contracts = isFirstRaid(progress) ? [] : boardContracts(progress);
  const standing = isStandingBoardOpen(progress.completedContracts);
  return {
    heading: standing ? 'Standing board' : 'Job board',
    note: standing
      ? `${contracts.length} open · ${progress.standingContractsBanked} banked · turns over when you bank one`
      : `${contracts.length} open · rewards require extraction`,
    // Most hunter first: the contract the board is paying most for leads it.
    // The sort is stable, so contracts at the same pressure stay in map order,
    // and the authored chain - which carries none - keeps the order it unlocks in.
    rows: contracts
      .map(contractBoardRow)
      .sort((a, b) => b.hunterPressure - a.hunterPressure),
  };
}

export function contractBoardRow(contract: RaidContract): ContractBoardRow {
  const carryIn = contractCarryIn(contract);
  const pressure = contract.hunterPressure ?? 0;
  return {
    contractId: contract.id,
    mapId: contract.mapId,
    name: contract.name,
    description: contract.description,
    asks: [
      ...(contract.sealedBehind
        ? [`Behind ${contract.sealedBehind.gateLabel}, held by ${contract.sealedBehind.bossName}`]
        : []),
      // Said as a player would pin it up, never the code's own words: "Banks
      // only through" and a bare "A stronger hunter." were the board's "ley
      // lines" moment (the owner, 25 Nov 2026; the harbour critic tour).
      ...(contract.requiredExitLabel ? [`Only ${contract.requiredExitLabel} takes it home`] : []),
      ...(carryIn.length > 0 ? [`Bring ${formatStacks(carryIn)}`] : []),
      // Not 'Hunter +1 tier', a designer's stat line nobody could read (AI playtest, 22 Nov 2026).
      ...(pressure > 0 ? [pressure === 1 ? 'The hunter is tougher' : 'The hunter is much tougher'] : []),
    ].join(' · '),
    reward: contract.reward.summary,
    hunterPressure: pressure,
  };
}
