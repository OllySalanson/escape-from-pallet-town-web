import type { ItemId } from '../items';
import type { GridPosition } from '../movement/gridMovement';

export interface WorldLoot {
  readonly id: string;
  readonly position: GridPosition;
  readonly itemId: ItemId;
  readonly quantity: number;
}

export type LootPickupResult = 'collected' | 'bag-full' | 'unavailable';

/**
 * Loot is visible only while an extraction raid is active and remains hidden
 * after its id has been collected during that raid.
 */
export function getVisibleLoot(
  loot: readonly WorldLoot[],
  isRunActive: boolean,
  collectedLootIds: ReadonlySet<string>,
): readonly WorldLoot[] {
  if (!isRunActive) {
    return [];
  }

  return loot.filter((item) => !collectedLootIds.has(item.id));
}

/**
 * Delegates inventory and run registration to WorldScene's collection seam.
 */
export function tryCollectLoot(
  loot: WorldLoot | undefined,
  isRunActive: boolean,
  collectedLootIds: Set<string>,
  collectRunItem: (itemId: ItemId, quantity: number) => boolean,
): LootPickupResult {
  if (!loot || !isRunActive || collectedLootIds.has(loot.id)) {
    return 'unavailable';
  }

  if (!collectRunItem(loot.itemId, loot.quantity)) {
    return 'bag-full';
  }

  collectedLootIds.add(loot.id);
  return 'collected';
}
