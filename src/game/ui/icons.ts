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
} as const satisfies Record<string, string>;

/** Icons the raid draws on the map, plus the objective icon the menus reuse. */
export const WORLD_ICONS = {
  fieldKit: 'field-kit',
  supplyCrate: 'supply-crate',
  supplyCache: 'supply-cache',
  radioMast: 'radio-mast',
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
  const name = (ITEM_ICONS as Record<string, string | undefined>)[itemId] ?? WORLD_ICONS.supplyCrate;
  return iconMarkup(name, label);
}

/** The run objective's icon: the field kit the first contract asks for. */
export function objectiveIcon(label = 'Objective'): string {
  return iconMarkup(WORLD_ICONS.fieldKit, label);
}
