// Cuts the insides of FireRed's own rooms out of pret's FireRed disassembly,
// onto `public/assets/frlg-areas.png`: what a player's map furnishes the inside
// of a building with (`src/game/world/tileset/insideTileset.ts`).
//
//   git clone --filter=blob:none --no-checkout https://github.com/pret/pokefirered.git /tmp/pokefirered
//   git -C /tmp/pokefirered sparse-checkout set --no-cone 'data/tilesets/' 'data/layouts/'
//   git -C /tmp/pokefirered checkout c75f352304d529f6ba92d4f74b9cf8b5c3810788
//   node scripts/cut-frlg-areas.mjs /tmp/pokefirered
//
// The checkout is never committed. pret's graphics are Nintendo and Game
// Freak's FireRed art, extracted, exactly as every other `frlg-*.png` here is,
// and what ships is a cut: named pieces drawn out of the game's own metatiles
// and packed onto a new grid. `public/assets/ASSET_PROVENANCE.md` says where
// it comes from, and this script is the record of exactly which metatiles
// every piece is - a room of the game, a tile of it, and which of the
// metatile's two layers are drawn.
//
// The layers are the point. FireRed draws a room's floor and walls in a
// metatile's bottom layer and almost everything standing on it in the top
// layer, transparent between, so a cupboard cut from the top layer alone stands
// on any floor; the rooms the base was cut from were renders, with the floor
// baked into every object. Some objects keep part of themselves in the bottom
// layer - the stairwell under a staircase, the dots inside a rug, a Mart's
// fixtures and the shadows they throw - and those are cut with both layers,
// on the floor of the room they come from, and only offered in a room of
// that style.
//
// Colours are read back to the five bits a channel the Game Boy Advance shows
// and written `x << 3`, as `frlg-tiles.png` writes them, so this sheet meets
// the others without a seam.
//
// The script writes two things: the sheet, and the generated module that says
// where each named piece landed on it (`src/game/world/generated/areaPieces.ts`).
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { writePng } from '../tools/tileset/tileSheet.mjs';

const PRET_COMMIT = 'c75f352304d529f6ba92d4f74b9cf8b5c3810788';
const TILE = 16;
const SHEET_COLUMNS = 20;

const pret = process.argv[2];
if (!pret) {
  console.error('usage: node scripts/cut-frlg-areas.mjs <pokefirered checkout>');
  process.exit(2);
}
const head = execFileSync('git', ['-C', pret, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (head !== PRET_COMMIT) {
  console.error(`the checkout is at ${head}; this sheet is cut from ${PRET_COMMIT}`);
  process.exit(1);
}

/** The rooms pieces are cut from: a layout of the game and the two tilesets it is drawn with. */
const ROOMS = {
  // The player's house in Pallet Town, downstairs and up: FireRed's ordinary house.
  house: { layout: 'PalletTown_PlayersHouse_1F', primary: 'building', secondary: 'generic_building_1' },
  upstairs: { layout: 'PalletTown_PlayersHouse_2F', primary: 'building', secondary: 'generic_building_1' },
  mart: { layout: 'Mart', primary: 'building', secondary: 'mart' },
  // Mt. Moon, the first cave a FireRed player walks into: its ground floor,
  // ringed in rock with the way out cut into its south wall, and the floor
  // below, whose rooms stand on the dark with only a back wall.
  moon: { layout: 'MtMoon_1F', primary: 'general', secondary: 'cave' },
  moonBelow: { layout: 'MtMoon_B1F', primary: 'general', secondary: 'cave' },
};

/**
 * Every piece, in the order it is listed for the sheet.
 *
 * `at` is the metatile of the room's layout the piece starts at and `size` is
 * in metatiles. `layers` is which of each metatile's two layers are drawn:
 * `top` alone leaves everything else transparent; `bottom` and `both` are
 * opaque; or a row of letters per row of the piece - `b`ottom, `t`op, `2`
 * both - where one metatile holds two things and only one of them is wanted. `fit` crops what was drawn to its own pixels and centres it in a
 * cell that size - a door mat hangs half a tile off the foot of its room, and
 * is put back on the one row a mat here stands on.
 */
const PIECES = [
  // --- the house: its shell ---------------------------------------------------
  { name: 'house.wallUpper', room: 'house', at: [5, 0], size: [1, 1], layers: 'bottom' },
  { name: 'house.wallLower', room: 'house', at: [5, 1], size: [1, 1], layers: 'bottom' },
  { name: 'house.floor', room: 'house', at: [10, 7], size: [1, 1], layers: 'bottom' },
  // The parquet is shaded under the back wall and down the west side of
  // every FireRed room, in one tile: the corner where they meet is the same.
  { name: 'house.floorShade', room: 'house', at: [5, 2], size: [1, 1], layers: 'bottom' },
  // --- the house: what stands in it -------------------------------------------
  { name: 'house.window', room: 'house', at: [7, 0], size: [2, 2], layers: 'top' },
  { name: 'house.cupboard', room: 'house', at: [3, 0], size: [2, 3], layers: 'top' },
  { name: 'house.tv', room: 'house', at: [6, 0], size: [1, 3], layers: 'top' },
  { name: 'house.sink', room: 'house', at: [1, 1], size: [2, 2], layers: 'top' },
  { name: 'house.stairsUp', room: 'house', at: [11, 1], size: [2, 3], layers: 'both' },
  { name: 'house.rugSmall', room: 'house', at: [10, 2], size: [1, 2], layers: 'top' },
  // The rug's dots are in the floor and its border is standing on it; the
  // table in the middle of it is cut on its own, so it is left out here.
  {
    name: 'house.rug',
    room: 'house',
    at: [4, 3],
    size: [6, 4],
    layers: ['222222', '2bbbb2', '2bbbb2', '222222'],
  },
  { name: 'house.tableSet', room: 'house', at: [5, 4], size: [4, 2], layers: 'top' },
  { name: 'house.plant', room: 'house', at: [1, 6], size: [1, 2], layers: 'top' },
  { name: 'house.mat', room: 'house', at: [3, 8], size: [3, 2], layers: 'top', fit: [3, 1] },
  { name: 'house.pcDesk', room: 'upstairs', at: [1, 0], size: [2, 3], layers: 'top' },
  { name: 'house.drawers', room: 'upstairs', at: [3, 0], size: [1, 3], layers: 'top' },
  { name: 'house.bookshelf', room: 'upstairs', at: [4, 0], size: [2, 3], layers: 'top' },
  { name: 'house.notice', room: 'upstairs', at: [11, 0], size: [1, 2], layers: 'top' },
  { name: 'house.stairsDown', room: 'upstairs', at: [8, 1], size: [2, 3], layers: 'both' },
  { name: 'house.bed', room: 'upstairs', at: [1, 4], size: [3, 3], layers: 'top' },

  // --- the Poké Mart ----------------------------------------------------------
  { name: 'mart.wallUpper', room: 'mart', at: [5, 0], size: [1, 1], layers: 'bottom' },
  { name: 'mart.wallLower', room: 'mart', at: [5, 1], size: [1, 1], layers: 'bottom' },
  { name: 'mart.floor', room: 'mart', at: [6, 6], size: [1, 1], layers: 'bottom' },
  { name: 'mart.floorShade', room: 'mart', at: [5, 2], size: [1, 1], layers: 'bottom' },
  { name: 'mart.counter', room: 'mart', at: [0, 3], size: [3, 2], layers: 'top' },
  { name: 'mart.till', room: 'mart', at: [3, 1], size: [1, 4], layers: 'both' },
  { name: 'mart.case', room: 'mart', at: [1, 5], size: [2, 2], layers: 'both' },
  { name: 'mart.rack', room: 'mart', at: [7, 3], size: [1, 4], layers: 'both' },
  { name: 'mart.racks', room: 'mart', at: [7, 3], size: [2, 4], layers: 'both' },
  { name: 'mart.fridges', room: 'mart', at: [7, 1], size: [2, 2], layers: 'both' },
  { name: 'mart.wallShelves', room: 'mart', at: [4, 0], size: [3, 2], layers: 'both' },
  { name: 'mart.plant', room: 'mart', at: [1, 1], size: [1, 2], layers: 'both' },
  { name: 'mart.poster', room: 'mart', at: [2, 0], size: [1, 2], layers: 'both' },
  { name: 'mart.sideWest', room: 'mart', at: [0, 0], size: [1, 3], layers: 'both' },
  { name: 'mart.sideEast', room: 'mart', at: [10, 0], size: [1, 3], layers: 'both' },
  // The two front corners of the shop, which FireRed cuts off on the slant.
  { name: 'mart.cornerWest', room: 'mart', at: [0, 7], size: [1, 1], layers: 'both' },
  { name: 'mart.cornerEast', room: 'mart', at: [10, 7], size: [1, 1], layers: 'both' },
  { name: 'mart.mat', room: 'mart', at: [3, 7], size: [3, 2], layers: 'top', fit: [3, 1] },

  // --- a cave: Mt. Moon -------------------------------------------------------
  { name: 'cave.floor', room: 'moon', at: [10, 2], size: [1, 1], layers: 'bottom' },
  // The rock round a cave is a run of lumps: the back wall's top row, whole,
  // and every face that meets the ground cut from the top layer, so it stands
  // on the floor or the sand alike - FireRed draws each twice, once on each.
  { name: 'cave.wallUpper', room: 'moon', at: [1, 0], size: [1, 1], layers: 'bottom' },
  { name: 'cave.wallLower', room: 'moon', at: [10, 1], size: [1, 1], layers: 'top' },
  { name: 'cave.faceEast', room: 'moon', at: [1, 2], size: [1, 1], layers: 'top' },
  { name: 'cave.faceWest', room: 'moon', at: [46, 2], size: [1, 1], layers: 'top' },
  // The south wall is the rock's top seen from above, with a rim along it.
  { name: 'cave.rim', room: 'moon', at: [2, 38], size: [1, 1], layers: 'top' },
  // Where the walls meet in the corners of the room.
  { name: 'cave.cornerNw', room: 'moon', at: [1, 1], size: [1, 1], layers: 'both' },
  { name: 'cave.cornerNe', room: 'moon', at: [46, 1], size: [1, 1], layers: 'both' },
  { name: 'cave.cornerSw', room: 'moon', at: [1, 38], size: [1, 1], layers: 'both' },
  { name: 'cave.cornerSe', room: 'moon', at: [46, 38], size: [1, 1], layers: 'both' },
  // The way out: daylight in a notch of the south wall.
  { name: 'cave.exit', room: 'moon', at: [17, 38], size: [3, 1], layers: 'both' },
  // The sand, a whole block of FireRed's: a fill, four edges, four corners
  // and four inside corners, each with the floor it meets drawn in.
  { name: 'cave.sand', room: 'moon', at: [2, 2], size: [1, 1], layers: 'both' },
  { name: 'cave.sandN', room: 'moon', at: [33, 17], size: [1, 1], layers: 'both' },
  { name: 'cave.sandS', room: 'moon', at: [8, 2], size: [1, 1], layers: 'both' },
  { name: 'cave.sandE', room: 'moon', at: [4, 5], size: [1, 1], layers: 'both' },
  { name: 'cave.sandW', room: 'moon', at: [44, 7], size: [1, 1], layers: 'both' },
  { name: 'cave.sandNw', room: 'moon', at: [12, 7], size: [1, 1], layers: 'both' },
  { name: 'cave.sandNe', room: 'moon', at: [37, 13], size: [1, 1], layers: 'both' },
  { name: 'cave.sandSw', room: 'moon', at: [37, 3], size: [1, 1], layers: 'both' },
  { name: 'cave.sandSe', room: 'moon', at: [9, 2], size: [1, 1], layers: 'both' },
  { name: 'cave.sandInNw', room: 'moon', at: [12, 10], size: [1, 1], layers: 'both' },
  { name: 'cave.sandInNe', room: 'moon', at: [2, 31], size: [1, 1], layers: 'both' },
  { name: 'cave.sandInSw', room: 'moon', at: [37, 2], size: [1, 1], layers: 'both' },
  { name: 'cave.sandInSe', room: 'moon', at: [7, 2], size: [1, 1], layers: 'both' },
  // What stands in it.
  { name: 'cave.boulder', room: 'moon', at: [40, 8], size: [1, 1], layers: 'top' },
  { name: 'cave.rocks', room: 'moon', at: [11, 2], size: [1, 1], layers: 'top' },
  { name: 'cave.crater', room: 'moon', at: [10, 4], size: [2, 2], layers: 'both' },
  // Water dripping off the back wall into a pool on the floor.
  { name: 'cave.drip', room: 'moonBelow', at: [21, 1], size: [2, 2], layers: ['22', 'tt'] },
  // The ways between floors: a hole with a ladder down it, and a ladder up
  // leant on a rock, its foot on the floor.
  { name: 'cave.hole', room: 'moon', at: [5, 6], size: [1, 1], layers: 'both' },
  { name: 'cave.ladder', room: 'moonBelow', at: [25, 3], size: [1, 2], layers: ['2', 't'] },
];

// --- reading pret's files ----------------------------------------------------

/** An indexed PNG as its palette indices: pret's tile sheets are 4bpp. */
function indexed(path) {
  const file = readFileSync(path);
  let offset = 8;
  const data = [];
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
    } else if (type === 'IDAT') {
      data.push(body);
    }
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(data));
  const stride = Math.ceil((width * depth) / 8);
  const pixels = new Uint8Array(width * height);
  let previous = new Uint8Array(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = Uint8Array.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i += 1) {
      const a = i > 0 ? line[i - 1] : 0;
      const b = previous[i];
      const c = i > 0 ? previous[i - 1] : 0;
      if (filter === 1) line[i] = (line[i] + a) & 255;
      else if (filter === 2) line[i] = (line[i] + b) & 255;
      else if (filter === 3) line[i] = (line[i] + ((a + b) >> 1)) & 255;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        line[i] = (line[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
    }
    for (let x = 0; x < width; x += 1) {
      pixels[y * width + x] =
        depth === 4 ? (x & 1 ? line[x >> 1] & 15 : line[x >> 1] >> 4) : line[x];
    }
    previous = line;
  }
  return { width, height, pixels };
}

/** A JASC palette, as the GBA's own 15-bit colours written `x << 3`. */
function palette(directory, index) {
  return readFileSync(`${directory}/palettes/${String(index).padStart(2, '0')}.pal`, 'utf8')
    .trim()
    .split(/\r?\n/)
    .slice(3)
    .map((line) =>
      line
        .trim()
        .split(/\s+/)
        .map((value) => Math.round((Number(value) * 31) / 255) << 3),
    );
}

const layouts = JSON.parse(readFileSync(`${pret}/data/layouts/layouts.json`, 'utf8')).layouts;

/** A room, ready to draw: its tiles, palettes, metatiles and map. */
function loadRoom({ layout, primary, secondary }) {
  const entry = layouts.find((candidate) => candidate.name === `${layout}_Layout`);
  if (!entry) {
    throw new Error(`no layout ${layout}`);
  }
  const p = `${pret}/data/tilesets/primary/${primary}`;
  const s = `${pret}/data/tilesets/secondary/${secondary}`;
  // FireRed's primary tileset holds the first 640 tiles, 640 metatiles and 7 palettes.
  return {
    width: entry.width,
    tiles: [indexed(`${p}/tiles.png`), indexed(`${s}/tiles.png`)],
    palettes: Array.from({ length: 16 }, (_, index) => palette(index < 7 ? p : s, index)),
    metatiles: [readFileSync(`${p}/metatiles.bin`), readFileSync(`${s}/metatiles.bin`)],
    map: readFileSync(`${pret}/data/${entry.blockdata_filepath.replace(/^data\//, '')}`),
  };
}

const rooms = new Map(Object.entries(ROOMS).map(([key, room]) => [key, loadRoom(room)]));

function blank(width, height) {
  return { width, height, data: Buffer.alloc(width * height * 4) };
}

/** Draws metatile `(mx, my)` of a room into `out` at pixel `(dx, dy)`, the layers asked for. */
function drawMetatile(room, mx, my, out, dx, dy, layers) {
  const block = room.map.readUInt16LE((my * room.width + mx) * 2) & 1023;
  const secondary = block >= 640 ? 1 : 0;
  const index = secondary ? block - 640 : block;
  const metatiles = room.metatiles[secondary];
  for (const layer of layers) {
    for (let quarter = 0; quarter < 4; quarter += 1) {
      const entry = metatiles.readUInt16LE(index * 16 + (layer * 4 + quarter) * 2);
      const tile = entry & 1023;
      const flipX = (entry & 1024) !== 0;
      const flipY = (entry & 2048) !== 0;
      const colours = room.palettes[entry >> 12];
      const sheet = room.tiles[tile >= 640 ? 1 : 0];
      const at = tile >= 640 ? tile - 640 : tile;
      const tx = (at % (sheet.width / 8)) * 8;
      const ty = Math.floor(at / (sheet.width / 8)) * 8;
      for (let y = 0; y < 8; y += 1) {
        for (let x = 0; x < 8; x += 1) {
          const sy = ty + (flipY ? 7 - y : y);
          if (sy >= sheet.height) continue;
          const colour = sheet.pixels[sy * sheet.width + tx + (flipX ? 7 - x : x)];
          if (colour === 0 && layer === 1) continue;
          const [r, g, b] = colours[colour];
          const px = dx + (quarter & 1) * 8 + x;
          const py = dy + (quarter >> 1) * 8 + y;
          const i = (py * out.width + px) * 4;
          out.data[i] = r;
          out.data[i + 1] = g;
          out.data[i + 2] = b;
          out.data[i + 3] = 255;
        }
      }
    }
  }
}

const LAYERS = { bottom: [0], top: [1], both: [0, 1], b: [0], t: [1], 2: [0, 1] };

function cutPiece(piece) {
  const room = rooms.get(piece.room);
  const [w, h] = piece.size;
  if (Array.isArray(piece.layers) && (piece.layers.length !== h || piece.layers.some((row) => row.length !== w))) {
    throw new Error(`the layers drawn for '${piece.name}' are not ${w}x${h}`);
  }
  const drawn = blank(w * TILE, h * TILE);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const layers = Array.isArray(piece.layers) ? LAYERS[piece.layers[y][x]] : LAYERS[piece.layers];
      drawMetatile(room, piece.at[0] + x, piece.at[1] + y, drawn, x * TILE, y * TILE, layers);
    }
  }
  return piece.fit ? fitted(drawn, piece.fit) : drawn;
}

/** What was drawn, cropped to its own pixels and centred in a cell `[w, h]` tiles. */
function fitted(image, [w, h]) {
  let left = image.width;
  let top = image.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (image.data[(y * image.width + x) * 4 + 3] > 0) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  }
  const out = blank(w * TILE, h * TILE);
  const width = right - left + 1;
  const height = bottom - top + 1;
  if (width > out.width || height > out.height) {
    throw new Error(`a ${width}x${height} piece does not fit ${w}x${h} tiles`);
  }
  const ox = Math.floor((out.width - width) / 2);
  const oy = Math.floor((out.height - height) / 2);
  for (let y = 0; y < height; y += 1) {
    image.data.copy(
      out.data,
      ((oy + y) * out.width + ox) * 4,
      ((top + y) * image.width + left) * 4,
      ((top + y) * image.width + left + width) * 4,
    );
  }
  return out;
}

const cut = PIECES.map((piece) => ({ name: piece.name, image: cutPiece(piece) }));

// Shelf packing: tallest first, left to right, a new shelf when a row is full.
const order = [...cut].sort(
  (a, b) => b.image.height - a.image.height || b.image.width - a.image.width,
);
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
writePng('public/assets/frlg-areas.png', sheet);

mkdirSync('src/game/world/generated', { recursive: true });
const entries = cut
  .map((piece) => {
    const at = placed.get(piece.name);
    return `  '${piece.name}': { column: ${at.column}, row: ${at.row}, width: ${at.width}, height: ${at.height} },`;
  })
  .join('\n');
writeFileSync(
  'src/game/world/generated/areaPieces.ts',
  `// Generated by scripts/cut-frlg-areas.mjs from pret/pokefirered at ${PRET_COMMIT}.
// Do not edit: re-run the script.

/** The sheet the insides of a player's buildings are drawn from. */
export const AREA_SHEET = {
  imagePath: 'assets/frlg-areas.png',
  columns: ${SHEET_COLUMNS},
  rows: ${rows},
} as const;

/** Where each named piece sits on the sheet, in tiles. */
export const AREA_PIECES = {
${entries}
} as const;

export type AreaPieceName = keyof typeof AREA_PIECES;
`,
);
console.log(`public/assets/frlg-areas.png  ${SHEET_COLUMNS}x${rows} tiles, ${cut.length} pieces`);
