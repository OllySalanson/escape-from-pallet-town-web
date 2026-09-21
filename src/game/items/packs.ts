import { getItemById, isPack, PACK_ITEM_IDS, type PackItemId } from './items';
import { gridCells, type GridSize } from './itemGrid';

/**
 * The pack a raid is carried in, and everything that is asked about one.
 *
 * **A pack is gear, not an upgrade.** The stash grows for good - Brock's
 * ladder and the secure container are that, and they are untouched - but the
 * thing you carry a raid's haul in is an item you own, choose before every raid
 * and *lose with its contents* if you do not walk out. So the decision is made
 * fresh each time: a Hauler frame brings a fortune home and is a fortune to go
 * down with, and a Satchel risks almost nothing because it can hold almost
 * nothing.
 *
 * The consequence for the code is that pack size is **derived and never
 * stored**, exactly as every Brock effect is derived from a list of ids.
 * The save records which packs are in the vault, because they are items and the
 * vault already counts items; how many squares one of them has lives in the
 * catalogue beside its name (`./items`), and every screen, the raid bag, the
 * wipe and the result screen read it back through this module. There is no
 * second number anywhere to disagree with it.
 *
 * Nobody is ever stranded. The Satchel is a line of `MINIMUM_SUPPLIES`
 * (`../stash/Stash`), and the kit is read as a *capability*, so holding any
 * pack at all satisfies it - a player with a Hauler frame is never handed a
 * Satchel, and a player who lost their last pack always is.
 */

/** Every pack the catalogue knows, smallest first. */
export const PACK_IDS: readonly PackItemId[] = [...PACK_ITEM_IDS].sort(
  (a, b) => packSquares(a) - packSquares(b),
);

/**
 * The pack a fresh save is issued, and the pack every save from before packs
 * existed is repaired to: the one the game was played with when the pack was a
 * constant. Nobody loses squares to this change.
 */
export const STARTING_PACK_ID: PackItemId = 'raid-pack';

/** The last resort, and the only pack the wipe restock ever hands out. */
export const FALLBACK_PACK_ID: PackItemId = 'satchel';

/** The squares a pack has, or undefined for anything that is not a pack. */
export function packGrid(itemId: string): GridSize | undefined {
  const effect = getItemById(itemId)?.effect;
  return effect?.type === 'pack' ? { width: effect.grid.width, height: effect.grid.height } : undefined;
}

/**
 * The squares a pack has, falling back to the smallest one.
 *
 * A fallback rather than a throw because the id reaching this is read off a
 * save, a loadout or a raid in flight, and the honest answer to "a pack this
 * catalogue has never heard of" is the smallest pack rather than a crash
 * halfway through settling a raid.
 */
export function packGridFor(itemId: string | null | undefined): GridSize {
  return packGrid(itemId ?? '') ?? packGrid(FALLBACK_PACK_ID)!;
}

/** How many squares a pack holds - the number the loadout and the bag print. */
export function packSquares(itemId: string): number {
  return gridCells(packGridFor(itemId));
}

/** A pack's name, for a row, a refusal or a result screen. */
export function packName(itemId: string | null | undefined): string {
  return getItemById(itemId ?? '')?.displayName ?? 'Pack';
}

/**
 * The packs a vault holds, smallest first, with how many of each.
 *
 * Duplicates are kept as a count rather than flattened: owning two Ranger packs
 * is the difference between risking one and risking your only one, and the
 * loadout says so.
 */
export function packsIn(
  contents: Readonly<Record<string, number>>,
): readonly { readonly itemId: PackItemId; readonly held: number }[] {
  return PACK_IDS.map((itemId) => ({ itemId, held: contents[itemId] ?? 0 })).filter(
    ({ held }) => held > 0,
  );
}

/**
 * The biggest pack a vault holds, or none at all.
 *
 * This is what a loadout opens on, the way the secure container fills itself:
 * a default, never a cage. Nobody should deploy in a Satchel because they did
 * not know which screen the packs were on - and anyone who wants to risk less
 * takes a smaller one deliberately, which is the decision this is all for.
 */
export function bestPackIn(contents: Readonly<Record<string, number>>): PackItemId | undefined {
  return packsIn(contents).at(-1)?.itemId;
}

/** Whether an id names a pack this catalogue knows. */
export function isPackId(itemId: string | null | undefined): itemId is PackItemId {
  return typeof itemId === 'string' && isPack(itemId);
}
