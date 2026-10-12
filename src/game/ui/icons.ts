import { publicAssetUrl } from '../publicAssetUrl';

/**
 * The one place a pixel icon is named. Every icon is a 16x16 PNG under
 * `public/assets/icons`, so both the DOM menus and the Phaser world draw the
 * same file and a replacement only has to match that size.
 */
export const ICON_SIZE = 16;

/** Icons the DOM menus draw, keyed by the item id they stand for. */
export const ITEM_ICONS = {
  potion: 'potion',
  'super-potion': 'super-potion',
  antidote: 'antidote',
  // The seven berries, redrawn at 16x16 after FireRed's own item icons and in
  // their colours (`scripts/draw-berry-icons.mjs`).
  'oran-berry': 'oran-berry',
  'sitrus-berry': 'sitrus-berry',
  'pecha-berry': 'pecha-berry',
  'cheri-berry': 'cheri-berry',
  'rawst-berry': 'rawst-berry',
  'chesto-berry': 'chesto-berry',
  'aspear-berry': 'aspear-berry',
  'poke-ball': 'poke-ball',
  'great-ball': 'great-ball',
  'radio-valve': 'radio-valve',
  'cable-coil': 'cable-coil',
  'parts-crate': 'parts-crate',
  'lamp-oil': 'lamp-oil',
  'mooring-rope': 'mooring-rope',
  'linen-roll': 'linen-roll',
  money: 'money',
  // The five stones, one hue and one mark each: a bolt, a flame, a drop, a
  // leaf and a crescent. A stone is drawn on the ground as well as in a list,
  // so which one it is has to read at 16px from across a clearing.
  'thunder-stone': 'thunder-stone',
  'fire-stone': 'fire-stone',
  'water-stone': 'water-stone',
  'leaf-stone': 'leaf-stone',
  'moon-stone': 'moon-stone',
  // One disc, eight hues: a machine is drawn in the type colour of the move it
  // teaches, which is how these games have always told one TM from another, and
  // an HM carries a slot where a TM has a pinhole.
  'tm09-bullet-seed': 'tm09-bullet-seed',
  'tm13-ice-beam': 'tm13-ice-beam',
  'tm23-iron-tail': 'tm23-iron-tail',
  'tm28-dig': 'tm28-dig',
  'tm39-rock-tomb': 'tm39-rock-tomb',
  'tm40-aerial-ace': 'tm40-aerial-ace',
  'hm01-cut': 'hm01-cut',
  'hm03-surf': 'hm03-surf',
  'hm04-strength': 'hm04-strength',
  pickaxe: 'pickaxe',
  // FireRed's two lower rods, told apart as FireRed tells them: plain cane, and
  // blue with a red reel (`scripts/draw-rod-icons.mjs`).
  'old-rod': 'old-rod',
  'good-rod': 'good-rod',
  'hm06-rock-smash': 'hm06-rock-smash',
  // FireRed's Bicycle, side on in its own icon's colours, redrawn at 16x16
  // (`scripts/draw-bicycle-icon.mjs`).
  bicycle: 'bicycle',
  // A hooked pick and five brass keys, each key's bow in a colour of its own
  // so five of them in one vault are five things (`scripts/draw-lock-icons.mjs`).
  lockpick: 'lockpick',
  'weir-key': 'weir-key',
  'paddock-key': 'paddock-key',
  'forester-key': 'forester-key',
  'garden-key': 'garden-key',
  'market-key': 'market-key',
  // Four sizes of one silhouette: which pack you are wearing has to be legible
  // at a glance on the loadout, because it is the decision that screen is for.
  satchel: 'satchel',
  'raid-pack': 'raid-pack',
  'ranger-pack': 'ranger-pack',
  'hauler-frame': 'hauler-frame',
  // The four errands' things (`scripts/draw-errand-icons.mjs`): Oak's parcel,
  // Joy's bag, Brock's crate and Bill's amber, each read at 16px on the ground.
  'oaks-parcel': 'oaks-parcel',
  'medicine-bag': 'medicine-bag',
  'brocks-crate': 'brocks-crate',
  'old-amber': 'old-amber',
  leftovers: 'leftovers',
  'focus-band': 'focus-band',
  'life-orb': 'life-orb',
  'quick-claw': 'quick-claw',
  // Furniture for the house, each its own Secret Base piece drawn at 16x16 -
  // shrunk by a whole factor where it is bigger than a tile
  // (`scripts/cut-home-furniture.mjs`), so a find reads as the thing it is.
  'pika-cushion': 'pika-cushion',
  'ball-cushion': 'ball-cushion',
  'fire-cushion': 'fire-cushion',
  'water-cushion': 'water-cushion',
  'pokemon-chair': 'pokemon-chair',
  'comfort-chair': 'comfort-chair',
  'pokemon-desk': 'pokemon-desk',
  'heavy-desk': 'heavy-desk',
  'tropical-plant': 'tropical-plant',
  'pretty-flowers': 'pretty-flowers',
  'big-plant': 'big-plant',
  'surf-mat': 'surf-mat',
  'thunder-mat': 'thunder-mat',
  'fire-blast-mat': 'fire-blast-mat',
  'powder-snow-mat': 'powder-snow-mat',
  'cute-tv': 'cute-tv',
  'glitter-mat': 'glitter-mat',
  'gorgeous-plant': 'gorgeous-plant',
  'gold-shield': 'gold-shield',
  'silver-shield': 'silver-shield',
  'glass-ornament': 'glass-ornament',
} as const satisfies Record<string, string>;

/** Icons the raid draws on the map, plus the objective icon the menus reuse. */
export const WORLD_ICONS = {
  fieldKit: 'field-kit',
  supplyCrate: 'supply-crate',
  supplyCache: 'supply-cache',
  radioMast: 'radio-mast',
  /** A landmark a banked contract finished with: the mast, standing, switched on. */
  landmarkWorked: 'landmark-worked',
  signPost: 'sign-post',
  extractionOpen: 'extraction-open',
  extractionLocked: 'extraction-locked',
  /** A map maker's exit buried until a Pickaxe digs it out (`MapFileOpens`). */
  rubble: 'rubble',
  /** An exit behind a gate only its own key opens (`ExtractionRequirement` `key`). */
  lockedGate: 'locked-gate',
  /** A cache with a lock on it, which a Lockpick opens (`WorldPoi.locked`). */
  lockedCrate: 'locked-crate',
} as const satisfies Record<string, string>;

/** Every icon file that has to exist, in one list so a test can check them. */
export const ICON_NAMES: readonly string[] = [
  ...Object.values(ITEM_ICONS),
  ...Object.values(WORLD_ICONS),
];

/** The Phaser texture key for an icon, so the world and the loader agree. */
export function iconTextureKey(name: string): string {
  return `icon-${name}`;
}

export function iconUrl(name: string): string {
  return publicAssetUrl(`assets/icons/${name}.png`);
}

/**
 * Markup for one icon in a menu. The `item-icon` class carries the box and the
 * `image-rendering: pixelated` that keeps a 16px source crisp when it is drawn
 * at a whole multiple of its own size.
 */
export function iconMarkup(name: string, label: string): string {
  return `<span class="item-icon"><img src="${iconUrl(name)}" alt="" aria-hidden="true" /><span class="visually-hidden">${label}</span></span>`;
}

/**
 * The icon for a bag or stash item. An item with no icon of its own falls back
 * to the supply crate rather than disappearing, so adding an item can never
 * leave a menu row with an empty slot.
 */
export function itemIcon(itemId: string, label = ''): string {
  return iconMarkup(itemIconName(itemId), label);
}

/**
 * The icon file an item resolves to, for the one surface that draws an item
 * outside a menu row and needs its own box: the defeat sequence's line-up.
 */
export function itemIconName(itemId: string): string {
  return (ITEM_ICONS as Record<string, string | undefined>)[itemId] ?? WORLD_ICONS.supplyCrate;
}

/** The run objective's icon: the field kit the first contract asks for. */
export function objectiveIcon(label = 'Objective'): string {
  return iconMarkup(WORLD_ICONS.fieldKit, label);
}
