import type { GridSize } from './itemGrid';

/**
 * The two containers a raid is played with, at the size every save starts them.
 *
 * They are sizes rather than counts on purpose: the Outfitter grows one and
 * contracts grow the other, and both grow by adding squares to a shape the
 * player has already learned to read. The growth itself is derived where the
 * thing that pays for it lives - `raidBagGridFor` in `../hub/outfitter` and
 * `secureGrid` in `../objectives/contracts` - so neither list can be silently
 * defaulted past.
 */

/**
 * Six squares across and three down: eighteen.
 *
 * Two numbers set it. The wipe restock kit - five Poké Balls and three Potions -
 * is eight squares, so a player handed the last-resort kit can always carry it
 * and still have ten squares to fill; and a good raid finds four or five pieces
 * of loot averaging nearly three squares each, so those ten do not cover a good
 * raid. That is the decision the whole grid exists to create: pack harder and
 * you bring less home, and somewhere in the field you put something down.
 *
 * It is also as tall as the loadout screen can draw at 320x240 and still leave
 * the insertion list readable - a square is sixteen game pixels because that is
 * the icon set's size, so a row of the pack is a real share of the stage. Four
 * rows crushed the pane beside it to a sliver; that was measured, not supposed.
 */
export const RAID_BAG_GRID: GridSize = { width: 6, height: 3 };

/** Each rung that grows the pack adds one row of six. */
export const RAID_BAG_ROWS_PER_UPGRADE = 1;

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
