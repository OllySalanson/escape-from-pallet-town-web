// Draws the player's own house - THE BOLTHOLE - out of FireRed/LeafGreen's
// own tile data, onto `public/assets/frlg-home.png`.
//
//   R=https://raw.githubusercontent.com/pret/pokefirered/037335f
//   for d in data/tilesets/primary/building data/tilesets/secondary/generic_building_1; do
//     mkdir -p /tmp/pokefirered/$d/palettes
//     for f in tiles.png metatiles.bin; do curl -sSL -o /tmp/pokefirered/$d/$f $R/$d/$f; done
//     for p in 00 01 02 03 04 05 06 07 08 09 10 11 12 13 14 15; do
//       curl -sSL -o /tmp/pokefirered/$d/palettes/$p.pal $R/$d/palettes/$p.pal; done; done
//   node scripts/cut-frlg-home.mjs /tmp/pokefirered
//
// The other rooms of the base were cut out of The Spriters Resource's renders
// (`cut-frlg-base.mjs`). This one is drawn rather than cut: pret/pokefirered
// (the decompilation the battle rules are already read from, pinned at the
// same commit) holds the game's interior tileset as the GBA keeps it - a sheet
// of 8x8 tiles in sixteen colours, sixteen palettes, and the 16x16 "metatiles"
// every FireRed room is laid out in, each four tiles on a bottom layer and four
// on a top. So a piece here is named by the metatiles it is made of, exactly as
// FireRed's own map of the player's house names them
// (`data/layouts/PalletTown_PlayersHouse_1F/map.bin`), and drawn the way the
// GBA draws them. Nothing is guessed about where a room was pasted on a page.
//
// None of the source files is committed. What ships is the drawn pieces, and
// `public/assets/ASSET_PROVENANCE.md` credits the origin.
//
// The script writes two things: the sheet, and the generated module that says
// where each named piece landed on it (`src/game/base/generated/homePieces.ts`).
// Nothing else knows a coordinate on this sheet.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { writePng } from '../tools/tileset/tileSheet.mjs';

const TILE = 16;
const SHEET_COLUMNS = 16;
/** FireRed's split between the two tilesets a room is drawn from. */
const PRIMARY_TILES = 640;
const PRIMARY_METATILES = 640;
const PRIMARY_PALETTES = 7;

/** Colours this game's own palettes already use, so a recoloured rug is still FireRed's ink. */
const FIRERED_RED = [205, 82, 65];
const FIRERED_BLUE = [98, 156, 238];
/** The rug's green, as the building tileset's third palette holds it. */
const RUG_GREEN = { palette: 2, index: 5 };

/**
 * Every piece, by the metatiles it is made of, row by row.
 *
 * Ids under 640 are the shared "building" tileset every FireRed house is drawn
 * from; 640 and up are the player's house's own secondary tileset, which is
 * where the bed and the PC live. `recolour` swaps one palette entry for one
 * colour - the only edit made to any of them - and `mat` builds a door mat
 * from the two rows it hangs across (see `liftMat`).
 */
const PIECES = [
  // --- the shell: the back wall, its skirting, the floor and its shaded edge
  { name: 'home.wallUpper', metatiles: [[32]] },
  { name: 'home.wallLower', metatiles: [[40]] },
  { name: 'home.floor', metatiles: [[1]] },
  { name: 'home.floorShade', metatiles: [[9]] },

  // --- downstairs: Red's house as FireRed lays it out --------------------
  // The sink and the hob, standing against the wall.
  { name: 'home.kitchen', metatiles: [[49, 50], [57, 58]] },
  // The glass-fronted cupboard, which reaches up the wall.
  { name: 'home.cupboard', metatiles: [[46, 47], [54, 55], [62, 63]] },
  // The family television against the wall, on its stand.
  { name: 'home.tv', metatiles: [[45], [53], [61]] },
  { name: 'home.window', metatiles: [[33, 34], [41, 42]] },
  // The stairs up, and the orange mat at their foot that is the way onto them.
  { name: 'home.stairsUp', metatiles: [[22, 23], [30, 31], [38, 39]] },
  { name: 'home.stairMatUp', metatiles: [[29], [37]] },
  // The green rug with the table and its four chairs.
  {
    name: 'home.rugTable',
    metatiles: [
      [67, 68, 68, 68, 68, 70],
      [83, 75, 76, 77, 78, 86],
      [83, 75, 84, 85, 78, 86],
      [91, 92, 92, 92, 92, 94],
    ],
  },
  // The two potted plants, each lit from the side of the room it stands on.
  { name: 'home.plantWest', metatiles: [[87], [95]] },
  { name: 'home.plantEast', metatiles: [[71], [79]] },
  // Its top edge is four pixels into the row FireRed draws it from.
  { name: 'home.mat', mat: { top: [18, 19, 20], bottom: [26, 27, 28], drop: 4 } },

  // --- upstairs: Red's room ------------------------------------------------
  // The PC on its desk, with the stool tucked under it.
  { name: 'home.pcDesk', metatiles: [[647, 32], [655, 134], [663, 90]] },
  { name: 'home.drawers', metatiles: [[48], [56]] },
  // The bookcase with the toys on top.
  { name: 'home.bookcase', metatiles: [[43, 44], [51, 52], [59, 60]] },
  { name: 'home.stairsDown', metatiles: [[21, 40], [5, 6], [13, 14]] },
  { name: 'home.stairMatDown', metatiles: [[7], [15]] },
  // The clipboard pinned to the wall by the stairs.
  { name: 'home.poster', metatiles: [[150], [166]] },
  { name: 'home.bed', metatiles: [[643, 644, 645], [651, 652, 653], [659, 660, 661]] },
  // The rug with the television and the console on it - in green, which is a
  // Bulbasaur's, and in the red and the blue of the other two starters.
  ...[
    ['home.rugTv', undefined],
    ['home.rugTvRed', FIRERED_RED],
    ['home.rugTvBlue', FIRERED_BLUE],
  ].map(([name, colour]) => ({
    name,
    metatiles: [
      [67, 68, 53, 68, 70],
      [83, 69, 654, 69, 86],
      [83, 69, 662, 69, 86],
      [91, 92, 92, 92, 94],
    ],
    ...(colour ? { recolour: [{ ...RUG_GREEN, to: colour }] } : {}),
  })),
  // The top of the television, which stands proud of the rug.
  { name: 'home.tvTop', metatiles: [[646]] },
];

// ---------------------------------------------------------------------------

const [sourceDir] = process.argv.slice(2);
if (!sourceDir) {
  console.error('usage: node scripts/cut-frlg-home.mjs <pokefirered checkout> (see the top of this script)');
  process.exit(1);
}
const PRIMARY = join(sourceDir, 'data/tilesets/primary/building');
const SECONDARY = join(sourceDir, 'data/tilesets/secondary/generic_building_1');

/** A GBA tile sheet: an indexed PNG whose pixel values are palette indices. */
function readIndexedPng(path) {
  const file = readFileSync(path);
  let offset = 8;
  const idat = [];
  let width = 0;
  let height = 0;
  let depth = 0;
  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.toString('ascii', offset + 4, offset + 8);
    const body = file.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8];
      if (body[9] !== 3) throw new Error(`${path} is not an indexed PNG`);
      if (body[12] !== 0) throw new Error(`${path} is interlaced`);
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(body));
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }
  if (depth !== 4 && depth !== 8) throw new Error(`${path}: unsupported bit depth ${depth}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = Math.ceil((width * depth) / 8);
  const lines = Buffer.alloc(height * stride);
  let source = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[source];
    source += 1;
    const line = lines.subarray(y * stride, (y + 1) * stride);
    const previous = y === 0 ? null : lines.subarray((y - 1) * stride, y * stride);
    for (let x = 0; x < stride; x += 1) {
      const value = raw[source + x];
      const a = x >= 1 ? line[x - 1] : 0;
      const b = previous ? previous[x] : 0;
      const c = previous && x >= 1 ? previous[x - 1] : 0;
      let predicted = 0;
      if (filter === 1) predicted = a;
      else if (filter === 2) predicted = b;
      else if (filter === 3) predicted = (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        predicted = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (filter !== 0) throw new Error(`${path}: unknown PNG filter ${filter}`);
      line[x] = (value + predicted) & 0xff;
    }
    source += stride;
  }
  const pixels = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const byte = lines[y * stride + (depth === 4 ? x >> 1 : x)];
      pixels[y * width + x] = depth === 8 ? byte : x & 1 ? byte & 15 : byte >> 4;
    }
  }
  return { width, height, pixels };
}

/** A JASC palette file: sixteen colours, already in eight bits a channel. */
const readPalette = (path) =>
  readFileSync(path, 'utf8')
    .trim()
    .split(/\r?\n/)
    .slice(3)
    .map((line) => line.trim().split(/\s+/).map(Number));

const tiles = [readIndexedPng(join(PRIMARY, 'tiles.png')), readIndexedPng(join(SECONDARY, 'tiles.png'))];
const metatiles = [readFileSync(join(PRIMARY, 'metatiles.bin')), readFileSync(join(SECONDARY, 'metatiles.bin'))];
// FireRed loads the primary tileset's palettes into the first seven slots and
// the secondary's into the rest, from the same slot of its own file.
const palettes = Array.from({ length: 16 }, (_slot, slot) =>
  readPalette(
    join(slot < PRIMARY_PALETTES ? PRIMARY : SECONDARY, 'palettes', `${String(slot).padStart(2, '0')}.pal`),
  ),
);

const blank = (width, height) => ({ width, height, data: Buffer.alloc(width * height * 4) });

function tilePixel(tile, x, y) {
  const sheet = tile < PRIMARY_TILES ? tiles[0] : tiles[1];
  const index = tile < PRIMARY_TILES ? tile : tile - PRIMARY_TILES;
  const columns = sheet.width / 8;
  const px = (index % columns) * 8 + x;
  const py = Math.floor(index / columns) * 8 + y;
  if (py >= sheet.height) throw new Error(`tile ${tile} is off its sheet`);
  return sheet.pixels[py * sheet.width + px];
}

/**
 * One metatile, as the GBA draws it: the bottom layer's four tiles, then the
 * top layer's over them, colour 0 of every palette clear.
 */
function drawMetatile(image, id, left, top, recolour = []) {
  const table = id < PRIMARY_METATILES ? metatiles[0] : metatiles[1];
  const base = (id < PRIMARY_METATILES ? id : id - PRIMARY_METATILES) * 16;
  if (base + 16 > table.length) throw new Error(`metatile ${id} does not exist`);
  for (let layer = 0; layer < 2; layer += 1) {
    for (let quarter = 0; quarter < 4; quarter += 1) {
      const entry = table.readUInt16LE(base + (layer * 4 + quarter) * 2);
      const tile = entry & 0x3ff;
      const flipX = (entry >> 10) & 1;
      const flipY = (entry >> 11) & 1;
      const palette = entry >> 12;
      for (let y = 0; y < 8; y += 1) {
        for (let x = 0; x < 8; x += 1) {
          const index = tilePixel(tile, flipX ? 7 - x : x, flipY ? 7 - y : y);
          if (index === 0) continue;
          const swap = recolour.find((each) => each.palette === palette && each.index === index);
          const [r, g, b] = swap ? swap.to : palettes[palette][index];
          const at = ((top + Math.floor(quarter / 2) * 8 + y) * image.width + left + (quarter % 2) * 8 + x) * 4;
          image.data[at] = r;
          image.data[at + 1] = g;
          image.data[at + 2] = b;
          image.data[at + 3] = 255;
        }
      }
    }
  }
}

function drawGrid(grid, recolour) {
  const image = blank(grid[0].length * TILE, grid.length * TILE);
  grid.forEach((row, y) => {
    if (row.length !== grid[0].length) throw new Error('a piece must be a rectangle');
    row.forEach((id, x) => drawMetatile(image, id, x * TILE, y * TILE, recolour));
  });
  return image;
}

const sameColour = (image, a, b) =>
  image.data[a] === image.data[b] &&
  image.data[a + 1] === image.data[b + 1] &&
  image.data[a + 2] === image.data[b + 2];

/**
 * A door mat is drawn half a tile low, hanging across the foot of the room
 * into the dark, so FireRed spends two rows of metatiles on it. Here it is one
 * row: drawn across both, cut from its own top edge, and everything either
 * side of its border lifted, so it lies on whatever floor it is put down on.
 */
function liftMat({ top, bottom, drop }) {
  const both = drawGrid([top, bottom]);
  const middle = Math.floor(both.width / 2);
  const image = blank(both.width, TILE);
  both.data.copy(image.data, 0, drop * both.width * 4, (drop + TILE) * both.width * 4);
  // And its sides are where its top border stops.
  let left = middle;
  let right = middle;
  while (left > 0 && sameColour(image, (left - 1) * 4, middle * 4)) left -= 1;
  while (right < image.width - 1 && sameColour(image, (right + 1) * 4, middle * 4)) right += 1;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (x < left || x > right) image.data.fill(0, (y * image.width + x) * 4, (y * image.width + x) * 4 + 4);
    }
  }
  return image;
}

const cut = PIECES.map((piece) => ({
  name: piece.name,
  image: piece.mat ? liftMat(piece.mat) : drawGrid(piece.metatiles, piece.recolour),
}));

// Shelf packing, as the base's sheet is packed: tallest first, left to right.
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
writePng('public/assets/frlg-home.png', sheet);

mkdirSync('src/game/base/generated', { recursive: true });
const entries = cut
  .map((piece) => {
    const at = placed.get(piece.name);
    return `  '${piece.name}': { column: ${at.column}, row: ${at.row}, width: ${at.width}, height: ${at.height} },`;
  })
  .join('\n');
writeFileSync(
  'src/game/base/generated/homePieces.ts',
  `// Generated by scripts/cut-frlg-home.mjs from pret/pokefirered's interior
// tileset. Do not edit: re-run the script.

/** The sheet THE BOLTHOLE is drawn from: the player's house, in FireRed's own tiles. */
export const HOME_SHEET = {
  imagePath: 'assets/frlg-home.png',
  columns: ${SHEET_COLUMNS},
  rows: ${rows},
} as const;

/** Where each named piece sits on the sheet, in tiles. */
export const HOME_PIECES = {
${entries}
} as const;

export type HomePieceName = keyof typeof HOME_PIECES;
`,
);
console.log(`public/assets/frlg-home.png  ${SHEET_COLUMNS}x${rows} tiles, ${cut.length} pieces`);
