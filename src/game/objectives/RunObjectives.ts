import { ITEMS } from '../items';
import type { ItemStack, RunSnapshot } from '../run';
import {
  areContractStopsComplete,
  contractStopsDone,
  type ContractStack,
  type RaidContract,
} from './contracts';

export interface ObjectiveReward {
  readonly items: readonly ItemStack[];
}

export interface RunObjective {
  readonly id: string;
  readonly description: string;
  readonly reward: ObjectiveReward;
  readonly progress: (snapshot: RunSnapshot) => ObjectiveProgress;
}

export interface ObjectiveProgress {
  readonly current: number;
  readonly target: number;
  readonly complete: boolean;
}

function progress(current: number, target: number): ObjectiveProgress {
  return { current: Math.min(current, target), target, complete: current >= target };
}

/**
 * The objective line a contract shows in the field guide.
 *
 * A contract is one objective however many stops it has, because "1/3 stakes
 * read" is the progress the player cares about and three separate rows would
 * read as three contracts. The reward is empty here on purpose: contract
 * rewards are granted by the save on the first bank, not handed out per raid,
 * and the guide prints the contract's own reward summary instead.
 */
export function objectivesForContract(contract: RaidContract): readonly RunObjective[] {
  return [
    {
      id: contract.id,
      description: contract.description,
      reward: { items: [] as readonly ItemStack[] },
      progress: (snapshot: RunSnapshot) =>
        progress(contractStopsDone(contract, snapshot.contractSteps), contract.markers.length),
    },
  ];
}

/** Whether every stop of every objective carried on this raid has been made. */
export function areObjectivesComplete(
  contract: RaidContract | undefined,
  snapshot: RunSnapshot,
): boolean {
  return contract === undefined ? false : areContractStopsComplete(contract, snapshot.contractSteps);
}

export function completedObjectiveRewards(
  objectives: readonly RunObjective[],
  snapshot: RunSnapshot,
): readonly ItemStack[] {
  return objectives
    .filter((objective) => objective.progress(snapshot).complete)
    .flatMap((objective) => objective.reward.items);
}

export function formatObjectiveReward(reward: ObjectiveReward): string {
  return formatStacks(reward.items);
}

/** "2× Great Ball" as the lobby, the guide and the report all print it. */
export function formatStacks(stacks: readonly ContractStack[] | readonly ItemStack[]): string {
  return stacks
    .map(({ itemId, quantity }) => `${quantity}× ${ITEMS[itemId]?.displayName ?? itemId.replaceAll('-', ' ')}`)
    .join(', ');
}
