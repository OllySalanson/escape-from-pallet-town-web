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
 * `named` is the fifth: a figure who is somebody in particular - Professor Oak,
 * Nurse Joy, Bill, Brock, and the five hunters - rather than a class of person, which is why the base
 * screens name one by id (`ui/pixelUi.ts`'s `pixelFigure`) and a map never
 * should cast one as scenery.
 */
export type CharacterDesignKind = 'protagonist' | 'townsfolk' | 'trainer' | 'named';

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
  /**
   * False where the source sheet draws this figure standing and gives it no
   * walk cycle at all: every frame of every facing is the one cell, so the
   * figure turns and never steps. It is a fact about the art rather than a
   * rule - `characterDesigns.test.ts` holds a walker to taking a step and a
   * standing figure to being still - and it is how the game this art comes
   * from draws the two of them who stand at a counter all day.
   */
  readonly walks: boolean;
}

export const CHARACTER_DESIGNS = {
  'protagonist-red': { kind: 'protagonist', description: 'red cap and vest', headPixelY: 9, walks: true },
  'protagonist-leaf': { kind: 'protagonist', description: 'white hat, long hair', headPixelY: 9, walks: true },
  lass: { kind: 'trainer', description: 'girl with pigtails in a pink skirt', headPixelY: 9, walks: true },
  youngster: { kind: 'trainer', description: 'boy in a yellow cap', headPixelY: 9, walks: true },
  'bug-catcher': { kind: 'trainer', description: 'boy in a green cap and shorts', headPixelY: 9, walks: true },
  hiker: { kind: 'trainer', description: 'broad man in a brimmed hat with a pack', headPixelY: 8, walks: true },
  cooltrainer: { kind: 'trainer', description: 'man in a red and white cap', headPixelY: 8, walks: true },
  beauty: { kind: 'trainer', description: 'woman with long blonde hair', headPixelY: 8, walks: true },
  sailor: { kind: 'trainer', description: 'sailor in whites', headPixelY: 8, walks: true },
  boy: { kind: 'townsfolk', description: 'boy in a green shirt', headPixelY: 9, walks: true },
  woman: { kind: 'townsfolk', description: 'woman in a purple dress', headPixelY: 9, walks: true },
  'heavy-man': { kind: 'townsfolk', description: 'heavy-set man in white', headPixelY: 8, walks: true },
  'bald-man': { kind: 'townsfolk', description: 'balding man in a white shirt', headPixelY: 9, walks: true },
  scientist: { kind: 'townsfolk', description: 'man in glasses and a lab coat', headPixelY: 8, walks: true },
  'old-man': { kind: 'townsfolk', description: 'stooped old man with a beard', headPixelY: 10, walks: true },
  'old-woman': { kind: 'townsfolk', description: 'grey-haired woman in pink', headPixelY: 9, walks: true },
  'straw-hat': { kind: 'townsfolk', description: 'gardener in a straw hat', headPixelY: 9, walks: true },
  // The four the base is made of. Each is the person the game this art comes
  // from draws under that name, not a lookalike: see `ASSET_PROVENANCE.md` for
  // the row of the sheet each was cut from and how it was identified.
  'prof-oak': { kind: 'named', description: 'Professor Oak, white coat over a red shirt', headPixelY: 8, walks: true },
  'nurse-joy': { kind: 'named', description: 'Nurse Joy, pink hair and a white apron', headPixelY: 8, walks: false },
  bill: { kind: 'named', description: 'Bill, fair hair and a lilac shirt', headPixelY: 8, walks: true },
  brock: { kind: 'named', description: 'Brock, spiked hair and a green work vest', headPixelY: 8, walks: false },
  // The five hunters (`hunters.ts`), each the person the game draws under that
  // name. Blue is the rival and walks; the four gym leaders are drawn standing
  // in their gyms in the game, so the sheet gives them a facing each and no
  // stride - the hunter is placed a tile at a time and never strides anyway.
  blue: { kind: 'named', description: 'Blue, the rival: spiked hair, dark shirt', headPixelY: 8, walks: true },
  misty: { kind: 'named', description: 'Misty, tied-back hair and a swimsuit', headPixelY: 9, walks: false },
  'lt-surge': { kind: 'named', description: 'Lt. Surge, blond crop and army greens', headPixelY: 8, walks: false },
  koga: { kind: 'named', description: 'Koga, grey hair and a ninja\'s dark garb', headPixelY: 8, walks: false },
  sabrina: { kind: 'named', description: 'Sabrina, long dark hair and a red top', headPixelY: 9, walks: false },
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
