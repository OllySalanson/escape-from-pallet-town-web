import type { ItemId } from '../items';
import type { ItemStack, RunSnapshot } from '../run';

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

function itemReward(itemId: ItemId, quantity: number): ObjectiveReward {
  return { items: [{ itemId, quantity }] };
}

export const RUN_OBJECTIVES: readonly RunObjective[] = [
  {
    id: 'recover-lost-field-kit',
    description: 'Recover the lost field kit on Route 1',
    reward: itemReward('super-potion', 1),
    progress: (snapshot) => progress(snapshot.recoveredFieldKit ? 1 : 0, 1),
  },
];

export function completedObjectiveRewards(
  objectives: readonly RunObjective[],
  snapshot: RunSnapshot,
): readonly ItemStack[] {
  return objectives
    .filter((objective) => objective.progress(snapshot).complete)
    .flatMap((objective) => objective.reward.items);
}

export function formatObjectiveReward(reward: ObjectiveReward): string {
  return reward.items.map(({ itemId, quantity }) => `${quantity}× ${itemId.replaceAll('-', ' ')}`).join(', ');
}
