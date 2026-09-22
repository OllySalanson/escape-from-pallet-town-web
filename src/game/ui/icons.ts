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
  'poke-ball': 'poke-ball',
  'great-ball': 'great-ball',
  'radio-valve': 'radio-valve',
  'cable-coil': 'cable-coil',
  'parts-crate': 'parts-crate',
  'lamp-oil': 'lamp-oil',
  'mooring-rope': 'mooring-rope',
  'linen-roll': 'linen-roll',
  scrip: 'scrip',
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
  'tm40-aerial-ace': 'tm40-aerial-ace',
  'hm01-cut': 'hm01-cut',
  'hm03-surf': 'hm03-surf',
  'hm06-rock-smash': 'hm06-rock-smash',
  // Four sizes of one silhouette: which pack you are wearing has to be legible
  // at a glance on the loadout, because it is the decision that screen is for.
  satchel: 'satchel',
  'raid-pack': 'raid-pack',
  'ranger-pack': 'ranger-pack',
  'hauler-frame': 'hauler-frame',
  leftovers: 'leftovers',
  'focus-band': 'focus-band',
  'life-orb': 'life-orb',
  'quick-claw': 'quick-claw',
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
  return `/assets/icons/${name}.png`;
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
