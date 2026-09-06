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

function countItems(items: readonly ItemStack[]): number {
  return items.reduce((total, item) => total + item.quantity, 0);
}

function progress(current: number, target: number): ObjectiveProgress {
  return { current: Math.min(current, target), target, complete: current >= target };
}

function itemReward(itemId: ItemId, quantity: number): ObjectiveReward {
  return { items: [{ itemId, quantity }] };
}

export const RUN_OBJECTIVES: readonly RunObjective[] = [
  {
    id: 'catch-two-pokemon',
    description: 'Catch 2 Pokémon',
    reward: itemReward('great-ball', 2),
    progress: (snapshot) => progress(snapshot.caughtPokemon.length, 2),
  },
  {
    id: 'defeat-a-trainer',
    description: 'Defeat a trainer',
    reward: itemReward('potion', 2),
    progress: (snapshot) => progress(snapshot.defeatedTrainers, 1),
  },
  {
    id: 'reach-route-1',
    description: 'Reach Route 1',
    reward: itemReward('antidote', 1),
    progress: (snapshot) => progress(snapshot.visitedMapIds.includes('route-1') ? 1 : 0, 1),
  },
  {
    id: 'extract-three-items',
    description: 'Find 3 items',
    reward: itemReward('poke-ball', 2),
    progress: (snapshot) => progress(countItems(snapshot.foundItems), 3),
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
