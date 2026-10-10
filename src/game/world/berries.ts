import { ITEMS, type ItemId } from '../items/items';
import { BERRY_TREE_ORDER, BERRY_TREE_SHEET } from './generated/berryTrees';

/**
 * A berry tree, as a map maker plants one: Emerald's own tree
 * (`scripts/cut-emerald-berry-trees.mjs` - FireRed has none), hung with one
 * kind of berry, picked once a raid by facing it and pressing the interact key.
 *
 * A berry is an item the game already knows how to use - FireRed's own Oran,
 * Sitrus and the five status cures (`items/items.ts`) - so a tree is a place a
 * raid can count on for one piece of medicine, the way an item spot is a place
 * it can count on for one piece of something. It is picked into the pack like
 * a find, costs its square, and is carried home or lost with the pack; the tree
 * stands bare for the rest of the raid (`ActiveRunSession.berriesPicked`) and is
 * ripe again on the next, which is the berry tree's whole nature.
 */
export type BerryId = (typeof BERRY_TREE_ORDER)[number];

export const BERRY_IDS: readonly BerryId[] = BERRY_TREE_ORDER;

export const BERRY_TREE_TEXTURE = 'berryTrees';
export const BERRY_TREE_PATH = BERRY_TREE_SHEET.imagePath;
export const BERRY_TREE_FRAME_WIDTH = BERRY_TREE_SHEET.frameWidth;
export const BERRY_TREE_FRAME_HEIGHT = BERRY_TREE_SHEET.frameHeight;

/** How long each of a tree's two sway frames is shown. */
export const BERRY_TREE_SWAY_MS = 600;

export function isBerry(value: unknown): value is BerryId {
  return typeof value === 'string' && (BERRY_TREE_ORDER as readonly string[]).includes(value);
}

/** The item a tree's berry is. */
export function berryItemId(berry: BerryId): ItemId {
  return `${berry}-berry`;
}

/** The berry's name as the game prints it: Oran Berry. */
export function berryName(berry: BerryId): string {
  return ITEMS[berryItemId(berry)].displayName;
}

/**
 * The sheet frames a tree is drawn from. Ripe, it sways between its two
 * berried frames; picked, it stands as the grown tree with nothing on it.
 */
export function berryTreeFrames(berry: BerryId): {
  readonly ripe: readonly [number, number];
  readonly bare: number;
} {
  const first = BERRY_TREE_ORDER.indexOf(berry) * BERRY_TREE_SHEET.framesPerBerry;
  return { ripe: [first + 4, first + 5], bare: first };
}

/** What a ripe tree says before it is picked, and what a bare one says after. */
export function berryTreeLines(berry: BerryId, picked: boolean): readonly string[] {
  const name = berryName(berry).toUpperCase();
  return picked
    ? [`The ${name} tree has been picked bare. It will be ripe again next time.`]
    : [`It's a ${name} tree. It is heavy with berries.`];
}
