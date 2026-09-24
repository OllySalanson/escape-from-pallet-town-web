// Cuts the rooms of the base out of The Spriters Resource's FireRed/LeafGreen
// interior renders, onto `public/assets/frlg-base.png`.
//
//   mkdir -p /tmp/frlg-rooms && for id in 3724 3729 3733 3771; do
//     curl -sSL -A "Mozilla/5.0" -o /tmp/frlg-rooms/$id.png \
//       "https://www.spriters-resource.com/media/assets/4/$id.png"; done
//   node scripts/cut-frlg-base.mjs /tmp/frlg-rooms
//
// The four renders are "Pokémon Center / Mart" (3724), "Bill's House" (3729),
// "Rocket Warehouse" (3733) and "Pallet Town" (3771, which holds Professor
// Oak's Lab and the player's house); 3862 is "Tileset 1", the buildings sheet.
// None of them is committed: the
// publisher's terms object to their content being redistributed "in its
// original format", so what ships is the cut and rearranged pieces and
// `public/assets/ASSET_PROVENANCE.md` credits the origin. This script is the
// record of exactly which cells those pieces are, and of the four small edits
// made to them - each named where it is made.
//
// A mat is the one thing every room hangs off its own edge, so each is cut by
// pixel from its top edge (`liftMat`).
//
// A render is a picture of a room, not a tile sheet, so every source is read
// on its own grid: the room was pasted onto the page at some offset, and
// `origin` is where that room's 16px grid starts. Each was found by scanning
// every offset for the one that makes the fewest distinct tiles, and checked
// by eye against the room's furniture.
//
// The script writes two things: the sheet, and the generated module that says
// where each named piece landed on it (`src/game/base/generated/basePieces.ts`).
// Nothing else knows a coordinate on this sheet, so a re-cut cannot leave a
// room drawing from the wrong cell.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readPng, writePng } from '../tools/tileset/tileSheet.mjs';

const TILE = 16;
const SHEET_COLUMNS = 20;

const SOURCES = {
  // Professor Oak's Lab, on the Pallet Town render.
  lab: { file: '3771', origin: [0, 8] },
  // The player's house upstairs, on the same render: the bed is all it gives.
  house: { file: '3771', origin: [0, 8] },
  pc: { file: '3724', origin: [8, 8] },
  bill: { file: '3729', origin: [5, 6] },
  warehouse: { file: '3733', origin: [8, 8] },
  // "Tileset 1", fabnt's buildings sheet. Unlike the rooms it is a real tile
  // sheet, laid out on a 17px pitch with a white rule between cells, so a
  // piece from it names its first cell's pixel and the pitch.
  buildings: { file: '3862', origin: [0, 0] },
};

/** Floor colours, per room, for lifting an object off the floor it was drawn on. */
const LAB_FLOOR = [
  [205, 205, 213],
  [164, 164, 172],
  [238, 238, 246],
];
const HOUSE_FLOOR = [
  [131, 115, 16],
  [164, 148, 49],
  [197, 180, 74],
];

/**
 * Every piece, in the order it is laid on the sheet.
 *
 * `at` is a cell on the source's own grid and `size` is in tiles. `key` makes
 * the listed colours transparent - the floor an object was standing on - so
 * the object can stand on somebody else's floor: the only pieces that travel
 * between rooms are keyed, and every other piece is drawn back onto the floor
 * it was cut from. `cells` builds a piece a cell at a time out of other cells,
 * which is how a wall is given back the corner a staircase stood in.
 */
const PIECES = [
  // --- Professor Oak's Lab ---------------------------------------------------
  { name: 'lab.wallUpper', from: 'lab', at: [56, 1], size: [1, 1] },
  // The lab's lower wall has something hung on every cell of it - the posters,
  // the window, the backs of the shelves - so the plain one is put back
  // together: the khaki the posters hang on, over the rail beneath them.
  {
    name: 'lab.wallLower',
    from: 'lab',
    at: [59, 2],
    size: [1, 1],
    paint: [[0, 0, 16, 7, [213, 213, 172]]],
  },
  { name: 'lab.floor', from: 'lab', at: [57, 11], size: [1, 1] },
  { name: 'lab.floorShade', from: 'lab', at: [57, 3], size: [1, 1] },
  { name: 'lab.computers', from: 'lab', at: [51, 2], size: [4, 2] },
  { name: 'lab.wallShelves', from: 'lab', at: [60, 2], size: [4, 2] },
  { name: 'lab.machine', from: 'lab', at: [51, 4], size: [3, 3] },
  { name: 'lab.table', from: 'lab', at: [59, 5], size: [3, 2] },
  { name: 'lab.shelvesWest', from: 'lab', at: [51, 9], size: [5, 2] },
  { name: 'lab.shelvesEast', from: 'lab', at: [59, 9], size: [5, 2] },
  { name: 'lab.plant', from: 'lab', at: [51, 12], size: [1, 2] },
  // The east corner's own plant: each is shaded on the side of the wall it stands by.
  { name: 'lab.plantEast', from: 'lab', at: [63, 12], size: [1, 2] },
  { name: 'lab.mat', from: 'lab', px: [896, 220], size: [3, 1], lift: 'mat' },
  // The lab's machine, lifted off the lab floor so Brock's copies of it can
  // stand on his: every pixel that is the floor tile's own pixel goes, which
  // leaves the machine and the shadow it throws.
  { name: 'lab.machineLifted', from: 'lab', at: [52, 4], size: [2, 3], keyTile: [57, 11] },
  // The one piece this sheet paints over rather than only cuts: a lab shelf
  // unit with its books taken out, so Bill's cabinet has empty shelves to be
  // filled. The dark is the unit's own back panel, colour for colour.
  {
    name: 'lab.shelvesEmpty',
    from: 'lab',
    at: [51, 9],
    size: [5, 2],
    key: LAB_FLOOR,
    paint: [
      [3, 6, 74, 4, [82, 82, 106]],
      [3, 12, 74, 4, [82, 82, 106]],
    ],
  },

  // --- the player's house, upstairs -----------------------------------------
  // The bed is drawn half a tile off the room's grid, so it is cut by pixel.
  { name: 'house.bed', from: 'house', px: [640, 96], size: [2, 3], key: HOUSE_FLOOR },

  // --- Bill's cottage, outside --------------------------------------------
  // A little blue-roofed house with its door at one end, standing on the
  // quay: Bill's Sea Cottage is on the coast in the game this is from too.
  // The sheet's white ground round it is lifted so it stands on the harbour's.
  { name: 'cottage', from: 'buildings', px: [459, 1010], pitch: 17, size: [5, 3], lift: 'white' },

  // --- the Pokemon Center ----------------------------------------------------
  // The back of the room whole: the wall, Joy's counter and her machine, the
  // television, the box, the storage PC and the map, and the shadow the
  // counter throws on the floor in front of it.
  { name: 'pc.back', from: 'pc', at: [0, 1], size: [15, 5] },
  // Its two slanting side walls below the counter. The west one is where the
  // staircase to the Cable Club stood; there is no upstairs here, so it is
  // given back the plain slant the wall has above it.
  { name: 'pc.sideWest', from: 'pc', cells: [[[0, 5]], [[0, 5]], [[0, 5]], [[0, 9]]] },
  { name: 'pc.sideEast', from: 'pc', cells: [[[14, 6]], [[14, 6]], [[14, 6]], [[14, 9]]] },
  { name: 'pc.floor', from: 'pc', at: [2, 6], size: [1, 1] },
  { name: 'pc.emblem', from: 'pc', at: [6, 6], size: [3, 3] },
  { name: 'pc.lounge', from: 'pc', at: [11, 6], size: [2, 3] },
  { name: 'pc.mat', from: 'pc', px: [104, 156], size: [3, 1], lift: 'mat' },
  { name: 'pc.healingMachine', from: 'pc', at: [5, 1], size: [2, 3] },
  { name: 'pc.plant', from: 'pc', at: [1, 1], size: [1, 3] },
  // Joy's counter top, a cell at a time, so a Poké Ball can be set down on it.
  { name: 'pc.counterTop', from: 'pc', at: [5, 4], size: [5, 1] },

  // --- Bill's house ----------------------------------------------------------
  { name: 'bill.wallUpper', from: 'bill', at: [6, 0], size: [1, 1] },
  // Bill's lower wall is a grey band over a blue baseboard, and the one cell
  // of it with nothing standing in front has a sheet of paper pinned to it:
  // the paper is painted out with the grey it is pinned to.
  {
    name: 'bill.wallLower',
    from: 'bill',
    at: [13, 1],
    size: [1, 1],
    paint: [[0, 0, 16, 12, [192, 192, 192]]],
  },
  { name: 'bill.floor', from: 'bill', at: [8, 7], size: [1, 1] },
  { name: 'bill.floorShade', from: 'bill', at: [13, 2], size: [1, 1] },
  { name: 'bill.pillar', from: 'bill', at: [0, 0], size: [1, 2] },
  // The two cell separators and the tube between them: the one thing in the
  // Kanto games that could only be Bill's.
  { name: 'bill.separators', from: 'bill', at: [2, 1], size: [10, 3] },
  { name: 'bill.pc', from: 'bill', at: [12, 1], size: [1, 2] },
  { name: 'bill.desk', from: 'bill', at: [4, 5], size: [3, 2] },
  { name: 'bill.plant', from: 'bill', at: [1, 8], size: [1, 2] },
  { name: 'bill.box', from: 'bill', at: [1, 3], size: [1, 1] },
  { name: 'bill.books', from: 'bill', at: [0, 3], size: [1, 1] },
  { name: 'bill.drawer', from: 'bill', at: [8, 3], size: [1, 1] },
  { name: 'bill.mat', from: 'bill', px: [101, 154], size: [3, 1], lift: 'mat' },

  // --- the Rocket Warehouse, which is Brock's workshop -----------------------
  { name: 'warehouse.wallUpper', from: 'warehouse', at: [6, 1], size: [1, 1] },
  { name: 'warehouse.wallLower', from: 'warehouse', at: [6, 2], size: [1, 1] },
  { name: 'warehouse.floor', from: 'warehouse', at: [8, 4], size: [1, 1] },
  { name: 'warehouse.floorShade', from: 'warehouse', at: [6, 3], size: [1, 1] },
  { name: 'warehouse.generator', from: 'warehouse', at: [1, 2], size: [3, 2] },
  { name: 'warehouse.phone', from: 'warehouse', at: [4, 2], size: [1, 1] },
  { name: 'warehouse.vent', from: 'warehouse', at: [5, 2], size: [1, 1] },
  { name: 'warehouse.crate', from: 'warehouse', at: [4, 4], size: [2, 2] },
  { name: 'warehouse.terminals', from: 'warehouse', at: [22, 2], size: [2, 2] },
  { name: 'warehouse.stool', from: 'warehouse', at: [24, 4], size: [1, 1] },
  { name: 'warehouse.monitorDesk', from: 'warehouse', at: [25, 4], size: [2, 3] },
  { name: 'warehouse.sofa', from: 'warehouse', at: [24, 9], size: [2, 2] },
  { name: 'warehouse.bed', from: 'warehouse', at: [26, 10], size: [2, 4] },
  { name: 'warehouse.box', from: 'warehouse', at: [27, 3], size: [1, 1] },
  { name: 'warehouse.mat', from: 'warehouse', px: [376, 428], size: [3, 1], lift: 'mat' },
];

/**
 * A Poké Ball small enough to set on a counter: two to a cell. Drawn here
 * rather than cut, because the only balls on these renders are the lights in
 * the healing machine, and those are three pixels across.
 */
const BALL = ['..kkk..', '.krrrk.', 'krwrrrk', 'kkkwkkk', 'kwwwwwk', '.kwwwk.', '..kkk..'];
const BALL_INK = { k: [36, 31, 46], r: [230, 70, 60], w: [239, 244, 250] };

const [sourceDir] = process.argv.slice(2);
if (!sourceDir) {
  console.error(
    'usage: node scripts/cut-frlg-base.mjs <directory holding 3724.png 3729.png 3733.png 3771.png 3862.png>',
  );
  process.exit(1);
}
const images = new Map();
for (const { file } of Object.values(SOURCES)) {
  const path = join(sourceDir, `${file}.png`);
  if (!existsSync(path)) {
    console.error(`missing ${path} - fetch it first (see the top of this script)`);
    process.exit(1);
  }
  images.set(file, readPng(path));
}

const blank = (width, height) => ({ width, height, data: Buffer.alloc(width * height * 4) });

function copy(from, fx, fy, to, tx, ty, width, height) {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sx = fx + x;
      const sy = fy + y;
      const d = ((ty + y) * to.width + (tx + x)) * 4;
      if (sx < 0 || sy < 0 || sx >= from.width || sy >= from.height) continue;
      const s = (sy * from.width + sx) * 4;
      to.data[d] = from.data[s];
      to.data[d + 1] = from.data[s + 1];
      to.data[d + 2] = from.data[s + 2];
      to.data[d + 3] = 255;
    }
  }
}

function pixelAt(image, x, y) {
  const i = (y * image.width + x) * 4;
  return [image.data[i], image.data[i + 1], image.data[i + 2]];
}
function setPixel(image, x, y, [r, g, b], a = 255) {
  const i = (y * image.width + x) * 4;
  image.data[i] = r;
  image.data[i + 1] = g;
  image.data[i + 2] = b;
  image.data[i + 3] = a;
}
const isNear = (a, b) => a.every((value, index) => value === b[index]);

function cutPiece(piece) {
  const source = SOURCES[piece.from];
  const image = images.get(source.file);
  const [ox, oy] = source.origin;
  let out;
  if (piece.cells) {
    const rows = piece.cells.length;
    const columns = piece.cells[0].length;
    out = blank(columns * TILE, rows * TILE);
    piece.cells.forEach((row, r) =>
      row.forEach(([c, rr], q) =>
        copy(image, ox + c * TILE, oy + rr * TILE, out, q * TILE, r * TILE, TILE, TILE),
      ),
    );
  } else {
    const [w, h] = piece.size;
    const [sx, sy] = piece.px ?? [ox + piece.at[0] * TILE, oy + piece.at[1] * TILE];
    const pitch = piece.pitch ?? TILE;
    out = blank(w * TILE, h * TILE);
    for (let r = 0; r < h; r += 1) {
      for (let q = 0; q < w; q += 1) {
        copy(image, sx + q * pitch, sy + r * pitch, out, q * TILE, r * TILE, TILE, TILE);
      }
    }
  }
  if (piece.lift === 'white') liftWhiteGround(out);
  if (piece.lift === 'mat') liftMat(out);
  if (piece.keyTile) {
    const floor = blank(TILE, TILE);
    copy(
      image,
      ox + piece.keyTile[0] * TILE,
      oy + piece.keyTile[1] * TILE,
      floor,
      0,
      0,
      TILE,
      TILE,
    );
    for (let y = 0; y < out.height; y += 1) {
      for (let x = 0; x < out.width; x += 1) {
        if (isNear(pixelAt(out, x, y), pixelAt(floor, x % TILE, y % TILE)))
          setPixel(out, x, y, [0, 0, 0], 0);
      }
    }
  }
  for (const [x0, y0, width, height, colour] of piece.paint ?? []) {
    for (let y = y0; y < y0 + height; y += 1) {
      for (let x = x0; x < x0 + width; x += 1) setPixel(out, x, y, colour);
    }
  }
  if (piece.key) {
    for (let y = 0; y < out.height; y += 1) {
      for (let x = 0; x < out.width; x += 1) {
        const colour = pixelAt(out, x, y);
        if (piece.key.some((keyed) => isNear(keyed, colour))) setPixel(out, x, y, [0, 0, 0], 0);
      }
    }
  }
  return out;
}

function drawBalls(count) {
  const out = blank(TILE, TILE);
  const seats = count === 1 ? [4] : [0, 8];
  for (const left of seats) {
    BALL.forEach((row, y) =>
      [...row].forEach((ink, x) => {
        if (ink !== '.') setPixel(out, left + x, 5 + y, BALL_INK[ink]);
      }),
    );
  }
  return out;
}

/**
 * Makes the white a building was drawn on transparent - only the white that
 * reaches the edge of the piece, so a white window pane stays a window.
 */
function liftWhiteGround(image) {
  const white = (x, y) =>
    isNear(pixelAt(image, x, y), [255, 255, 255]) && image.data[(y * image.width + x) * 4 + 3] > 0;
  const queue = [];
  for (let x = 0; x < image.width; x += 1) queue.push([x, 0], [x, image.height - 1]);
  for (let y = 0; y < image.height; y += 1) queue.push([0, y], [image.width - 1, y]);
  while (queue.length > 0) {
    const [x, y] = queue.pop();
    if (x < 0 || y < 0 || x >= image.width || y >= image.height || !white(x, y)) continue;
    setPixel(image, x, y, [0, 0, 0], 0);
    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
}

/**
 * A door mat is drawn half a tile low and wider than a tile, hanging over the
 * foot of the room into the dark; it is cut from its own top edge so the whole
 * of it fits one row, and everything either side of it - floor, and the dark -
 * is lifted so it lies on whatever floor it is put down on.
 */
function liftMat(image) {
  const border = pixelAt(image, image.width / 2, 0);
  let left = image.width / 2;
  let right = image.width / 2;
  while (left > 0 && isNear(pixelAt(image, left - 1, 0), border)) left -= 1;
  while (right < image.width - 1 && isNear(pixelAt(image, right + 1, 0), border)) right += 1;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (x < left || x > right) setPixel(image, x, y, [0, 0, 0], 0);
    }
  }
}

const cut = PIECES.map((piece) => ({ name: piece.name, image: cutPiece(piece) }));
cut.push({ name: 'ball.one', image: drawBalls(1) }, { name: 'ball.two', image: drawBalls(2) });

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
writePng('public/assets/frlg-base.png', sheet);

mkdirSync('src/game/base/generated', { recursive: true });
const entries = cut
  .map((piece) => {
    const at = placed.get(piece.name);
    return `  '${piece.name}': { column: ${at.column}, row: ${at.row}, width: ${at.width}, height: ${at.height} },`;
  })
  .join('\n');
writeFileSync(
  'src/game/base/generated/basePieces.ts',
  `// Generated by scripts/cut-frlg-base.mjs from The Spriters Resource's
// FireRed/LeafGreen interior renders. Do not edit: re-run the script.

/** The sheet the base's own FireRed/LeafGreen cuts are drawn from: its four rooms and Bill's cottage. */
export const BASE_SHEET = {
  imagePath: 'assets/frlg-base.png',
  columns: ${SHEET_COLUMNS},
  rows: ${rows},
} as const;

/** Where each named piece sits on the sheet, in tiles. */
export const BASE_PIECES = {
${entries}
} as const;

export type BasePieceName = keyof typeof BASE_PIECES;
`,
);
console.log(`public/assets/frlg-base.png  ${SHEET_COLUMNS}x${rows} tiles, ${cut.length} pieces`);
