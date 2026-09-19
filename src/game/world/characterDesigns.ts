/**
 * The overworld character designs an authored figure can name. Each is one
 * 64x128 sheet under `public/assets/characters/`, cut by
 * `scripts/cut-frlg-characters.mjs` to the rows and first four columns that
 * `playerFrames.ts` reads from `character.png`, so the frame and animation
 * code is shared and only the sheet width differs.
 *
 * The list is the registry: `BootScene` preloads exactly these, and
 * `characterDesigns.test.ts` fails a file on disk that is not named here as
 * well as a name here with no file. Provenance for every sheet is in
 * `public/assets/ASSET_PROVENANCE.md`.
 */

/**
 * Who a design is for. `protagonist` designs are the player's alone: a
 * townsperson in the hero's clothes is the very confusion
 * `characterPresentation.ts` exists to prevent, so `getWorldCharacterLook`
 * refuses one on any other role. `trainer` and `townsfolk` are a casting note
 * for whoever places people, not a rule - nothing stops a hiker being scenery.
 */
export type CharacterDesignKind = 'protagonist' | 'townsfolk' | 'trainer';

export interface CharacterDesign {
  readonly kind: CharacterDesignKind;
  /** What the figure reads as on screen, for whoever is choosing one. */
  readonly description: string;
  /**
   * The row of the 16x32 frame where the hair starts on the idle frames. These
   * figures stand 17 to 20 pixels tall against `character.png`'s 23; the soles
   * are on `CHARACTER_FEET_PIXEL_Y` for all of them, so height is the only
   * thing that varies and anything placed over a head must read it from here.
   */
  readonly headPixelY: number;
}

export const CHARACTER_DESIGNS = {
  'protagonist-red': { kind: 'protagonist', description: 'red cap and vest', headPixelY: 9 },
  'protagonist-leaf': { kind: 'protagonist', description: 'white hat, long hair', headPixelY: 9 },
  lass: { kind: 'trainer', description: 'girl with pigtails in a pink skirt', headPixelY: 9 },
  youngster: { kind: 'trainer', description: 'boy in a yellow cap', headPixelY: 9 },
  'bug-catcher': { kind: 'trainer', description: 'boy in a green cap and shorts', headPixelY: 9 },
  hiker: { kind: 'trainer', description: 'broad man in a brimmed hat with a pack', headPixelY: 8 },
  cooltrainer: { kind: 'trainer', description: 'man in a red and white cap', headPixelY: 8 },
  beauty: { kind: 'trainer', description: 'woman with long blonde hair', headPixelY: 8 },
  sailor: { kind: 'trainer', description: 'sailor in whites', headPixelY: 8 },
  boy: { kind: 'townsfolk', description: 'boy in a green shirt', headPixelY: 9 },
  woman: { kind: 'townsfolk', description: 'woman in a purple dress', headPixelY: 9 },
  'heavy-man': { kind: 'townsfolk', description: 'heavy-set man in white', headPixelY: 8 },
  'bald-man': { kind: 'townsfolk', description: 'balding man in a white shirt', headPixelY: 9 },
  scientist: { kind: 'townsfolk', description: 'man in glasses and a lab coat', headPixelY: 8 },
  'old-man': { kind: 'townsfolk', description: 'stooped old man with a beard', headPixelY: 10 },
  'old-woman': { kind: 'townsfolk', description: 'grey-haired woman in pink', headPixelY: 9 },
  'straw-hat': { kind: 'townsfolk', description: 'gardener in a straw hat', headPixelY: 9 },
} as const satisfies Record<string, CharacterDesign>;

export type CharacterDesignId = keyof typeof CHARACTER_DESIGNS;

/** A design an NPC or trainer may wear: every one that is not the player's. */
export type CastCharacterDesignId = {
  [Id in CharacterDesignId]: (typeof CHARACTER_DESIGNS)[Id]['kind'] extends 'protagonist'
    ? never
    : Id;
}[CharacterDesignId];

export const CHARACTER_DESIGN_IDS = Object.keys(CHARACTER_DESIGNS) as CharacterDesignId[];

/** Frames across a design sheet: idle, step, idle, step. */
export const CHARACTER_DESIGN_SHEET_COLUMNS = 4;

export function getCharacterDesign(id: CharacterDesignId): CharacterDesign {
  return CHARACTER_DESIGNS[id];
}

export function isCastCharacterDesign(id: CharacterDesignId): id is CastCharacterDesignId {
  return getCharacterDesign(id).kind !== 'protagonist';
}

export function characterDesignTextureKey(id: CharacterDesignId): string {
  return `character-${id}`;
}

export function characterDesignAssetPath(id: CharacterDesignId): string {
  return `assets/characters/${id}.png`;
}
