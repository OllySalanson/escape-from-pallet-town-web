import type { GridSize } from './itemGrid';
import { packGridFor, STARTING_PACK_ID } from './packs';

/**
 * The two containers a raid is played with, and where each one's size is
 * decided.
 *
 * They are opposites on purpose, and that is the design. The **secure
 * container** is the base: it grows permanently and never shrinks, by the
 * column, paid for at the Outfitter or with a banked contract, and a wipe
 * cannot touch what is in it - `secureGrid` in `../objectives/contracts` is
 * where that size is derived. The **pack** is gear: its size is whichever pack
 * the player chose to wear this raid (`./packs`), it is lost with everything in
 * it if the raid is lost, and so it is a decision made fresh every time rather
 * than a number that only ever goes up.
 */

/**
 * The pack a fresh save is issued: six squares across and three down, eighteen.
 *
 * It is a *default*, not the size of the pack - since packs became gear the
 * squares come from whichever pack the player chose for this raid, and
 * `packGridFor` in `./packs` is the only thing that answers that question. This
 * is the shape a container falls back to when nobody has said which pack: a
 * `Bag` built with no capacity, and the tests and tools that want "the pack the
 * game was played with".
 *
 * Two numbers set that starting size, and they still set it. The wipe restock
 * kit - five Poke Balls and three Potions - is eight squares, so a player handed
 * the last-resort kit can always carry it and still have ten squares to fill;
 * and a good raid finds four or five pieces of loot averaging nearly three
 * squares each, so those ten do not cover a good raid. That is the decision the
 * whole grid exists to create: pack harder and you bring less home, and
 * somewhere in the field you put something down. A bigger pack buys room out of
 * that tension and pays for it in what a lost raid costs.
 */
export const RAID_BAG_GRID: GridSize = packGridFor(STARTING_PACK_ID);

/**
 * Two by two. It is small because it is meant to be: the secure container is
 * the one thing a wipe cannot touch, so what fits in it is the question the
 * whole raid is played against. Four squares is one parts crate, or four
 * Potions, or a Thunder Stone and three Poké Balls - never all of them.
 */
export const BASE_SECURE_GRID: GridSize = { width: 2, height: 2 };

/** Each contract or locker that enlarges the container adds one column of two. */
export const SECURE_COLUMNS_PER_UPGRADE = 1;

/**
 * Only for drawing: the vault at base has no size, so a bag with no capacity is
 * laid out against a shape big enough that nothing is ever turned away by it.
 */
export const VAULT_GRID: GridSize = { width: 8, height: 64 };
