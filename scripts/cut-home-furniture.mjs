// Cuts the furniture a player arranges in THE BOLTHOLE into one sheet,
// `public/assets/home-furniture.png`, and writes a 16x16 bag icon for every
// piece that is found on a raid.
//
//   git clone --depth 1 --filter=blob:none --sparse https://github.com/pret/pokeemerald.git /tmp/pokeemerald
//   git -C /tmp/pokeemerald fetch --depth 1 origin 731ad5bfd6e6f265508d0efcca0ba42f9dcf5881
//   git -C /tmp/pokeemerald checkout 731ad5bfd6e6f265508d0efcca0ba42f9dcf5881
//   git -C /tmp/pokeemerald sparse-checkout set --no-cone /data/tilesets/primary/secret_base/ \
//     /data/tilesets/secondary/secret_base/ /src/data/decoration/ /include/constants/metatile_labels.h \
//     /graphics/object_events/pics/dolls/ /graphics/object_events/pics/cushions/ \
//     /graphics/object_events/palettes/ /src/data/object_events/
//   node scripts/cut-home-furniture.mjs /tmp/pokeemerald
//
// FireRed has no furniture to move: a FireRed house is drawn into its map.
// Ruby, Sapphire and Emerald do, in a Secret Base - desks, chairs, plants,
// mats, cushions and dolls a player buys or wins and lays out on a grid - and
// that is the art this cuts, from pret/pokeemerald at a pinned commit. It is
// the same generation and the same sixteen-colour palettes as FireRed's own
// rooms, which is why a Surf Mat lies on the Bolthole's floor without a seam.
// The two pieces of the house itself that move - its pot plants and its table
// - are FireRed's own and are copied off THE BOLTHOLE's sheet, which
// `cut-frlg-home.mjs` draws from pret/pokefirered, so every piece a player can
// pick up is on one sheet.
//
// Three kinds of source, each read the way the game reads it:
//
// - A **decoration** is laid as metatiles (`src/data/decoration/tiles.h` names
//   them, row by row, by their labels in `metatile_labels.h`). Every
//   decoration metatile is drawn standing on a Secret Base's cave floor, and
//   the floor is the room's secondary tileset (tiles 512 and up) while the
//   furniture is the shared primary one, so the floor is left out by tile
//   index and the piece lies on whatever floor it is put down on.
// - A **doll** or a **cushion** is an object-event picture, drawn in the NPC
//   palette its graphics info names (`object_event_graphics_info.h`).
// - A **FireRed piece** is copied off `public/assets/frlg-home.png`, by the
//   name `src/game/base/generated/homePieces.ts` gives it.
//
// Nothing from pret is committed. What ships is the drawn pieces and the
// icons, and `public/assets/ASSET_PROVENANCE.md` credits the origin. The
// script writes `src/game/home/generated/furniturePieces.ts`, which is the
// only thing that knows where on the sheet a piece landed.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { blank, crop, drawPicture, paste, readPalette, tilesetPair } from './gba.mjs';
import { readPng, writePng } from '../tools/tileset/tileSheet.mjs';

const TILE = 16;
const SHEET_COLUMNS = 16;
const ICON = 16;
/** Emerald's split between a Secret Base's two tilesets (`include/fieldmap.h`). */
const PRIMARY_TILES = 512;
const PRIMARY_METATILES = 512;
const PRIMARY_PALETTES = 6;

/**
 * Every piece, by where it comes from, and - for the pieces a raid can find -
 * the item whose 16x16 bag icon it is drawn into.
 */
const PIECES = [
  // --- FireRed's own: the house's plants and its table, which now move
  { name: 'pot-plant-west', firered: 'home.plantWest' },
  { name: 'pot-plant-east', firered: 'home.plantEast' },
  { name: 'dining-table', firered: 'home.rugTable' },

  // --- Secret Base decorations, by their DECOR_ id
  { name: 'small-desk', decor: 'SMALL_DESK' },
  { name: 'pokemon-desk', decor: 'POKEMON_DESK', icon: 'pokemon-desk' },
  { name: 'heavy-desk', decor: 'HEAVY_DESK', icon: 'heavy-desk' },
  { name: 'small-chair', decor: 'SMALL_CHAIR' },
  { name: 'pokemon-chair', decor: 'POKEMON_CHAIR', icon: 'pokemon-chair' },
  { name: 'comfort-chair', decor: 'COMFORT_CHAIR', icon: 'comfort-chair' },
  { name: 'red-plant', decor: 'RED_PLANT' },
  { name: 'tropical-plant', decor: 'TROPICAL_PLANT', icon: 'tropical-plant' },
  { name: 'pretty-flowers', decor: 'PRETTY_FLOWERS', icon: 'pretty-flowers' },
  { name: 'big-plant', decor: 'BIG_PLANT', icon: 'big-plant' },
  { name: 'gorgeous-plant', decor: 'GORGEOUS_PLANT', icon: 'gorgeous-plant' },
  { name: 'surf-mat', decor: 'SURF_MAT', icon: 'surf-mat' },
  { name: 'thunder-mat', decor: 'THUNDER_MAT', icon: 'thunder-mat' },
  { name: 'fire-blast-mat', decor: 'FIRE_BLAST_MAT', icon: 'fire-blast-mat' },
  { name: 'powder-snow-mat', decor: 'POWDER_SNOW_MAT', icon: 'powder-snow-mat' },
  { name: 'glitter-mat', decor: 'GLITTER_MAT', icon: 'glitter-mat' },
  { name: 'cute-tv', decor: 'CUTE_TV', icon: 'cute-tv' },
  { name: 'gold-shield', decor: 'GOLD_SHIELD', icon: 'gold-shield' },
  { name: 'silver-shield', decor: 'SILVER_SHIELD', icon: 'silver-shield' },
  { name: 'glass-ornament', decor: 'GLASS_ORNAMENT', icon: 'glass-ornament' },

  // --- cushions
  { name: 'round-cushion', picture: 'cushions/round_cushion', info: 'RoundCushion' },
  { name: 'pika-cushion', picture: 'cushions/pika_cushion', info: 'PikaCushion', icon: 'pika-cushion' },
  { name: 'ball-cushion', picture: 'cushions/ball_cushion', info: 'BallCushion', icon: 'ball-cushion' },
  { name: 'fire-cushion', picture: 'cushions/fire_cushion', info: 'FireCushion', icon: 'fire-cushion' },
  { name: 'water-cushion', picture: 'cushions/water_cushion', info: 'WaterCushion', icon: 'water-cushion' },

  // --- the dolls Emerald draws of Kanto's own Pokemon. Two of them -
  // Squirtle and Magnemite - were drawn for the game and never sold in it.
  { name: 'doll-25', picture: 'dolls/pikachu_doll', info: 'PikachuDoll' },
  { name: 'doll-39', picture: 'dolls/jigglypuff_doll', info: 'JigglypuffDoll' },
  { name: 'doll-52', picture: 'dolls/meowth_doll', info: 'MeowthDoll' },
  { name: 'doll-35', picture: 'dolls/clefairy_doll', info: 'ClefairyDoll' },
  { name: 'doll-132', picture: 'dolls/ditto_doll', info: 'DittoDoll' },
  { name: 'doll-7', picture: 'dolls/unused_squirtle_doll', info: 'UnusedSquirtleDoll' },
  { name: 'doll-81', picture: 'dolls/unused_magnemite_doll', info: 'UnusedMagnemiteDoll' },
  { name: 'doll-3', picture: 'dolls/big_venusaur_doll', info: 'BigVenusaurDoll' },
  { name: 'doll-6', picture: 'dolls/big_charizard_doll', info: 'BigCharizardDoll' },
  { name: 'doll-9', picture: 'dolls/big_blastoise_doll', info: 'BigBlastoiseDoll' },
  { name: 'doll-112', picture: 'dolls/big_rhydon_doll', info: 'BigRhydonDoll' },
  { name: 'doll-131', picture: 'dolls/big_lapras_doll', info: 'BigLaprasDoll' },
  { name: 'doll-143', picture: 'dolls/big_snorlax_doll', info: 'BigSnorlaxDoll' },
];

// ---------------------------------------------------------------------------

const [pret] = process.argv.slice(2);
if (!pret) {
  console.error('usage: node scripts/cut-home-furniture.mjs <pret/pokeemerald checkout> (see the top of this script)');
  process.exit(1);
}

const read = (path) => readFileSync(join(pret, path), 'utf8');

/** `#define METATILE_SecretBase_<label> 0x...`, by label. */
const labels = new Map(
  [...read('include/constants/metatile_labels.h').matchAll(/#define METATILE_SecretBase_(\w+)\s+0x([0-9A-Fa-f]+)/g)].map(
    ([, label, id]) => [label, Number.parseInt(id, 16)],
  ),
);
/** `DecorGfx_<ID>[] = { DECOR_TILE(<label>), ... }`, by decoration id, in the order the game lays them. */
const decorTiles = new Map(
  [...read('src/data/decoration/tiles.h').matchAll(/DecorGfx_(\w+)\[\] = \{([^}]*)\}/g)].map(([, id, body]) => [
    id,
    [...body.matchAll(/DECOR_TILE\((\w+)\)/g)].map(([, label]) => {
      if (!labels.has(label)) throw new Error(`no metatile label SecretBase_${label}`);
      return labels.get(label);
    }),
  ]),
);
/** `[DECOR_<ID>] = { ... .shape = DECORSHAPE_<w>x<h> ... }`, by decoration id. */
const decorShapes = new Map(
  [...read('src/data/decoration/header.h').matchAll(/\[DECOR_(\w+)\]\s*=\s*\{[^}]*?\.shape = DECORSHAPE_(\d)x(\d)/g)].map(
    ([, id, width, height]) => [id, { width: Number(width), height: Number(height) }],
  ),
);
/** `gObjectEventGraphicsInfo_<Name> = { ... .paletteTag = OBJ_EVENT_PAL_TAG_NPC_<n> ...}`, by name. */
const pictureNpcPalette = new Map(
  [
    ...read('src/data/object_events/object_event_graphics_info.h').matchAll(
      /gObjectEventGraphicsInfo_(\w+) = \{[^}]*?\.paletteTag = OBJ_EVENT_PAL_TAG_NPC_(\d)/g,
    ),
  ].map(([, name, npc]) => [name, Number(npc)]),
);

// A Secret Base loads its primary tileset's palettes into the first six slots
// and its cave's into the rest. The furniture is all drawn in the first six,
// which is checked below: a piece in a cave palette would change colour from
// one base to the next, and there is no one right answer to cut.
const palettes = Array.from({ length: 16 }, (_slot, slot) =>
  readPalette(
    join(
      pret,
      slot < PRIMARY_PALETTES ? 'data/tilesets/primary/secret_base' : 'data/tilesets/secondary/secret_base/red_cave',
      'palettes',
      `${String(slot).padStart(2, '0')}.pal`,
    ),
  ),
);
const secretBase = tilesetPair({
  primaryTiles: join(pret, 'data/tilesets/primary/secret_base/tiles.png'),
  secondaryTiles: join(pret, 'data/tilesets/secondary/secret_base/red_cave/tiles.png'),
  primaryMetatiles: join(pret, 'data/tilesets/primary/secret_base/metatiles.bin'),
  secondaryMetatiles: join(pret, 'data/tilesets/secondary/secret_base/metatiles.bin'),
  palettes,
  split: { tiles: PRIMARY_TILES, metatiles: PRIMARY_METATILES },
});

function cutDecoration(id) {
  const shape = decorShapes.get(id);
  const tiles = decorTiles.get(id);
  if (!shape || !tiles) throw new Error(`no decoration ${id}`);
  if (tiles.length !== shape.width * shape.height) throw new Error(`${id}: ${tiles.length} tiles for a ${shape.width}x${shape.height}`);
  const image = blank(shape.width * TILE, shape.height * TILE);
  tiles.forEach((metatile, index) =>
    secretBase.drawMetatile(
      image,
      metatile,
      (index % shape.width) * TILE,
      Math.floor(index / shape.width) * TILE,
      (tile, palette) => {
        if (tile >= PRIMARY_TILES) return false;
        if (palette >= PRIMARY_PALETTES) throw new Error(`${id} is drawn in cave palette ${palette}`);
        return true;
      },
    ),
  );
  return image;
}

function cutPicture(picture, info) {
  const npc = pictureNpcPalette.get(info);
  if (!npc) throw new Error(`no graphics info for ${info}`);
  return drawPicture(
    join(pret, 'graphics/object_events/pics', `${picture}.png`),
    readPalette(join(pret, 'graphics/object_events/palettes', `npc_${npc}.pal`)),
  );
}

const homeSheet = readPng('public/assets/frlg-home.png');
const homePieces = Object.fromEntries(
  [...readFileSync('src/game/base/generated/homePieces.ts', 'utf8').matchAll(
    /'([\w.]+)': \{ column: (\d+), row: (\d+), width: (\d+), height: (\d+) \}/g,
  )].map(([, name, column, row, width, height]) => [name, { column: +column, row: +row, width: +width, height: +height }]),
);

const homePiece = (name) => {
  const at = homePieces[name];
  if (!at) throw new Error(`no FireRed home piece ${name}`);
  return crop(homeSheet, at.column * TILE, at.row * TILE, at.width * TILE, at.height * TILE);
};

/**
 * A FireRed piece, with the floor it was drawn standing on taken out. FireRed
 * draws a pot plant and the table's rug into metatiles that carry the room's
 * floor under them, and a piece that can be put down anywhere has to lie on
 * whatever floor is there - the shaded strip down the west wall, or another
 * rug. The floor is a tile repeated, so a pixel the same colour as the floor
 * at the same place in its tile is floor, and is cleared.
 */
function cutFireRed(name) {
  const image = homePiece(name);
  const floors = ['home.floor', 'home.floorShade'].map(homePiece);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const at = (y * image.width + x) * 4;
      const under = ((y % TILE) * TILE + (x % TILE)) * 4;
      if (floors.some((floor) => image.data.readUInt32BE(at) === floor.data.readUInt32BE(under))) {
        image.data.fill(0, at, at + 4);
      }
    }
  }
  return image;
}

const cut = PIECES.map((piece) => {
  const image = piece.firered
    ? cutFireRed(piece.firered)
    : piece.decor
      ? cutDecoration(piece.decor)
      : cutPicture(piece.picture, piece.info);
  if (image.width % TILE !== 0 || image.height % TILE !== 0) throw new Error(`${piece.name} is not whole tiles`);
  let ink = false;
  for (let i = 3; i < image.data.length; i += 4) ink ||= image.data[i] !== 0;
  if (!ink) throw new Error(`${piece.name} cut to nothing`);
  return { ...piece, image };
});

// Shelf packing, tallest first, as THE BOLTHOLE's own sheet is packed.
const order = [...cut].sort((a, b) => b.image.height - a.image.height || b.image.width - a.image.width);
const placed = new Map();
let column = 0;
let row = 0;
let shelfHeight = 0;
for (const piece of order) {
  const width = piece.image.width / TILE;
  const height = piece.image.height / TILE;
  if (column + width > SHEET_COLUMNS) {
    column = 0;
    row += shelfHeight;
    shelfHeight = 0;
  }
  placed.set(piece.name, { column, row, width, height });
  column += width;
  shelfHeight = Math.max(shelfHeight, height);
}
const rows = row + shelfHeight;
const sheet = blank(SHEET_COLUMNS * TILE, rows * TILE);
for (const piece of cut) {
  const at = placed.get(piece.name);
  paste(sheet, piece.image, at.column * TILE, at.row * TILE);
}
writePng('public/assets/home-furniture.png', sheet);

/**
 * A piece as a 16x16 bag icon. A piece one tile across is its own icon; a
 * bigger one is shrunk by a whole factor, each pixel the colour most of the
 * block it stands for is - never a blend, so nothing is drawn in an ink the
 * piece does not have - and centred.
 */
function iconOf(image) {
  const factor = Math.max(1, Math.ceil(Math.max(image.width, image.height) / ICON));
  const width = Math.ceil(image.width / factor);
  const height = Math.ceil(image.height / factor);
  const small = blank(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const votes = new Map();
      for (let dy = 0; dy < factor; dy += 1) {
        for (let dx = 0; dx < factor; dx += 1) {
          const sx = x * factor + dx;
          const sy = y * factor + dy;
          if (sx >= image.width || sy >= image.height) continue;
          const at = (sy * image.width + sx) * 4;
          const key = image.data[at + 3] === 0 ? 'clear' : image.data.readUInt32BE(at).toString(16);
          votes.set(key, (votes.get(key) ?? 0) + 1);
        }
      }
      const [winner] = [...votes.entries()].sort((a, b) => b[1] - a[1] || (a[0] === 'clear' ? 1 : -1))[0];
      if (winner !== 'clear') small.data.writeUInt32BE(Number.parseInt(winner, 16) >>> 0, (y * width + x) * 4);
    }
  }
  const icon = blank(ICON, ICON);
  paste(icon, small, Math.floor((ICON - width) / 2), Math.floor((ICON - height) / 2));
  return icon;
}

for (const piece of cut.filter((each) => each.icon)) {
  writePng(`public/assets/icons/${piece.icon}.png`, iconOf(piece.image));
}

mkdirSync('src/game/home/generated', { recursive: true });
const entries = cut
  .map((piece) => {
    const at = placed.get(piece.name);
    return `  '${piece.name}': { column: ${at.column}, row: ${at.row}, width: ${at.width}, height: ${at.height} },`;
  })
  .join('\n');
writeFileSync(
  'src/game/home/generated/furniturePieces.ts',
  `// Generated by scripts/cut-home-furniture.mjs from pret/pokeemerald's Secret
// Base decorations and THE BOLTHOLE's own sheet. Do not edit: re-run the script.

/** The sheet the house's furniture is drawn from. */
export const FURNITURE_SHEET = {
  imagePath: 'assets/home-furniture.png',
  textureKey: 'homeFurniture',
  columns: ${SHEET_COLUMNS},
  rows: ${rows},
} as const;

/** Where each piece sits on the sheet, in tiles. */
export const FURNITURE_PIECES = {
${entries}
} as const;

export type FurniturePieceName = keyof typeof FURNITURE_PIECES;
`,
);
console.log(
  `public/assets/home-furniture.png  ${SHEET_COLUMNS}x${rows} tiles, ${cut.length} pieces, ${cut.filter((each) => each.icon).length} icons`,
);
