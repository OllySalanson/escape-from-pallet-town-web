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
  const contracts = boardContracts(progress);
  const standing = isStandingBoardOpen(progress.completedContracts);
  return {
    heading: standing ? 'Standing board' : 'Contract board',
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
      ...(contract.requiredExitLabel ? [`Banks only through ${contract.requiredExitLabel}`] : []),
      ...(carryIn.length > 0 ? [`Pack ${formatStacks(carryIn)}`] : []),
      ...(pressure > 0 ? [`Hunter +${pressure} tier${pressure === 1 ? '' : 's'}`] : []),
    ].join(' · '),
    reward: contract.reward.summary,
    hunterPressure: pressure,
  };
}
