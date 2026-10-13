// Cuts FireRed's ice cave - Four Island's Icefall Cave, drawn with the Seafoam
// Islands tileset - out of pret's FireRed disassembly, onto
// `public/assets/frlg-ice.png`: what a cave dressed as ice is drawn with
// (`src/game/world/tileset/insideTileset.ts`, the `ice` style).
//
//   git clone --filter=blob:none --no-checkout https://github.com/pret/pokefirered.git /tmp/pokefirered
//   git -C /tmp/pokefirered sparse-checkout set --no-cone 'data/tilesets/' 'data/layouts/'
//   git -C /tmp/pokefirered checkout 037335f4c725d7c9aecdac87066f2002b4bd7e14
//   node scripts/cut-frlg-ice.mjs /tmp/pokefirered
//
// The checkout is never committed, and what ships is a cut: named pieces drawn
// out of the game's own metatiles and packed onto a new grid, exactly as
// `cut-frlg-areas.mjs` cuts Mt. Moon. `public/assets/ASSET_PROVENANCE.md` says
// where it comes from, and this script is the record of which metatile every
// piece is and which of its two layers are drawn.
//
// Every piece is named by its metatile number in the pair FireRed loads for
// Icefall Cave (`gTileset_General` and `gTileset_SeafoamIslands`), read off
// the cave's own layouts: the ice is the metatile whose behaviour is MB_ICE
// (0x23) - the floor that carries a step on until something stops it - and
// the rock, the snow beyond it and the boulders standing on the ice are the
// ones FireRed draws round it on Icefall Cave B1F. A boulder is drawn in a
// metatile's top layer over the ice, so cut from the top layer alone it
// stands on ice or floor alike; the rock is cut whole, as FireRed lays it
// round the floor.
//
// Colours are read back to the five bits a channel the Game Boy Advance shows
// and written `x << 3`, as every other `frlg-*.png` writes them.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { blank, readPalette, tilesetPair } from './gba.mjs';
import { writePng } from '../tools/tileset/tileSheet.mjs';

const PRET_COMMIT = '037335f4c725d7c9aecdac87066f2002b4bd7e14';
const TILE = 16;
const SHEET_COLUMNS = 8;

const pret = process.argv[2];
if (!pret) {
  console.error('usage: node scripts/cut-frlg-ice.mjs <pokefirered checkout>');
  process.exit(2);
}
const head = execFileSync('git', ['-C', pret, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (head !== PRET_COMMIT) {
  console.error(`the checkout is at ${head}; this sheet is cut from ${PRET_COMMIT}`);
  process.exit(1);
}

const primary = join(pret, 'data/tilesets/primary/general');
const secondary = join(pret, 'data/tilesets/secondary/seafoam_islands');
// FireRed's primary tilesets own palettes 0-6 and the secondary 7-12.
const palettes = Array.from({ length: 13 }, (_, n) =>
  readPalette(join(n < 7 ? primary : secondary, 'palettes', `${String(n).padStart(2, '0')}.pal`)).map(
    (rgb) => rgb.map((value) => Math.round((value * 31) / 255) << 3),
  ),
);
const pair = tilesetPair({
  primaryTiles: join(primary, 'tiles.png'),
  secondaryTiles: join(secondary, 'tiles.png'),
  primaryMetatiles: join(primary, 'metatiles.bin'),
  secondaryMetatiles: join(secondary, 'metatiles.bin'),
  palettes,
  split: { tiles: 640, metatiles: 640 },
});

/**
 * Every piece: its metatiles, row by row, and which layers are drawn - `both`
 * as FireRed draws the cell, `top` for what stands on the ice (the bottom
 * layer is the ice under it) and `bottom` for the floor alone.
 */
const PIECES = [
  // --- the ground ---------------------------------------------------------------
  { name: 'ice.floor', metatiles: [[0x281]], layers: 'bottom' },
  // MB_ICE: the sheet a step slides across.
  { name: 'ice.sheet', metatiles: [[0x34b]], layers: 'bottom' },
  // --- the rock, laid round the floor as B1F lays it ------------------------------
  // Snow over the rock beyond the cave's walls, seen from above.
  { name: 'ice.snow', metatiles: [[0x291]], layers: 'both' },
  // The rock itself, seen from above where it is too thick for snow to show:
  // the lumps FireRed heaps between its rooms.
  { name: 'ice.crag', metatiles: [[0x28b]], layers: 'both' },
  // The faces: the back wall over the floor, and the rock either side of it.
  { name: 'ice.faceSouth', metatiles: [[0x299]], layers: 'both' },
  { name: 'ice.faceEast', metatiles: [[0x292]], layers: 'both' },
  { name: 'ice.faceWest', metatiles: [[0x290]], layers: 'both' },
  // A room's back corners, turned by the rock round the floor.
  { name: 'ice.cornerNw', metatiles: [[0x29b]], layers: 'both' },
  { name: 'ice.cornerNe', metatiles: [[0x29c]], layers: 'both' },
  // Where a spur of rock ends in the floor.
  { name: 'ice.spurSw', metatiles: [[0x298]], layers: 'both' },
  { name: 'ice.spurSe', metatiles: [[0x29a]], layers: 'both' },
  // --- what stands on the floor or the ice ----------------------------------------
  { name: 'ice.boulder', metatiles: [[0x34f]], layers: 'top' },
  { name: 'ice.boulderLow', metatiles: [[0x33f]], layers: 'top' },
  { name: 'ice.boulderTall', metatiles: [[0x347]], layers: 'top' },
  { name: 'ice.rock', metatiles: [[0x348, 0x349]], layers: 'top' },
  { name: 'ice.crystal', metatiles: [[0x2a7]], layers: 'top' },
  { name: 'ice.crystalLow', metatiles: [[0x29f]], layers: 'top' },
  // --- the ways through --------------------------------------------------------------
  // A hole with a ladder down it, and a ladder up with its top in the rock.
  { name: 'ice.hole', metatiles: [[0x2af]], layers: 'both' },
  { name: 'ice.ladder', metatiles: [[0x28f], [0x296]], layers: 'both' },
  // Daylight in a notch of the south wall, as Icefall Cave 1F's way out.
  { name: 'ice.exit', metatiles: [[0x2c8, 0x2c9, 0x2ca]], layers: 'both' },
];

/** One piece drawn, in the layers it asks for. */
function cutPiece(piece) {
  const rows = piece.metatiles;
  const image = blank(rows[0].length * TILE, rows.length * TILE);
  const keepLayer = { bottom: [0], top: [1], both: [0, 1] }[piece.layers];
  rows.forEach((row, y) =>
    row.forEach((metatile, x) => {
      for (const layer of keepLayer) drawLayer(image, metatile, x * TILE, y * TILE, layer);
    }),
  );
  return image;
}

/** One layer of a metatile, drawn as `tilesetPair` draws both. */
function drawLayer(image, metatile, left, top, layer) {
  // `drawMetatile` draws both layers; a layer alone is drawn by keeping only
  // its four tiles, which it names in order: the bottom's four, then the top's.
  let seen = 0;
  pair.drawMetatile(image, metatile, left, top, () => {
    const keep = Math.floor(seen / 4) === layer;
    seen += 1;
    return keep;
  });
}

const cut = PIECES.map((piece) => ({ name: piece.name, image: cutPiece(piece) }));

// Shelf packing: tallest first, left to right, a new shelf when a row is full.
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
  for (let y = 0; y < piece.image.height; y += 1) {
    piece.image.data.copy(
      sheet.data,
      ((at.row * TILE + y) * sheet.width + at.column * TILE) * 4,
      y * piece.image.width * 4,
      (y + 1) * piece.image.width * 4,
    );
  }
}
writePng('public/assets/frlg-ice.png', sheet);

mkdirSync('src/game/world/generated', { recursive: true });
const entries = cut
  .map((piece) => {
    const at = placed.get(piece.name);
    return `  '${piece.name}': { column: ${at.column}, row: ${at.row}, width: ${at.width}, height: ${at.height} },`;
  })
  .join('\n');
writeFileSync(
  'src/game/world/generated/icePieces.ts',
  `// Generated by scripts/cut-frlg-ice.mjs from pret/pokefirered at ${PRET_COMMIT}.
// Do not edit: re-run the script.

/** The sheet a cave dressed as ice is drawn from: FireRed's Icefall Cave. */
export const ICE_SHEET = {
  imagePath: 'assets/frlg-ice.png',
  columns: ${SHEET_COLUMNS},
  rows: ${rows},
} as const;

/** Where each named piece sits on the sheet, in tiles. */
export const ICE_PIECES = {
${entries}
} as const;

export type IcePieceName = keyof typeof ICE_PIECES;
`,
);
console.log(`public/assets/frlg-ice.png  ${SHEET_COLUMNS}x${rows} tiles, ${cut.length} pieces`);
