import { MAP_FILE_HABITATS, type MapFileBuildingKind, type MapFileHabitat } from '../world/mapFile';
import { MATERIAL_CHARS } from '../world/tileset/materials';

/**
 * What the map maker paints with, in the words a maker reads.
 *
 * The palette is the FireRed look: every brush is a material or a stamp the
 * Kanto sheet draws, so a map can only be painted in the art the game's own
 * Viridian City is painted in (the captain's D1 - "FireRed look for every map"
 * is what the palette offers, not a rule a map has to pass).
 */

export interface GroundBrush {
  readonly id: string;
  readonly label: string;
  /** Said on the help line while the brush is pointed at. */
  readonly help: string;
  /**
   * The letter written on a tile, given the letter already there. A plain
   * material ignores it; flowers and bushes are drawn on whatever ground they
   * are painted over, because the file has a letter for each.
   */
  readonly letterFor: (under: string) => string;
  /** The letter its swatch is drawn from. */
  readonly swatch: string;
}

const plain = (id: string, label: string, letter: string, help: string): GroundBrush => ({
  id,
  label,
  help,
  letterFor: () => letter,
  swatch: letter,
});

/** The stamps flowers and a bush are written as, by the ground they stand on. */
const FLOWERS_ON: Readonly<Record<string, string>> = { [MATERIAL_CHARS.turf]: 'r' };
const BUSH_ON: Readonly<Record<string, string>> = { [MATERIAL_CHARS.turf]: 'u', [MATERIAL_CHARS.paving]: 'k' };

/** The letters a ledge is written as: its west end, its run and its east end. */
export const LEDGE_LETTERS = ['<', '=', '>'] as const;

/** What a stamp stands on, so painting over one puts its ground back first. */
const STAMP_GROUND: Readonly<Record<string, string>> = {
  f: MATERIAL_CHARS.grass,
  r: MATERIAL_CHARS.turf,
  o: MATERIAL_CHARS.grass,
  u: MATERIAL_CHARS.turf,
  k: MATERIAL_CHARS.paving,
  '<': MATERIAL_CHARS.grass,
  '=': MATERIAL_CHARS.grass,
  '>': MATERIAL_CHARS.grass,
};

/** The ground under a letter, reading a stamp as what it stands on. */
export function groundUnder(letter: string): string {
  return STAMP_GROUND[letter] ?? letter;
}

export const GROUND_BRUSHES: readonly GroundBrush[] = [
  plain('grass', 'Grass', MATERIAL_CHARS.grass, 'Short grass. Walked on, and nothing lives in it.'),
  plain('tall-grass', 'Tall grass', MATERIAL_CHARS['tall-grass'], 'Wild Pokémon live in it: every step on it can start a fight.'),
  plain('turf', 'Lawn', MATERIAL_CHARS.turf, 'Mown lawn, as in a garden or a town.'),
  plain('sand', 'Sand road', MATERIAL_CHARS.sand, 'A sandy road. Looks best two tiles wide.'),
  plain('paving', 'Paving', MATERIAL_CHARS.paving, 'Town paving. Looks best two tiles wide.'),
  plain('water', 'Water', MATERIAL_CHARS.water, 'Deep water. Nobody walks on it.'),
  plain('trees', 'Trees', MATERIAL_CHARS.tree, 'A wood. Trees stand two tiles wide; a lone tile of it is a bush.'),
  plain('rock', 'Rock', MATERIAL_CHARS.cliff, 'A rock mound. Solid.'),
  plain('fence', 'Fence', MATERIAL_CHARS.fence, 'A post-and-rail fence. Solid.'),
  plain('hedge', 'Hedge', MATERIAL_CHARS.hedge, 'A clipped hedge. Solid.'),
  {
    id: 'flowers',
    label: 'Flowers',
    help: 'A flower bed, walked through. On lawn or grass.',
    letterFor: (under) => FLOWERS_ON[groundUnder(under)] ?? 'f',
    swatch: 'f',
  },
  {
    id: 'bush',
    label: 'Bush',
    help: 'One round bush. Solid.',
    letterFor: (under) => BUSH_ON[groundUnder(under)] ?? 'o',
    swatch: 'o',
  },
  {
    id: 'ledge',
    label: 'Ledge',
    help: 'A rocky ledge. Solid; draw it in a row and its ends join up.',
    letterFor: () => '=',
    swatch: '=',
  },
];

export function groundBrush(id: string): GroundBrush | undefined {
  return GROUND_BRUSHES.find((brush) => brush.id === id);
}

/**
 * A ledge drawn as a row of runs gets its two ends: the first piece of every
 * row of ledge is its west end and the last its east end, so a maker paints a
 * ledge as one stroke rather than choosing three pieces.
 */
export function joinLedges(row: string): string {
  const isLedge = (letter: string | undefined): boolean =>
    letter !== undefined && (LEDGE_LETTERS as readonly string[]).includes(letter);
  const letters = [...row];
  for (let x = 0; x < letters.length; x += 1) {
    if (!isLedge(letters[x])) {
      continue;
    }
    const west = !isLedge(letters[x - 1]);
    const east = !isLedge(letters[x + 1]);
    letters[x] = west && !east ? '<' : east && !west ? '>' : '=';
  }
  return letters.join('');
}

export interface BuildingChoice {
  readonly kind: MapFileBuildingKind;
  readonly label: string;
}

/** Every building, in the order a town is usually built. */
export const BUILDING_CHOICES: readonly BuildingChoice[] = (
  [
    ['house', 'House'],
    ['house-door', 'House, open door'],
    ['house-flowers', 'House with flowers'],
    ['cottage', 'Cottage'],
    ['cottage-door', 'Cottage, open door'],
    ['pokemon-center', 'Pokémon Center'],
    ['pokemon-center-door', 'Pokémon Center, open door'],
    ['poke-mart', 'Poké Mart'],
    ['poke-mart-door', 'Poké Mart, open door'],
    ['gym', 'Gym'],
    ['route-gate', 'Gatehouse'],
    ['forest-gate', 'Forest gatehouse'],
    ['league-gate', 'League gate'],
    ['sign', 'Sign'],
    ['sign-tips', 'Sign, trainer tips'],
  ] as const satisfies readonly (readonly [MapFileBuildingKind, string])[]
).map(([kind, label]) => ({ kind, label }));

export const HABITAT_LABELS: Readonly<Record<MapFileHabitat, string>> = {
  meadow: 'Meadow',
  field: 'Open field',
  wetland: 'Wetland',
  shore: 'Seashore',
  town: 'Town',
  woodland: 'Woodland',
};

/** The Pokémon a habitat's tall grass holds, as names, for the settings panel. */
export function habitatSpecies(habitat: MapFileHabitat): readonly string[] {
  return MAP_FILE_HABITATS[habitat].entries.map((entry) => entry.speciesId);
}
