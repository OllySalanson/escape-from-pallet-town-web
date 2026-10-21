import { POKEMON_ICON_ORDER } from '../pokemon/generated/pokemonIcons';
import { pokemonName, type FigureSpeciesId } from '../world/pokemonFigures';
import { FURNITURE_PIECES, type FurniturePieceName } from './generated/furniturePieces';
import { aOrAn } from '../ui/article';

/**
 * The things a player can pick up and put down in THE BOLTHOLE.
 *
 * The captain grew up on Habbo Hotel, where the fun was a room you filled with
 * things you had got hold of and arranged yourself. This is that, in the
 * game's own grain: a piece is a thing in a place (the base's rule - progress
 * you can see beats a ledger), and where a piece comes from is the point of it.
 * There are three answers, and a piece has exactly one:
 *
 * - **the house's own**: what was standing in the house already and a few
 *   things to go with it, so the first visit has something to move. Never
 *   stored - every save owns them.
 * - **found on a raid**: an item (`items.ts`, effect `furniture`) that takes
 *   squares in the pack, is lost with it on a wipe like any loot, and once it
 *   is banked is in the vault, which is where a piece is *owned*. The commoner
 *   ones lie in a map's ordinary pool; the super-rare ones are prizes
 *   (`world/loot.ts`).
 * - **a doll**: one for every kind of Pokémon the Pokédex holds
 *   (`hub/pokedex.ts`), so bringing a new kind home is a new thing for the
 *   house. Emerald's own Secret Base doll where Emerald drew one of Kanto's,
 *   FireRed's party icon otherwise.
 *
 * Nothing in this file is stored. What a save owns is derived from the vault
 * and the Pokédex (`./arrangement.ts`); where each thing stands is the one
 * list the save keeps (`RaidProgress.homeLayout`).
 *
 * The art is Ruby/Sapphire/Emerald's Secret Base decorations and FireRed's own
 * house, cut by `scripts/cut-home-furniture.mjs`.
 */

/**
 * What a piece is laid as, which is what it may share a tile with.
 *
 * - `floor`: flat on the floor - a mat, a rug. Something may stand on it.
 * - `standing`: stands on the floor or on a `floor` piece.
 * - `small`: a doll or a cushion, which also stands on a desk or a table
 *   top - the one stacking a Secret Base allows, and Habbo's whole joy.
 */
export type FurnitureLayer = 'floor' | 'standing' | 'small';

/** How one facing of a piece is drawn. */
export type FurnitureArt =
  | { readonly kind: 'sheet'; readonly piece: FurniturePieceName; readonly flip: boolean }
  | { readonly kind: 'icon'; readonly species: FigureSpeciesId; readonly flip: boolean };

export type FurnitureSource =
  | { readonly kind: 'house'; readonly count: number }
  | { readonly kind: 'found'; readonly itemId: string }
  | { readonly kind: 'doll'; readonly dexId: number };

export interface FurnitureDefinition {
  readonly id: string;
  /** What its caption and the decorating panel call it. */
  readonly name: string;
  /** What it says when faced and spoken to. */
  readonly line: string;
  readonly layer: FurnitureLayer;
  readonly width: number;
  readonly height: number;
  /**
   * Its tiles, a row a string, in its first facing: `#` solid, `.` walked on,
   * `T` solid with a top a `small` piece may stand on. Turned with the art.
   */
  readonly cells: readonly string[];
  /** Every way it can be turned, in the order R turns it. At least one. */
  readonly facings: readonly FurnitureArt[];
  readonly source: FurnitureSource;
  /** Super rare: a raid prize, not a find. Said on its panel line. */
  readonly rare?: boolean;
}

/**
 * The same piece of art, the other way round. Only for a piece lit from
 * straight above or from the front - a doll, a cushion, a chair - since a
 * mirrored piece lit from the top left would be lit from the top right, which
 * nothing else in the house is.
 */
const turnable = (piece: FurniturePieceName): readonly FurnitureArt[] => [
  { kind: 'sheet', piece, flip: false },
  { kind: 'sheet', piece, flip: true },
];
const fixed = (piece: FurniturePieceName): readonly FurnitureArt[] => [{ kind: 'sheet', piece, flip: false }];

/** A piece's tiles as `#` all over: solid, all the way up. */
const solid = (piece: FurniturePieceName): readonly string[] => {
  const { width, height } = FURNITURE_PIECES[piece];
  return Array.from({ length: height }, () => '#'.repeat(width));
};
/** A piece's tiles as `.` all over: walked on. */
const flat = (piece: FurniturePieceName): readonly string[] => {
  const { width, height } = FURNITURE_PIECES[piece];
  return Array.from({ length: height }, () => '.'.repeat(width));
};

interface PieceInit {
  readonly id: string;
  readonly name: string;
  readonly line: string;
  readonly layer: FurnitureLayer;
  readonly piece: FurniturePieceName;
  readonly cells?: readonly string[];
  readonly facings?: readonly FurnitureArt[];
  readonly source: FurnitureSource;
  readonly rare?: boolean;
}

function piece(init: PieceInit): FurnitureDefinition {
  const { width, height } = FURNITURE_PIECES[init.piece];
  return {
    id: init.id,
    name: init.name,
    line: init.line,
    layer: init.layer,
    width,
    height,
    cells: init.cells ?? (init.layer === 'floor' ? flat(init.piece) : solid(init.piece)),
    facings: init.facings ?? fixed(init.piece),
    source: init.source,
    ...(init.rare ? { rare: true } : {}),
  };
}

const house = (count: number): FurnitureSource => ({ kind: 'house', count });
const found = (itemId: string): FurnitureSource => ({ kind: 'found', itemId });

/**
 * Every piece that is not a doll. A piece found on a raid shares its id with
 * the item it is carried home as.
 *
 * Collision follows the Secret Base's own rules (`DECORPERM_*` in
 * pret/pokeemerald's `src/data/decoration/header.h`) with one change, the
 * house's own: something two tiles tall is solid all the way up, because a
 * figure standing behind it would be standing hidden in it.
 */
const PIECES: readonly FurnitureDefinition[] = [
  // --- the house's own ------------------------------------------------------
  piece({
    id: 'pot-plant',
    name: 'POT PLANT',
    line: 'A pot plant. It has been in the house longer than you have.',
    layer: 'standing',
    piece: 'pot-plant-west',
    // FireRed draws the house's plant twice, lit from either side of the
    // room, and turning one is choosing which.
    facings: [
      { kind: 'sheet', piece: 'pot-plant-west', flip: false },
      { kind: 'sheet', piece: 'pot-plant-east', flip: false },
    ],
    source: house(2),
  }),
  piece({
    id: 'dining-table',
    name: 'THE TABLE',
    line: 'The table, on its green rug. There are four chairs and there has never been a meal for four.',
    layer: 'floor',
    piece: 'dining-table',
    cells: ['......', '..TT..', '..TT..', '......'],
    source: house(1),
  }),
  piece({
    id: 'small-desk',
    name: 'SMALL DESK',
    line: 'A small desk. Just big enough for one doll.',
    layer: 'standing',
    piece: 'small-desk',
    cells: ['T'],
    source: house(1),
  }),
  piece({
    id: 'small-chair',
    name: 'SMALL CHAIR',
    line: 'A small chair. It creaks.',
    layer: 'standing',
    piece: 'small-chair',
    cells: ['.'],
    facings: turnable('small-chair'),
    source: house(1),
  }),
  piece({
    id: 'red-plant',
    name: 'RED PLANT',
    line: 'A red flowering plant in a pot.',
    layer: 'standing',
    piece: 'red-plant',
    source: house(1),
  }),
  piece({
    id: 'round-cushion',
    name: 'ROUND CUSHION',
    line: 'A round cushion. Somebody has been sitting on it.',
    layer: 'small',
    piece: 'round-cushion',
    facings: turnable('round-cushion'),
    source: house(1),
  }),

  // --- found on a raid ----------------------------------------------------
  piece({
    id: 'pika-cushion',
    name: 'PIKA CUSHION',
    line: 'A cushion with PIKACHU on it. It does not crackle when sat on.',
    layer: 'small',
    piece: 'pika-cushion',
    facings: turnable('pika-cushion'),
    source: found('pika-cushion'),
  }),
  piece({
    id: 'ball-cushion',
    name: 'BALL CUSHION',
    line: 'A cushion done up as a POKé BALL.',
    layer: 'small',
    piece: 'ball-cushion',
    source: found('ball-cushion'),
  }),
  piece({
    id: 'fire-cushion',
    name: 'FIRE CUSHION',
    line: 'A red cushion with a flame on it.',
    layer: 'small',
    piece: 'fire-cushion',
    facings: turnable('fire-cushion'),
    source: found('fire-cushion'),
  }),
  piece({
    id: 'water-cushion',
    name: 'WATER CUSHION',
    line: 'A blue cushion with a drop on it.',
    layer: 'small',
    piece: 'water-cushion',
    facings: turnable('water-cushion'),
    source: found('water-cushion'),
  }),
  piece({
    id: 'pokemon-chair',
    name: 'POKéMON CHAIR',
    line: 'A chair with a POKé BALL on its back.',
    layer: 'standing',
    piece: 'pokemon-chair',
    cells: ['.'],
    facings: turnable('pokemon-chair'),
    source: found('pokemon-chair'),
  }),
  piece({
    id: 'comfort-chair',
    name: 'COMFORT CHAIR',
    line: 'A soft green chair. Sit in it after a raid.',
    layer: 'standing',
    piece: 'comfort-chair',
    cells: ['.'],
    facings: turnable('comfort-chair'),
    source: found('comfort-chair'),
  }),
  piece({
    id: 'pokemon-desk',
    name: 'POKéMON DESK',
    line: 'A desk with a POKé BALL on the front.',
    layer: 'standing',
    piece: 'pokemon-desk',
    cells: ['T'],
    source: found('pokemon-desk'),
  }),
  piece({
    id: 'heavy-desk',
    name: 'HEAVY DESK',
    line: 'A big steel desk. Room for a whole row of dolls.',
    layer: 'standing',
    piece: 'heavy-desk',
    cells: ['TTT', 'TTT'],
    source: found('heavy-desk'),
  }),
  piece({
    id: 'tropical-plant',
    name: 'TROPICAL PLANT',
    line: 'A tall tropical plant. It likes the harbour air.',
    layer: 'standing',
    piece: 'tropical-plant',
    source: found('tropical-plant'),
  }),
  piece({
    id: 'pretty-flowers',
    name: 'PRETTY FLOWERS',
    line: 'Pink flowers in a pot.',
    layer: 'standing',
    piece: 'pretty-flowers',
    source: found('pretty-flowers'),
  }),
  piece({
    id: 'big-plant',
    name: 'BIG PLANT',
    line: 'A big leafy plant in a big pot.',
    layer: 'standing',
    piece: 'big-plant',
    source: found('big-plant'),
  }),
  piece({
    id: 'surf-mat',
    name: 'SURF MAT',
    line: 'A round mat printed with a wave.',
    layer: 'floor',
    piece: 'surf-mat',
    source: found('surf-mat'),
  }),
  piece({
    id: 'thunder-mat',
    name: 'THUNDER MAT',
    line: 'A round mat printed with lightning.',
    layer: 'floor',
    piece: 'thunder-mat',
    source: found('thunder-mat'),
  }),
  piece({
    id: 'fire-blast-mat',
    name: 'FIRE BLAST MAT',
    line: 'A round orange mat printed with fire.',
    layer: 'floor',
    piece: 'fire-blast-mat',
    source: found('fire-blast-mat'),
  }),
  piece({
    id: 'powder-snow-mat',
    name: 'POWDER SNOW MAT',
    line: 'A round mat printed with snowflakes.',
    layer: 'floor',
    piece: 'powder-snow-mat',
    source: found('powder-snow-mat'),
  }),
  piece({
    id: 'cute-tv',
    name: 'CUTE TV',
    line: 'A little pink television. It only gets one channel.',
    layer: 'standing',
    piece: 'cute-tv',
    source: found('cute-tv'),
  }),

  // --- super rare: prizes -------------------------------------------------
  piece({
    id: 'glitter-mat',
    name: 'GLITTER MAT',
    line: 'A mat that glitters whichever way the light comes. There cannot be many of these.',
    layer: 'floor',
    piece: 'glitter-mat',
    source: found('glitter-mat'),
    rare: true,
  }),
  piece({
    id: 'gorgeous-plant',
    name: 'GORGEOUS PLANT',
    line: 'A gorgeous plant in a carved pot. Nobody knows who grew it.',
    layer: 'standing',
    piece: 'gorgeous-plant',
    source: found('gorgeous-plant'),
    rare: true,
  }),
  piece({
    id: 'gold-shield',
    name: 'GOLD SHIELD',
    line: 'A gold shield on a stand. Somebody won this once.',
    layer: 'standing',
    piece: 'gold-shield',
    source: found('gold-shield'),
    rare: true,
  }),
  piece({
    id: 'silver-shield',
    name: 'SILVER SHIELD',
    line: 'A silver shield on a stand. Second place, polished every day.',
    layer: 'standing',
    piece: 'silver-shield',
    source: found('silver-shield'),
    rare: true,
  }),
  piece({
    id: 'glass-ornament',
    name: 'GLASS ORNAMENT',
    line: 'A glass ornament of a POKéMON, catching the light. It is the rarest thing in the house.',
    layer: 'standing',
    piece: 'glass-ornament',
    source: found('glass-ornament'),
    rare: true,
  }),
];

/** The Kanto Pokémon Emerald drew a Secret Base doll of, by dex number. */
const EMERALD_DOLLS: Readonly<Record<number, FurniturePieceName>> = {
  3: 'doll-3',
  6: 'doll-6',
  7: 'doll-7',
  9: 'doll-9',
  25: 'doll-25',
  35: 'doll-35',
  39: 'doll-39',
  52: 'doll-52',
  81: 'doll-81',
  112: 'doll-112',
  131: 'doll-131',
  132: 'doll-132',
  143: 'doll-143',
};

/** The doll of a kind of Pokémon, by dex number. */
function doll(dexId: number): FurnitureDefinition {
  const species = POKEMON_ICON_ORDER[dexId - 1];
  const name = pokemonName(species).toUpperCase();
  const emerald = EMERALD_DOLLS[dexId];
  // A big doll stands on the floor. A small one - and every party-icon doll -
  // fits on a desk.
  const big = emerald !== undefined && FURNITURE_PIECES[emerald].width > 1;
  return {
    id: dollId(dexId),
    name: `${name} DOLL`,
    line: big
      ? `A huge ${name} doll. It is for the first ${name} you ever brought home.`
      : `${aOrAn(name) === 'an' ? 'An' : 'A'} ${name} doll, for the first ${name} you ever brought home.`,
    layer: big ? 'standing' : 'small',
    width: big ? FURNITURE_PIECES[emerald].width : 1,
    height: big ? FURNITURE_PIECES[emerald].height : 1,
    cells: big ? solid(emerald) : ['#'],
    facings: emerald
      ? turnable(emerald)
      : [
          { kind: 'icon', species, flip: false },
          { kind: 'icon', species, flip: true },
        ],
    source: { kind: 'doll', dexId },
  };
}

export const dollId = (dexId: number): string => `doll-${dexId}`;

/** Every piece there is: the house's own, the finds, and a doll for each of the 151. */
export const FURNITURE: readonly FurnitureDefinition[] = [
  ...PIECES,
  ...POKEMON_ICON_ORDER.map((_species, index) => doll(index + 1)),
];

const BY_ID = new Map(FURNITURE.map((definition) => [definition.id, definition]));

export function furnitureNamed(id: string): FurnitureDefinition | undefined {
  return BY_ID.get(id);
}

/** Every piece a raid can find, by the item it is carried home as. */
export const FOUND_FURNITURE: readonly FurnitureDefinition[] = PIECES.filter(
  (definition) => definition.source.kind === 'found',
);

/** A piece's tiles in one facing, a row a string: a mirrored facing mirrors its tiles. */
export function cellsFacing(definition: FurnitureDefinition, facing: number): readonly string[] {
  const art = definition.facings[facing % definition.facings.length];
  return art.flip ? definition.cells.map((row) => [...row].reverse().join('')) : definition.cells;
}
