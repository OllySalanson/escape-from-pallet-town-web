/**
 * What the ground is, said in the map's own words rather than in tile numbers.
 *
 * A material is the stable half of the art: a map says "hedge here, earth
 * there", and a catalogue says which tile of which sheet draws a hedge's
 * north-west corner. Swapping the sheet is then a change to one catalogue
 * rather than to every map - which is not hypothetical, it has happened once
 * already.
 *
 * The set is sized to what a Pokemon-family terrain sheet actually draws: eight
 * grounds that each arrive with a complete thirteen-tile edge block, water with
 * its own bank, and the handful of walls. Nothing here is invented; every
 * material is one a sheet has art for.
 */

export type Material =
  /** Open ground, and what every other ground draws its edge against. */
  | 'grass'
  /** Mown, paler grass: a green, a yard, the inside of a walled garden. */
  | 'turf'
  /** Growth you wade through. Walkable, and the only ground that costs fights. */
  | 'tall-grass'
  /** Trodden earth: a lane worn by use. */
  | 'earth'
  /** Dry sand, inland. */
  | 'sand'
  /** Sand at the waterline, drawn with its own surf. */
  | 'beach'
  /** Pale laid stone: a plaza, a station apron. */
  | 'paving'
  /** Grey brick: a built floor that means someone kept this place up. */
  | 'stone'
  /** Dark grit: a yard nobody swept. */
  | 'gravel'
  /** Water shallow enough to wade. Walkable - and the reason a bank is a choice. */
  | 'ford'
  /** Deep water. Solid, absolutely. */
  | 'water'
  /** Clipped growth, shoulder high. Solid, and the material that has gates. */
  | 'hedge'
  /** Woodland. Solid, and tall enough to hide what is behind it. */
  | 'tree'
  /** Rock face. Solid, and the only wall that reads as height. */
  | 'cliff'
  /** Post and rail. Solid - and the one wall you can see straight through. */
  | 'fence'
  /** A wall of a building. Solid. */
  | 'wall';

export interface MaterialTraits {
  readonly solid: boolean;
  /** Walking here rolls for a wild encounter. */
  readonly encounters: boolean;
  /**
   * Ground rather than structure. Growth and walls stand *on* ground, so the
   * layer builder draws one of these underneath them.
   */
  readonly ground: boolean;
}

const walkable = { solid: false, encounters: false, ground: true } as const;
const wall = { solid: true, encounters: false, ground: false } as const;

export const MATERIALS: Readonly<Record<Material, MaterialTraits>> = {
  grass: walkable,
  turf: walkable,
  'tall-grass': { solid: false, encounters: true, ground: true },
  earth: walkable,
  sand: walkable,
  beach: walkable,
  paving: walkable,
  stone: walkable,
  gravel: walkable,
  ford: walkable,
  water: { solid: true, encounters: false, ground: true },
  hedge: wall,
  tree: wall,
  cliff: wall,
  fence: wall,
  wall,
};

export function isSolidMaterial(material: Material): boolean {
  return MATERIALS[material].solid;
}

export function hasEncounters(material: Material): boolean {
  return MATERIALS[material].encounters;
}

/**
 * The one character a material is written as in an authored map grid.
 *
 * Maps are drawn as character art and pinned character for character in
 * `mapDesign.test.ts`, because a stray tile in a lane is invisible in a diff of
 * brush calls and obvious in a diff of these. Deep water is `W` and the shallow
 * you can wade is `w`, which is the one place case carries meaning - and it is
 * the meaning the player reads off the screen too.
 */
export const MATERIAL_CHARS: Readonly<Record<Material, string>> = {
  grass: '.',
  turf: '"',
  'tall-grass': 'g',
  earth: ',',
  sand: 'd',
  beach: '~',
  paving: 'P',
  stone: 'M',
  gravel: 'v',
  ford: 'w',
  water: 'W',
  hedge: '#',
  tree: 'T',
  cliff: 'C',
  fence: 'F',
  wall: 'B',
};

const BY_CHAR = new Map<string, Material>(
  Object.entries(MATERIAL_CHARS).map(([material, char]) => [char, material as Material]),
);

export function materialForChar(char: string): Material | undefined {
  return BY_CHAR.get(char);
}
