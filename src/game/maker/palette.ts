import {
  MAP_FILE_HABITATS,
  type MapFileAreaStyle,
  type MapFileBuildingKind,
  type MapFileFacing,
  type MapFileFurnitureKind,
  type MapFileHabitat,
  type MapFileLook,
} from '../world/mapFile';
import { MATERIAL_CHARS } from '../world/tileset/materials';

/**
 * What the map maker paints with, in the words a maker reads.
 *
 * The palette is the FireRed look: every brush is a material or a stamp the
 * Kanto sheet draws, so a map can only be painted in the art the game's own
 * Viridian City is painted in (the captain's D1 - "FireRed look for every map"
 * is what the palette offers, not a rule a map has to pass). The things a
 * maker plants are every object the game already draws (the captain, on the
 * palette board, 2026-10-10: "as much stuff in the map maker as possible"),
 * which since then includes the Floodplain's CC0 objects.
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
const BUSH_ON: Readonly<Record<string, string>> = {
  [MATERIAL_CHARS.turf]: 'u',
  [MATERIAL_CHARS.paving]: 'k',
};

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
  plain(
    'tall-grass',
    'Tall grass',
    MATERIAL_CHARS['tall-grass'],
    'Wild Pokémon live in it: every step on it can start a fight.',
  ),
  plain('turf', 'Lawn', MATERIAL_CHARS.turf, 'Mown lawn, as in a garden or a town.'),
  plain('sand', 'Sand road', MATERIAL_CHARS.sand, 'A sandy road. Looks best two tiles wide.'),
  plain('paving', 'Paving', MATERIAL_CHARS.paving, 'Town paving. Looks best two tiles wide.'),
  plain('earth', 'Earth path', MATERIAL_CHARS.earth, 'A trodden earth lane. Looks best two tiles wide.'),
  plain('stone', 'Stone floor', MATERIAL_CHARS.stone, 'Grey brick: a yard somebody keeps.'),
  plain('gravel', 'Gravel', MATERIAL_CHARS.gravel, 'Dark grit: a yard nobody sweeps.'),
  plain('beach', 'Beach', MATERIAL_CHARS.beach, 'Sand that meets the water with a shoreline.'),
  plain('water', 'Water', MATERIAL_CHARS.water, 'Deep water. Nobody walks on it.'),
  plain('ford', 'Shallow water', MATERIAL_CHARS.ford, 'Water shallow enough to wade: a crossing.'),
  plain(
    'trees',
    'Trees',
    MATERIAL_CHARS.tree,
    'A wood. Trees stand two tiles wide; a lone tile of it is a bush.',
  ),
  plain('rock', 'Rock', MATERIAL_CHARS.cliff, 'A rock mound. Solid.'),
  plain('fence', 'Fence', MATERIAL_CHARS.fence, 'A post-and-rail fence. Solid.'),
  plain('hedge', 'Hedge', MATERIAL_CHARS.hedge, 'A clipped hedge. Solid.'),
  plain('wall', 'Wall', MATERIAL_CHARS.wall, 'A built wall. Solid.'),
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
    help: 'A rocky ledge. Hop down it, never up - the hunter cannot follow. Draw it in a row and its ends join up.',
    letterFor: () => '=',
    swatch: '=',
  },
];

/**
 * What the inside of a building is painted with: its floor and its wall. A
 * room's look - the floor's pattern, the wall's colour - is its style, chosen
 * for the whole room, the way a FireRed room is one tileset.
 */
export const INSIDE_BRUSHES: readonly GroundBrush[] = [
  plain('floor', 'Floor', MATERIAL_CHARS.paving, 'The floor of the room. Walked on.'),
  plain(
    'wall',
    'Wall',
    MATERIAL_CHARS.wall,
    'A wall. Solid. Two rows of it make the back wall of a room.',
  ),
];

/** The brushes for the place being drawn: outdoors, or the inside of a building. */
export function brushesFor(inside: boolean): readonly GroundBrush[] {
  return inside ? INSIDE_BRUSHES : GROUND_BRUSHES;
}

export function groundBrush(id: string, inside = false): GroundBrush | undefined {
  return brushesFor(inside).find((brush) => brush.id === id);
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

/** The headings the things a maker can plant are listed under, in order. */
export const PLANT_GROUPS = ['Buildings', 'Landmarks', 'Nature', 'Town', 'Things', 'Signs'] as const;
export type PlantGroup = (typeof PLANT_GROUPS)[number];

export interface BuildingChoice {
  readonly kind: MapFileBuildingKind;
  readonly label: string;
  readonly group: PlantGroup;
  /** What its picture in the list stands on: most things on grass, a jetty on water. */
  readonly on?: 'water';
}

/** Everything a maker can plant, under its heading, in the order a town is usually built. */
export const BUILDING_CHOICES: readonly BuildingChoice[] = (
  [
    ['house', 'House', 'Buildings'],
    ['house-door', 'House, open door', 'Buildings'],
    ['house-flowers', 'House with flowers', 'Buildings'],
    ['cottage', 'Cottage', 'Buildings'],
    ['cottage-door', 'Cottage, open door', 'Buildings'],
    ['blue-cottage', 'Blue-roof cottage', 'Buildings'],
    ['pokemon-center', 'Pokémon Center', 'Buildings'],
    ['pokemon-center-door', 'Pokémon Center, open door', 'Buildings'],
    ['poke-mart', 'Poké Mart', 'Buildings'],
    ['poke-mart-door', 'Poké Mart, open door', 'Buildings'],
    ['gym', 'Gym', 'Buildings'],
    ['shop', 'Shop', 'Buildings'],
    ['shed', 'Shed', 'Buildings'],
    ['timber-house', 'Timber house', 'Buildings'],
    ['hut', 'Hut', 'Buildings'],
    ['tower', 'Stone tower', 'Buildings'],
    ['roundhouse', 'Roundhouse', 'Buildings'],
    ['route-gate', 'Gatehouse', 'Buildings'],
    ['forest-gate', 'Forest gatehouse', 'Buildings'],
    ['league-gate', 'League gate', 'Buildings'],
    ['stone-gatehouse', 'Stone gatehouse', 'Buildings'],
    ['shrine', 'Shrine', 'Buildings'],
    ['museum', 'Pewter Museum', 'Landmarks'],
    ['department-store', 'Department store', 'Landmarks'],
    ['silph-co', 'Silph Co. tower', 'Landmarks'],
    ['game-corner', 'Game Corner', 'Landmarks'],
    ['pokemon-tower', 'Pokémon Tower', 'Landmarks'],
    ['pokemon-mansion', 'Pokémon Mansion', 'Landmarks'],
    ['research-lab', 'Research lab', 'Landmarks'],
    ['dojo', 'Fighting Dojo', 'Landmarks'],
    ['bike-shop', 'Bike shop', 'Landmarks'],
    ['safari-gate', 'Safari Zone gate', 'Landmarks'],
    ['city-gate', 'City gatehouse', 'Landmarks'],
    ['pewter-gym', 'Pewter Gym', 'Landmarks'],
    ['cerulean-gym', 'Cerulean Gym', 'Landmarks'],
    ['vermilion-gym', 'Vermilion Gym', 'Landmarks'],
    ['celadon-gym', 'Celadon Gym', 'Landmarks'],
    ['fuchsia-gym', 'Fuchsia Gym', 'Landmarks'],
    ['saffron-gym', 'Saffron Gym', 'Landmarks'],
    ['cinnabar-gym', 'Cinnabar Gym', 'Landmarks'],
    ['pier', 'Pier', 'Landmarks'],
    ['round-fountain', 'Round fountain', 'Town'],
    ['flats', 'Block of flats', 'Buildings'],
    ['small-flats', 'Small flats', 'Buildings'],
    ['apartments', 'Apartments', 'Buildings'],
    ['terrace', 'Terraced house', 'Buildings'],
    ['diner', 'Diner', 'Buildings'],
    ['brick-shops', 'Brick shops', 'Buildings'],
    ['grey-house', 'Grey-roof house', 'Buildings'],
    ['blue-house', 'Blue-roof house', 'Buildings'],
    ['orange-house', 'Orange-roof house', 'Buildings'],
    ['flower-house', 'Window-box house', 'Buildings'],
    ['fan-club', 'Green-roof club', 'Buildings'],
    ['purple-house', 'Purple-roof house', 'Buildings'],
    ['green-house', 'Green-roof house', 'Buildings'],
    ['green-cottage', 'Green-roof cottage', 'Buildings'],
    ['warden-house', 'Thatched house', 'Buildings'],
    ['wooden-sign', 'Wooden sign', 'Signs'],
    ['route-sign', 'Metal sign', 'Signs'],
    ['gym-statue', 'Gym statue', 'Town'],
    ['town-map', 'Town map board', 'Signs'],
    ['lapras-doll', 'Lapras doll', 'Things'],
    ['strange-stone', 'Strange stone', 'Nature'],
    ['ss-anne', 'S.S. Anne', 'Landmarks', 'water'],
    ['ferry', 'Seagallop ferry', 'Landmarks', 'water'],
    ['tree', 'Tree', 'Nature'],
    ['tree-2', 'Tree, wider', 'Nature'],
    ['pine', 'Pine', 'Nature'],
    ['tall-bush', 'Tall bush', 'Nature'],
    ['small-tree', 'Small tree', 'Nature'],
    ['rock', 'Rock', 'Nature'],
    ['round-boulder', 'Boulder', 'Nature'],
    ['rock-stair', 'Rock with steps', 'Nature'],
    ['wet-rock', 'Rock in water', 'Nature', 'water'],
    ['stump', 'Stump', 'Nature'],
    ['big-stump', 'Big stump', 'Nature'],
    ['dead-stump', 'Dead stump', 'Nature'],
    ['log', 'Log', 'Nature'],
    ['lilies', 'Lily pad', 'Nature', 'water'],
    ['lilies-wide', 'Lily pads', 'Nature', 'water'],
    ['fountain', 'Fountain', 'Town'],
    ['stone-fountain', 'Stone fountain', 'Town'],
    ['plaza-steps', 'Grand steps', 'Town'],
    ['statue', 'Statue', 'Town'],
    ['gravestone', 'Gravestone', 'Town'],
    ['gravestone-worn', 'Old gravestone', 'Town'],
    ['stone-arch', 'Stone arch', 'Town'],
    ['gate-arch', 'Gate arch', 'Town'],
    ['bridge', 'Bridge', 'Town', 'water'],
    ['bridge-across', 'Bridge, across', 'Town', 'water'],
    ['stone-bridge', 'Stone bridge', 'Town', 'water'],
    ['jetty', 'Jetty', 'Town', 'water'],
    ['market-stall', 'Market stall', 'Town'],
    ['striped-stall', 'Striped stall', 'Town'],
    ['produce-stall', 'Produce stall', 'Town'],
    ['stall-counter', 'Stall counter', 'Town'],
    ['awning', 'Awning', 'Town'],
    ['banner', 'Banner', 'Town'],
    ['banners', 'Banners', 'Town'],
    ['flag', 'Flag', 'Town'],
    ['pot', 'Pot', 'Things'],
    ['planter', 'Planter', 'Things'],
    ['pot-plant', 'Pot plant', 'Things'],
    ['crate', 'Crate', 'Things'],
    ['crates', 'Crates', 'Things'],
    ['crate-pair', 'Two crates', 'Things'],
    ['crate-stack', 'Stacked crates', 'Things'],
    ['crate-tower', 'Crate tower', 'Things'],
    ['barrel', 'Barrel', 'Things'],
    ['barrels', 'Barrels', 'Things'],
    ['sack', 'Sack', 'Things'],
    ['produce', 'Produce', 'Things'],
    ['produce-crate', 'Crate of produce', 'Things'],
    ['bench', 'Bench', 'Things'],
    ['mooring-post', 'Mooring post', 'Things'],
    ['fence-post', 'Fence post', 'Things'],
    ['rail-post', 'Rail post', 'Things'],
    ['seedlings', 'Seedling bed', 'Things'],
    ['yellow-crop', 'Yellow crop', 'Things'],
    ['red-crop', 'Red crop', 'Things'],
    ['sign', 'Sign', 'Signs'],
    ['sign-tips', 'Sign, trainer tips', 'Signs'],
    ['signpost', 'Route signpost', 'Signs'],
    ['notice-board', 'Notice board', 'Signs'],
    ['gym-sign', 'Gym sign', 'Signs'],
    ['signboard', 'Signboard', 'Signs'],
  ] as const satisfies readonly (
    | readonly [MapFileBuildingKind, string, PlantGroup]
    | readonly [MapFileBuildingKind, string, PlantGroup, 'water']
  )[]
).map(([kind, label, group, on]) => ({ kind, label, group, ...(on ? { on } : {}) }));

export interface FurnitureChoice {
  readonly kind: MapFileFurnitureKind;
  readonly label: string;
  /**
   * The room style it belongs in. Every piece but the bed was cut from one of
   * the base's own FireRed rooms with that room's floor in it, so a lab's
   * shelves stood on a house's boards show a strip of the lab under them; a
   * room offers its own pieces and the ones cut clean.
   */
  readonly style?: MapFileAreaStyle;
}

/** Every piece of furniture, by the room it comes from. */
export const FURNITURE_CHOICES: readonly FurnitureChoice[] = (
  [
    ['bed', 'Bed', undefined],
    ['pc', 'PC', 'house'],
    ['desk', 'Desk', 'house'],
    ['drawers', 'Drawers', 'house'],
    ['books', 'Stack of books', 'house'],
    ['wooden-box', 'Wooden box', 'house'],
    ['house-plant', 'Plant', 'house'],
    ['pillar', 'Pillar', 'house'],
    ['cell-separators', 'Cell separators', 'house'],
    ['table', 'Table', 'lab'],
    ['computers', 'Computers', 'lab'],
    ['bookcase', 'Bookcase', 'lab'],
    ['shelves-books', 'Long shelves', 'lab'],
    ['shelves-jars', 'Long shelves, end post', 'lab'],
    ['shelves-empty', 'Empty shelves', 'lab'],
    ['machine', 'Poké Ball machine', 'lab'],
    ['plant', 'Plant', 'lab'],
    ['plant-pot', 'Plant, turned', 'lab'],
    ['center-counter', 'Counter and back wall', 'center'],
    ['center-wall-west', 'West wall', 'center'],
    ['center-wall-east', 'East wall', 'center'],
    ['center-emblem', 'Floor emblem', 'center'],
    ['seats', 'Waiting seats', 'center'],
    ['healing-machine', 'Healing machine', 'center'],
    ['tall-plant', 'Plant', 'center'],
    ['workbench', 'Workbench', 'warehouse'],
    ['stool', 'Stool', 'warehouse'],
    ['sofa', 'Sofa', 'warehouse'],
    ['bunk', 'Bunk', 'warehouse'],
    ['generator', 'Generator', 'warehouse'],
    ['monitors', 'Monitors', 'warehouse'],
    ['radio-set', 'Radio set', 'warehouse'],
    ['telephone', 'Telephone', 'warehouse'],
    ['vent', 'Vent', 'warehouse'],
    ['big-crate', 'Big crate', 'warehouse'],
    ['box', 'Box', 'warehouse'],
    ['boxes', 'Boxes', 'warehouse'],
    ['tall-box', 'Tall box', 'warehouse'],
  ] as const satisfies readonly (readonly [
    MapFileFurnitureKind,
    string,
    MapFileAreaStyle | undefined,
  ])[]
).map(([kind, label, style]) => (style ? { kind, label, style } : { kind, label }));

/** The furniture a room in this style is furnished from. */
export function furnitureFor(style: MapFileAreaStyle): readonly FurnitureChoice[] {
  return FURNITURE_CHOICES.filter((choice) => choice.style === undefined || choice.style === style);
}

/** What each room style is called in the editor. */
export const STYLE_LABELS: Readonly<Record<MapFileAreaStyle, string>> = {
  house: 'House',
  lab: 'Lab',
  center: 'Pokémon Center',
  warehouse: 'Warehouse',
};

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

/** What each look is called in the editor. */
export const LOOK_LABELS: Readonly<Record<MapFileLook, string>> = {
  boy: 'Boy',
  woman: 'Woman',
  'heavy-man': 'Big man',
  'bald-man': 'Bald man',
  scientist: 'Scientist',
  'old-man': 'Old man',
  'old-woman': 'Old woman',
  'straw-hat': 'Gardener',
  lass: 'Lass',
  youngster: 'Youngster',
  'bug-catcher': 'Bug catcher',
  hiker: 'Hiker',
  cooltrainer: 'Cool trainer',
  beauty: 'Beauty',
  sailor: 'Sailor',
  'black-belt': 'Black belt',
  camper: 'Camper',
  picnicker: 'Picnicker',
  fisherman: 'Fisherman',
  swimmer: 'Swimmer',
  'swimmer-woman': 'Swimmer, woman',
  'tuber-boy': 'Boy with a rubber ring',
  'tuber-girl': 'Girl with a rubber ring',
  'little-boy': 'Little boy',
  'little-girl': 'Little girl',
  rocker: 'Rocker',
  channeler: 'Channeler',
  gentleman: 'Gentleman',
  'rich-boy': 'Rich boy',
  'crush-girl': 'Crush girl',
  'cooltrainer-woman': 'Cool trainer, woman',
  'poke-maniac': 'Poké Maniac',
  'rocket-grunt': 'Rocket grunt',
  'rocket-grunt-woman': 'Rocket grunt, woman',
  policeman: 'Policeman',
  captain: 'Ship captain',
  chef: 'Chef',
  clerk: 'Shop clerk',
  'gym-guide': 'Gym guide',
  worker: 'Worker',
  'worker-woman': 'Worker, woman',
  man: 'Man',
  cameraman: 'Cameraman',
};

export const FACING_LABELS: Readonly<Record<MapFileFacing, string>> = {
  down: 'Down',
  up: 'Up',
  left: 'Left',
  right: 'Right',
};
