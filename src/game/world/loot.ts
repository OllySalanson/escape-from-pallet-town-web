import type { ItemId } from '../items';
import type { GridPosition } from '../movement/gridMovement';

export interface WorldLoot {
  readonly id: string;
  readonly position: GridPosition;
  readonly itemId: ItemId;
  readonly quantity: number;
  /**
   * How often this piece is on the ground at all, 0 to 1. A piece with no
   * `chance` is part of a map's ordinary pool, of which `generateLoot` lays at
   * least half every raid; a piece with one is rolled on its own instead, and
   * so is neither guaranteed by that floor nor able to crowd a supply out of
   * it.
   *
   * **A piece with a `chance` is a prize**, and that is the one rule the whole
   * of `isPrize` is. It started as the way to lay an evolution stone - a thing
   * that is not a supply, that has to be rare to be worth walking for and that
   * would be a formality at the pool's own odds - and the machines and the
   * packs were authored the same way for the same reason. What was missing was
   * that none of it was *visible*: a hauler frame at one raid in eight, seated
   * anywhere on a map of sixteen thousand tiles, is a thing nobody ever meets.
   * A prize is now seated in its own `district`, drawn with a light on it, and
   * named on the raid HUD from the moment it first comes into view - because
   * greed needs an object you can see costing you your clock, and a surprise
   * when you open a box is not a decision.
   */
  readonly chance?: number;
  /**
   * The district (`./districts`) this piece is seated in, by id.
   *
   * Loot is a pool rather than a layout and every piece is re-seated every raid
   * (`generateLoot`), which is deliberate and is what stops a map being
   * memorised. For an ordinary supply that is the whole story: one Potion is
   * like another and where it lies does not mean anything. A prize is the
   * opposite - a Fire Stone is worth walking the length of Route 1 for because
   * it is in the charcoal burn where the Vulpix are, and a re-seat that could
   * put it ten steps from the landing throws that away. So a piece with a
   * district is still re-seated, but only within that district: the exact tile
   * moves every raid, the *place* does not.
   *
   * A district with no free tile this raid falls back to the whole map, which
   * is what it did before.
   */
  readonly district?: string;
}

/**
 * Whether this piece is a prize: something a raid can be *for*.
 *
 * It is derived from the piece's own odds rather than declared, because "rare
 * enough to be an event" is exactly what a `chance` says and a second field
 * saying it again is a second answer waiting to disagree with the first.
 */
export function isPrize(loot: WorldLoot): boolean {
  return loot.chance !== undefined;
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

/**
 * The rare things this raid laid eyes on and walked out without.
 *
 * The raid HUD asks about a prize for as long as it is on the map; this is the
 * question asked once more, on the result screen, after it is too late. That is
 * the other half of greed and the cheaper half: "you walked past a FIRE STONE"
 * is what makes the next raid have a destination, and it costs the player
 * nothing but the knowledge.
 *
 * Only what was *seen* - a prize the raid never came near was never a decision,
 * and naming it would be the screen telling the player what was on a map they
 * did not walk.
 */
export function prizesLeftBehind(
  lootByMap: Readonly<Record<string, readonly WorldLoot[]>>,
  seenPrizeIds: ReadonlySet<string>,
  collectedLootIds: ReadonlySet<string>,
): readonly ItemId[] {
  return Object.values(lootByMap)
    .flat()
    .filter(
      (loot) =>
        isPrize(loot) && seenPrizeIds.has(loot.id) && !collectedLootIds.has(loot.id),
    )
    .map((loot) => loot.itemId);
}
