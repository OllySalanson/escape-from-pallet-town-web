// Draws THE GREAT LIBRARY onto `public/assets/great-library.png`.
//
//   node scripts/draw-great-library.mjs
//
// Every pixel here is drawn for this game: no sheet has a library, so its
// front, its floor and walls, its bookcases and the lecterns its books lie open
// on are painted below, in FireRed's own hand - the GBA's 15-bit colours (every
// value a multiple of eight), a dark outline round everything and light from
// the top left - so the building stands on FireRed's grass and the room reads
// as one of FireRed's rooms without a seam.
//
// The layout of the sheet is `src/game/base/librarySheet.ts`, which names a
// piece by where it is drawn here. The book itself, opened full screen, is not
// on this sheet: it is painted at run time to the size of the window
// (`src/game/library/bookArt.ts`).
import { writePng } from '../tools/tileset/tileSheet.mjs';

const ROOT = new URL('../', import.meta.url);
const TILE = 16;
const SHEET_COLUMNS = 16;
const SHEET_ROWS = 6;

const hex = (value) => [
  parseInt(value.slice(1, 3), 16),
  parseInt(value.slice(3, 5), 16),
  parseInt(value.slice(5, 7), 16),
  255,
];

const INK = {
  outline: '#404868',
  dark: '#282838',
  // Stone, lit from the top left.
  stoneLight: '#f8f0d8',
  stone: '#e0d0b0',
  stoneShade: '#b8a888',
  stoneDeep: '#887860',
  wallBack: '#c8b898',
  wallBackShade: '#a89878',
  // The slate behind the pediment.
  slate: '#586880',
  slateLight: '#788ca8',
  // Wood: doors, shelves, lecterns, panelling.
  woodLight: '#d89858',
  wood: '#b07038',
  woodShade: '#804820',
  woodDeep: '#583010',
  woodBlack: '#382010',
  // Floor planks, warmer and paler than the furniture so a lectern stands off it.
  plankLight: '#e0b070',
  plank: '#d8a868',
  plankShade: '#c09050',
  plankLine: '#886030',
  // Lamp-lit glass.
  glass: '#f8d878',
  glassDeep: '#e0a840',
  glassShade: '#b87828',
  // Gold leaf and brass.
  gold: '#f8d040',
  goldShade: '#c89818',
  goldDeep: '#886010',
  // Paper.
  paper: '#f8f8e8',
  paperShade: '#e0d8c0',
  paperLine: '#a8a090',
  // Lettering cut into the frieze.
  letter: '#584838',
  // The runner and the mat.
  red: '#c03830',
  redLight: '#e05848',
  redDeep: '#802020',
  // The sky through the back windows, by the player's own clock
  // (`src/game/base/homeClock.ts`): the hours THE BOLTHOLE's window keeps, in
  // that window's own evening orange and night blue brought to the GBA's steps.
  day: '#90c8f8',
  dayLight: '#c0e0f8',
  cloud: '#f8f8f8',
  dusk: '#f89860',
  duskMid: '#f8b878',
  duskLight: '#f8d898',
  duskCloud: '#d07050',
  sun: '#f8f0a0',
  night: '#203060',
  nightLight: '#385090',
  star: '#f8f8c8',
  // Leaves.
  leaf: '#58a050',
  leafLight: '#88c860',
  leafDeep: '#306830',
  // The globe's sea.
  sea: '#4878c0',
  seaLight: '#78a8e0',
};

/** The covers of the books on the lecterns, one lectern a colour (`librarySheet.ts`, `LECTERN_COLOURS`). */
const COVERS = {
  red: ['#e05848', '#c03830', '#802020'],
  blue: ['#5888e0', '#3860b8', '#203878'],
  green: ['#68b858', '#408838', '#285820'],
  gold: ['#f8c848', '#c89020', '#886010'],
  purple: ['#a878d8', '#7850b0', '#483078'],
  teal: ['#58c0b8', '#309088', '#185850'],
};

const SPINES = ['#c03830', '#3860b8', '#408838', '#c89020', '#7850b0', '#309088', '#a86838', '#e0d0b0', '#585068'];

const sheet = { width: SHEET_COLUMNS * TILE, height: SHEET_ROWS * TILE, data: Buffer.alloc(SHEET_COLUMNS * TILE * SHEET_ROWS * TILE * 4) };

function set(x, y, colour) {
  if (x < 0 || y < 0 || x >= sheet.width || y >= sheet.height) return;
  const [r, g, b, a] = hex(colour);
  const at = (y * sheet.width + x) * 4;
  sheet.data[at] = r;
  sheet.data[at + 1] = g;
  sheet.data[at + 2] = b;
  sheet.data[at + 3] = a;
}

function fill(x, y, width, height, colour) {
  for (let dy = 0; dy < height; dy += 1) for (let dx = 0; dx < width; dx += 1) set(x + dx, y + dy, colour);
}

function hline(x, y, width, colour) {
  fill(x, y, width, 1, colour);
}

function vline(x, y, height, colour) {
  fill(x, y, 1, height, colour);
}

/** A box with a one-pixel outline. */
function box(x, y, width, height, inside, edge = INK.outline) {
  fill(x, y, width, height, edge);
  fill(x + 1, y + 1, width - 2, height - 2, inside);
}

/** A tiny repeatable scatter, so the same sheet is drawn every run. */
function noise(x, y, salt = 0) {
  const n = Math.sin(x * 12.9898 + y * 78.233 + salt * 37.719) * 43758.5453;
  return n - Math.floor(n);
}

// --- lettering ------------------------------------------------------------------

/** A 3x5 capital alphabet, enough for the frieze. */
const FONT = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  G: ['.##', '#..', '#.#', '#.#', '.##'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  L: ['#..', '#..', '#..', '#..', '###'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
};

function wordWidth(word) {
  let width = 0;
  for (const letter of word) width += letter === ' ' ? 3 : 4;
  return width - 1;
}

function letters(x, y, word, colour, light) {
  let at = x;
  for (const letter of word) {
    if (letter === ' ') {
      at += 3;
      continue;
    }
    const rows = FONT[letter];
    rows.forEach((row, dy) =>
      [...row].forEach((mark, dx) => {
        if (mark !== '#') return;
        // Cut into the stone: the letter, and the light catching its lower edge.
        set(at + dx, y + dy, colour);
        if (light && (dy === rows.length - 1 || rows[dy + 1][dx] !== '#')) set(at + dx, y + dy + 1, light);
      }),
    );
    at += 4;
  }
}

// --- THE GREAT LIBRARY's front: 5x4 tiles at (0, 0) -------------------------------

function building(ox, oy) {
  const W = 80;
  // The slate roof behind the pediment, seen over its shoulders.
  for (let y = 4; y < 14; y += 1) {
    hline(ox + 1, oy + y, W - 2, y % 3 === 0 ? INK.slate : INK.slateLight);
  }
  hline(ox + 1, oy + 3, W - 2, INK.outline);
  vline(ox, oy + 3, 12, INK.outline);
  vline(ox + W - 1, oy + 3, 12, INK.outline);

  // The pediment: a low triangle of stone, its sloping cornice lit on the left.
  const apex = 1;
  const base = 14;
  for (let y = apex; y <= base; y += 1) {
    const half = Math.round(((y - apex) * 38) / (base - apex)) + 1;
    const left = ox + 40 - half;
    const right = ox + 39 + half;
    hline(left, oy + y, right - left + 1, INK.stone);
    // The raking cornice, two pixels thick, light down the left slope and shaded down the right.
    set(left, oy + y, INK.outline);
    set(right, oy + y, INK.outline);
    if (right - left > 4) {
      set(left + 1, oy + y, INK.stoneLight);
      set(left + 2, oy + y, INK.stoneLight);
      set(right - 1, oy + y, INK.stoneShade);
      set(right - 2, oy + y, INK.stoneShade);
    }
  }
  hline(ox + 39, oy + apex - 1, 2, INK.outline);
  // An open book in gold leaf in the tympanum.
  const bx = ox + 33;
  const by = oy + 8;
  fill(bx, by, 14, 5, INK.goldDeep);
  fill(bx + 1, by, 6, 4, INK.gold);
  fill(bx + 7, by, 6, 4, INK.goldShade);
  hline(bx + 1, by + 1, 5, INK.goldShade);
  hline(bx + 8, by + 1, 4, INK.goldDeep);
  hline(bx + 1, by + 3, 4, INK.goldShade);
  vline(bx + 7, by, 5, INK.goldDeep);

  // The cornice: a lit band, then the dentils.
  hline(ox, oy + 14, W, INK.outline);
  hline(ox + 1, oy + 15, W - 2, INK.stoneLight);
  hline(ox + 1, oy + 16, W - 2, INK.stone);
  for (let x = 1; x < W - 1; x += 1) set(ox + x, oy + 17, x % 3 === 0 ? INK.stoneDeep : INK.stoneShade);
  hline(ox, oy + 18, W, INK.outline);
  vline(ox, oy + 14, 5, INK.outline);
  vline(ox + W - 1, oy + 14, 5, INK.outline);

  // The frieze, and the name cut into it.
  fill(ox + 1, oy + 19, W - 2, 9, INK.stone);
  hline(ox + 1, oy + 19, W - 2, INK.stoneLight);
  vline(ox, oy + 19, 10, INK.outline);
  vline(ox + W - 1, oy + 19, 10, INK.outline);
  const word = 'GREAT LIBRARY';
  letters(ox + Math.floor((W - wordWidth(word)) / 2), oy + 21, word, INK.letter, INK.stoneLight);
  hline(ox + 1, oy + 28, W - 2, INK.stoneShade);
  hline(ox, oy + 29, W, INK.outline);

  // The wall behind the columns, in the shade of the portico.
  fill(ox + 1, oy + 30, W - 2, 27, INK.wallBack);
  hline(ox + 1, oy + 30, W - 2, INK.wallBackShade);
  hline(ox + 1, oy + 31, W - 2, INK.wallBackShade);
  for (let y = 33; y < 56; y += 4) {
    for (let x = 1; x < W - 1; x += 1) {
      if ((x + (y % 8 === 1 ? 4 : 0)) % 8 === 0) set(ox + x, oy + y, INK.wallBackShade);
    }
    hline(ox + 1, oy + y + 3, W - 2, INK.wallBackShade);
  }
  vline(ox, oy + 30, 27, INK.outline);
  vline(ox + W - 1, oy + 30, 27, INK.outline);

  // Two tall windows, lit from inside, a bookcase's shelves showing through.
  for (const wx of [ox + 12, ox + 58]) {
    window(wx, oy + 34);
  }

  // The doorway: a stone surround, a fanlight and a pair of oak doors.
  fill(ox + 30, oy + 34, 20, 23, INK.stone);
  vline(ox + 30, oy + 34, 23, INK.outline);
  vline(ox + 49, oy + 34, 23, INK.outline);
  hline(ox + 30, oy + 34, 20, INK.outline);
  vline(ox + 31, oy + 35, 22, INK.stoneLight);
  vline(ox + 48, oy + 35, 22, INK.stoneShade);
  // The fanlight, an arch of lit glass.
  for (let y = 0; y < 6; y += 1) {
    const inset = [5, 3, 2, 1, 1, 1][y];
    hline(ox + 33 + inset, oy + 36 + y, 14 - inset * 2, y === 0 ? INK.outline : INK.glass);
    set(ox + 33 + inset - 1, oy + 36 + y, INK.outline);
    set(ox + 33 + 14 - inset, oy + 36 + y, INK.outline);
  }
  for (const x of [36, 40, 43]) vline(ox + x, oy + 38, 4, INK.glassShade);
  // The doors.
  fill(ox + 33, oy + 42, 14, 15, INK.wood);
  hline(ox + 33, oy + 42, 14, INK.outline);
  vline(ox + 33, oy + 42, 15, INK.outline);
  vline(ox + 46, oy + 42, 15, INK.outline);
  vline(ox + 40, oy + 42, 15, INK.woodDeep);
  for (const px of [35, 42]) {
    box(ox + px, oy + 44, 4, 5, INK.woodLight, INK.woodShade);
    box(ox + px, oy + 50, 4, 5, INK.woodLight, INK.woodShade);
  }
  set(ox + 39, oy + 50, INK.gold);
  set(ox + 41, oy + 50, INK.gold);

  // Four columns, each with its capital and its base.
  for (const cx of [ox + 5, ox + 23, ox + 51, ox + 69]) {
    column(cx, oy + 30);
  }

  // Two steps the width of the front.
  hline(ox, oy + 57, W, INK.outline);
  fill(ox + 1, oy + 58, W - 2, 2, INK.stoneLight);
  hline(ox + 1, oy + 60, W - 2, INK.stoneShade);
  fill(ox, oy + 61, W, 2, INK.stone);
  hline(ox, oy + 61, W, INK.stoneLight);
  hline(ox, oy + 63, W, INK.outline);
  set(ox, oy + 58, INK.outline);
  set(ox, oy + 59, INK.outline);
  set(ox, oy + 60, INK.outline);
  set(ox + W - 1, oy + 58, INK.outline);
  set(ox + W - 1, oy + 59, INK.outline);
  set(ox + W - 1, oy + 60, INK.outline);
  set(ox, oy + 62, INK.stoneShade);
  set(ox + W - 1, oy + 62, INK.stoneShade);
}

function column(x, y) {
  // The capital, wider than the shaft.
  fill(x - 1, y, 8, 3, INK.outline);
  hline(x, y + 1, 6, INK.stoneLight);
  set(x - 1, y + 1, INK.stoneLight);
  // The shaft: lit down its left, fluted, shaded down its right.
  fill(x, y + 3, 6, 21, INK.stone);
  vline(x, y + 3, 21, INK.outline);
  vline(x + 5, y + 3, 21, INK.outline);
  vline(x + 1, y + 3, 21, INK.stoneLight);
  vline(x + 2, y + 3, 21, INK.stoneLight);
  vline(x + 3, y + 3, 21, INK.stone);
  vline(x + 4, y + 3, 21, INK.stoneShade);
  for (let dy = 4; dy < 23; dy += 2) set(x + 3, y + dy, INK.stoneShade);
  // The base.
  fill(x - 1, y + 24, 8, 3, INK.outline);
  hline(x, y + 25, 6, INK.stone);
  set(x - 1, y + 25, INK.stoneLight);
}

function window(x, y) {
  // 10 wide, 18 tall, an arched head.
  const arch = [3, 1, 0];
  for (let dy = 0; dy < 18; dy += 1) {
    const inset = dy < arch.length ? arch[dy] : 0;
    hline(x + inset, y + dy, 10 - inset * 2, dy === 0 ? INK.outline : INK.glass);
    set(x + inset, y + dy, INK.outline);
    set(x + 9 - inset, y + dy, INK.outline);
  }
  hline(x, y + 17, 10, INK.outline);
  // Shelves of books inside, seen through the glass.
  for (const row of [9, 13]) {
    hline(x + 1, y + row + 3, 8, INK.glassShade);
    for (let bx = 1; bx < 9; bx += 1) {
      if (noise(x + bx, y + row) > 0.3) vline(x + bx, y + row, 3, noise(bx, row) > 0.5 ? INK.glassShade : INK.glassDeep);
    }
  }
  // The glazing bars.
  vline(x + 5, y + 2, 15, INK.woodShade);
  hline(x + 1, y + 7, 8, INK.woodShade);
  // The sill.
  hline(x - 1, y + 18, 12, INK.outline);
  hline(x - 1, y + 19, 12, INK.stoneLight);
}

// --- the room ---------------------------------------------------------------------

/** The floor: long boards, staggered, as a library's are - quiet, so what stands on it reads. */
function floor(x, y, shaded) {
  for (let dy = 0; dy < 16; dy += 1) {
    const band = Math.floor(dy / 4);
    hline(x, y + dy, 16, band % 2 === 0 ? INK.plank : INK.plankLight);
    if (dy % 4 === 3) hline(x, y + dy, 16, INK.plankShade);
  }
  // Where one board ends and the next begins, a different place on every row.
  for (const [band, seam] of [[0, 5], [1, 13], [2, 2], [3, 10]]) {
    vline(x + seam, y + band * 4, 3, INK.plankShade);
  }
  // A knot or two in the grain.
  set(x + 9, y + 1, INK.plankShade);
  set(x + 4, y + 9, INK.plankShade);
  if (shaded) {
    // The shade the back wall throws on the first boards out from it.
    for (let dy = 0; dy < 5; dy += 1) {
      for (let dx = 0; dx < 16; dx += 1) {
        if (dy < 2 || (dx + dy) % 2 === 0) set(x + dx, y + dy, dy < 2 ? INK.plankLine : INK.plankShade);
      }
    }
  }
}

/** The upper wall: dark panelling under a lit moulding. */
function wallUpper(x, y) {
  fill(x, y, 16, 16, INK.woodShade);
  hline(x, y, 16, INK.woodDeep);
  hline(x, y + 1, 16, INK.woodLight);
  hline(x, y + 2, 16, INK.wood);
  hline(x, y + 3, 16, INK.woodDeep);
  // A raised panel, lit on its top and left edges.
  box(x + 2, y + 6, 12, 10, INK.wood, INK.woodDeep);
  hline(x + 3, y + 7, 10, INK.woodLight);
  vline(x + 3, y + 7, 9, INK.woodLight);
}

/** The lower wall: the bottom of the panel, a dado rail and the skirting. */
function wallLower(x, y) {
  fill(x, y, 16, 16, INK.woodShade);
  box(x + 2, y - 1, 12, 7, INK.wood, INK.woodDeep);
  vline(x + 3, y, 5, INK.woodLight);
  hline(x, y + 7, 16, INK.woodDeep);
  hline(x, y + 8, 16, INK.woodLight);
  hline(x, y + 9, 16, INK.wood);
  fill(x, y + 10, 16, 5, INK.woodDeep);
  hline(x, y + 10, 16, INK.woodShade);
  hline(x, y + 15, 16, INK.woodBlack);
}

/** A row of book spines on a shelf, `height` tall, standing on `y + height`. */
function spines(x, y, width, height, salt) {
  let at = x;
  let index = 0;
  while (at < x + width) {
    const thick = noise(at, y, salt) > 0.6 ? 3 : 2;
    const tall = height - Math.floor(noise(at, y, salt + 1) * 3);
    const colour = SPINES[Math.floor(noise(at, y, salt + 2) * SPINES.length)];
    const used = Math.min(thick, x + width - at);
    if (noise(at, y, salt + 3) > 0.92 && used === 2) {
      // A book leaning on its neighbour, or a gap where one is out being read.
      at += 2;
      continue;
    }
    fill(at, y + height - tall, used, tall, colour);
    vline(at, y + height - tall, tall, INK.dark);
    set(at + 1, y + height - tall + 1, INK.paper);
    if (tall > 4) set(at + (used > 2 ? 1 : 1), y + height - 2, INK.gold);
    at += used;
    index += 1;
  }
  return index;
}

/** A tall bookcase against the back wall, 2x2: three shelves under a carved top. */
function wallCase(x, y) {
  box(x, y, 32, 32, INK.woodDeep);
  // The crown.
  hline(x, y, 32, INK.outline);
  fill(x + 1, y + 1, 30, 2, INK.woodLight);
  hline(x + 1, y + 3, 30, INK.wood);
  // The sides.
  fill(x + 1, y + 4, 2, 27, INK.wood);
  fill(x + 29, y + 4, 2, 27, INK.woodShade);
  vline(x + 1, y + 4, 27, INK.woodLight);
  for (const [shelf, salt] of [[4, 1], [13, 2], [22, 3]]) {
    fill(x + 3, y + shelf, 26, 8, INK.woodBlack);
    spines(x + 3, y + shelf, 26, 7, salt + x);
    hline(x + 3, y + shelf + 7, 26, INK.wood);
    hline(x + 3, y + shelf + 8, 26, INK.woodLight);
  }
  hline(x + 1, y + 31, 30, INK.outline);
}

/** A freestanding double-sided stack, 3x2: its top, two shelves, its plinth. */
function stack(x, y) {
  // Its top, seen from above.
  box(x, y + 2, 48, 6, INK.woodLight);
  hline(x + 1, y + 6, 46, INK.wood);
  // The front.
  box(x, y + 7, 48, 25, INK.woodDeep);
  fill(x + 1, y + 8, 2, 20, INK.wood);
  fill(x + 45, y + 8, 2, 20, INK.woodShade);
  vline(x + 1, y + 8, 20, INK.woodLight);
  for (const [shelf, salt] of [[8, 5], [17, 6]]) {
    fill(x + 3, y + shelf, 42, 8, INK.woodBlack);
    spines(x + 3, y + shelf, 42, 7, salt + x);
    hline(x + 3, y + shelf + 7, 42, INK.wood);
    hline(x + 3, y + shelf + 8, 42, INK.woodLight);
  }
  // The plinth.
  fill(x + 1, y + 27, 46, 4, INK.woodShade);
  hline(x + 1, y + 27, 46, INK.wood);
  hline(x, y + 31, 48, INK.outline);
}

/**
 * A lectern with a book lying open on it, 1x2: the book on a slanted top over
 * a turned wooden post. Its cover is the book's colour, so a book is found
 * again by its colour as well as its name.
 */
function lectern(x, y, cover) {
  const [light, mid, deep] = cover;
  // The slanted top.
  fill(x + 1, y + 9, 14, 5, INK.wood);
  hline(x, y + 8, 16, INK.outline);
  vline(x, y + 8, 7, INK.outline);
  vline(x + 15, y + 8, 7, INK.outline);
  hline(x + 1, y + 13, 14, INK.woodShade);
  hline(x, y + 14, 16, INK.outline);
  hline(x + 1, y + 9, 14, INK.woodLight);
  // The book, open, its covers showing round the pages.
  fill(x + 1, y + 2, 14, 9, deep);
  fill(x + 2, y + 2, 12, 8, mid);
  hline(x + 2, y + 2, 12, light);
  // Its pages: two of them, bowed up from the spine.
  fill(x + 2, y + 3, 5, 6, INK.paper);
  fill(x + 9, y + 3, 5, 6, INK.paperShade);
  set(x + 2, y + 3, mid);
  set(x + 13, y + 3, mid);
  vline(x + 7, y + 3, 6, INK.paperShade);
  vline(x + 8, y + 3, 6, INK.paperLine);
  for (const row of [4, 6]) {
    hline(x + 3, y + row, 3, INK.paperLine);
    hline(x + 10, y + row, 3, INK.paperLine);
  }
  hline(x + 3, y + 8, 2, INK.paperLine);
  // A ribbon down the front of the lectern.
  vline(x + 8, y + 11, 4, light);
  set(x + 8, y + 15, mid);
  // The post, turned, and its foot.
  const post = y + 16;
  fill(x + 5, post, 6, 11, INK.outline);
  fill(x + 6, post, 4, 11, INK.wood);
  vline(x + 6, post, 11, INK.woodLight);
  vline(x + 9, post, 11, INK.woodShade);
  hline(x + 5, post + 3, 6, INK.woodDeep);
  hline(x + 5, post + 7, 6, INK.woodDeep);
  fill(x + 2, post + 11, 12, 4, INK.outline);
  hline(x + 3, post + 12, 10, INK.wood);
  hline(x + 3, post + 13, 10, INK.woodShade);
  hline(x + 3, post + 12, 3, INK.woodLight);
  // Its shadow on the boards.
  hline(x + 3, post + 15, 10, INK.plankShade);
}

/**
 * The golden plinth, 1x2, for the book that is a prize in itself: a gilded
 * column on a stepped foot with the book lying on a velvet cushion, and a
 * glint in the air round it. Locked, a chain is wrapped across the book and a
 * padlock hangs at its middle.
 */
function goldenPlinth(x, y, locked) {
  const [light, mid, deep] = COVERS.purple;
  // The cushion, red velvet with gold tassels.
  fill(x + 1, y + 8, 14, 5, INK.redDeep);
  fill(x + 2, y + 8, 12, 3, INK.red);
  hline(x + 2, y + 8, 12, INK.redLight);
  set(x, y + 12, INK.gold);
  set(x + 15, y + 12, INK.gold);
  // The book, bound dark, its gilt edges catching the light.
  fill(x + 1, y + 2, 14, 8, INK.outline);
  fill(x + 2, y + 2, 12, 7, deep);
  hline(x + 2, y + 2, 12, mid);
  fill(x + 2, y + 3, 5, 5, INK.paper);
  fill(x + 9, y + 3, 5, 5, INK.paperShade);
  vline(x + 7, y + 3, 5, INK.goldShade);
  vline(x + 8, y + 3, 5, INK.gold);
  for (const row of [4, 6]) {
    hline(x + 3, y + row, 3, INK.goldShade);
    hline(x + 10, y + row, 3, INK.goldShade);
  }
  set(x + 2, y + 2, INK.gold);
  set(x + 13, y + 2, INK.gold);
  set(x + 2, y + 9, INK.gold);
  set(x + 13, y + 9, INK.gold);
  set(x + 8, y + 9, light);
  // The gilded top and column.
  fill(x + 1, y + 13, 14, 3, INK.outline);
  hline(x + 2, y + 13, 12, INK.gold);
  hline(x + 2, y + 14, 12, INK.goldShade);
  const post = y + 16;
  fill(x + 4, post, 8, 10, INK.outline);
  fill(x + 5, post, 6, 10, INK.goldShade);
  vline(x + 5, post, 10, '#fff8c8');
  vline(x + 6, post, 10, INK.gold);
  vline(x + 9, post, 10, INK.goldDeep);
  vline(x + 10, post, 10, INK.goldDeep);
  for (const dy of [2, 6]) hline(x + 4, post + dy, 8, INK.goldDeep);
  // A stepped foot, wider than a lectern's.
  fill(x, post + 10, 16, 5, INK.outline);
  hline(x + 1, post + 11, 14, INK.gold);
  hline(x + 1, post + 12, 14, INK.goldShade);
  hline(x + 1, post + 13, 14, INK.goldDeep);
  hline(x + 1, post + 11, 4, '#fff8c8');
  // Glints in the air about it.
  for (const [dx, dy] of [[0, 1], [15, 5], [1, 20], [14, 24]]) {
    set(x + dx, y + dy, '#fff8c8');
  }
  if (!locked) return;
  // The chain, round the book from corner to corner.
  for (let i = 0; i < 14; i += 1) {
    const cx = x + 1 + i;
    const cy = y + 2 + Math.round((i * 7) / 13);
    set(cx, cy, i % 2 === 0 ? '#a8a8b8' : '#585868');
    const ox = x + 14 - i;
    set(ox, cy, i % 2 === 0 ? '#a8a8b8' : '#585868');
  }
  // The padlock where the chains cross.
  fill(x + 5, y + 6, 6, 6, INK.outline);
  fill(x + 6, y + 7, 4, 4, INK.gold);
  hline(x + 6, y + 7, 4, '#fff8c8');
  set(x + 7, y + 9, INK.dark);
  set(x + 8, y + 9, INK.dark);
  set(x + 7, y + 10, INK.dark);
  hline(x + 6, y + 4, 4, INK.outline);
  set(x + 6, y + 5, INK.outline);
  set(x + 9, y + 5, INK.outline);
}

/**
 * A tall window in the back wall, 1x2, with the sky of the hour through it:
 * `day` is blue with a cloud, `dusk` orange with the sun low on the sill and
 * `night` dark with the stars out. The room plants the one the player's clock
 * says (`windowLight` in `src/game/base/homeClock.ts`).
 */
function backWindow(x, y, hour) {
  const sky = { day: [INK.dayLight, INK.day], dusk: [INK.dusk, INK.duskMid], night: [INK.nightLight, INK.night] }[hour];
  fill(x, y, 16, 32, INK.woodShade);
  box(x + 2, y + 3, 12, 26, sky[0], INK.woodDeep);
  for (let dy = 0; dy < 4; dy += 1) {
    const inset = [4, 2, 1, 0][dy];
    hline(x + 3, y + 4 + dy, inset, INK.woodDeep);
    hline(x + 13 - inset, y + 4 + dy, inset, INK.woodDeep);
  }
  fill(x + 3, y + 16, 10, 12, sky[1]);
  if (hour === 'day') {
    // A cloud going by in the top light.
    hline(x + 4, y + 10, 4, INK.cloud);
    hline(x + 5, y + 9, 2, INK.cloud);
    hline(x + 10, y + 12, 2, INK.cloud);
    // And one lower down, behind the bars.
    hline(x + 9, y + 20, 3, INK.cloud);
    hline(x + 10, y + 19, 2, INK.cloud);
  } else if (hour === 'dusk') {
    // Paler toward the skyline, and the sun half down behind the sill.
    fill(x + 3, y + 22, 10, 6, INK.duskLight);
    hline(x + 10, y + 24, 2, INK.sun);
    fill(x + 9, y + 25, 4, 3, INK.sun);
    // Two long thin clouds, dark against the light.
    hline(x + 4, y + 10, 3, INK.duskCloud);
    hline(x + 10, y + 12, 3, INK.duskCloud);
    hline(x + 3, y + 19, 4, INK.duskCloud);
  } else {
    set(x + 5, y + 9, INK.star);
    set(x + 10, y + 13, INK.star);
    set(x + 7, y + 20, INK.star);
  }
  // The bars.
  vline(x + 8, y + 5, 23, INK.woodDeep);
  hline(x + 3, y + 15, 10, INK.woodDeep);
  // The sill.
  hline(x + 1, y + 29, 14, INK.woodLight);
  hline(x + 1, y + 30, 14, INK.woodDeep);
}

/** A globe on a stand, 1x2. */
function globe(x, y) {
  const cx = x + 8;
  const cy = y + 12;
  for (let dy = -6; dy <= 6; dy += 1) {
    for (let dx = -6; dx <= 6; dx += 1) {
      const d = dx * dx + dy * dy;
      if (d <= 36) set(cx + dx, cy + dy, d > 26 ? INK.outline : noise(cx + dx, cy + dy, 9) > 0.55 ? INK.leaf : dx + dy < -3 ? INK.seaLight : INK.sea);
    }
  }
  // The meridian ring, brass.
  for (let dy = -7; dy <= 7; dy += 1) set(cx + (dy < 0 ? 7 : 7), cy + dy, INK.goldShade);
  set(cx - 2, cy - 3, INK.paper);
  // The stand.
  fill(cx - 1, cy + 7, 3, 8, INK.outline);
  vline(cx, cy + 7, 8, INK.woodLight);
  fill(cx - 5, y + 27, 11, 3, INK.outline);
  hline(cx - 4, y + 28, 9, INK.wood);
  hline(cx - 3, y + 30, 8, INK.plankShade);
}

/** A potted fern, 1x2. */
function fern(x, y) {
  const cx = x + 8;
  for (const [dx, dy, len] of [[-6, 6, 7], [-4, 2, 8], [0, 0, 9], [4, 2, 8], [6, 6, 7], [-2, 8, 6], [2, 8, 6]]) {
    for (let i = 0; i < len; i += 1) {
      const px = cx + Math.round(dx * (i / len));
      const py = y + 18 - Math.round((18 - dy) * (i / len));
      set(px, py, i % 3 === 0 ? INK.leafDeep : INK.leaf);
      if (i % 2 === 0) set(px + (dx < 0 ? -1 : 1), py, INK.leafLight);
    }
  }
  fill(cx - 5, y + 19, 11, 2, INK.outline);
  fill(cx - 4, y + 21, 9, 7, INK.redDeep);
  fill(cx - 3, y + 21, 3, 6, INK.red);
  hline(cx - 4, y + 19, 9, INK.redLight);
  hline(cx - 4, y + 28, 9, INK.outline);
  hline(cx - 3, y + 29, 8, INK.plankShade);
}

/** The red runner up the middle of the room, one tile, laid end to end. */
function runner(x, y) {
  fill(x + 2, y, 12, 16, INK.red);
  vline(x + 2, y, 16, INK.goldShade);
  vline(x + 13, y, 16, INK.goldShade);
  vline(x + 3, y, 16, INK.redDeep);
  vline(x + 12, y, 16, INK.redDeep);
  for (let dy = 2; dy < 16; dy += 8) {
    set(x + 7, y + dy, INK.redLight);
    set(x + 8, y + dy, INK.redLight);
    set(x + 7, y + dy + 1, INK.redLight);
    set(x + 8, y + dy + 1, INK.redLight);
  }
}

/** The door mat: the runner's foot, wider, bordered in gold and fringed. */
function mat(x, y) {
  fill(x + 2, y, 12, 3, INK.red);
  vline(x + 2, y, 3, INK.goldShade);
  vline(x + 13, y, 3, INK.goldShade);
  fill(x, y + 3, 16, 11, INK.outline);
  fill(x + 1, y + 4, 14, 9, INK.redDeep);
  fill(x + 2, y + 5, 12, 7, INK.goldShade);
  fill(x + 3, y + 6, 10, 5, INK.red);
  hline(x + 3, y + 6, 10, INK.redLight);
  for (let dx = 1; dx < 15; dx += 2) set(x + dx, y + 14, INK.goldShade);
}

/** The librarian's desk, 3x2: a counter of books and a lamp. */
function desk(x, y) {
  // Its top.
  box(x, y + 6, 48, 6, INK.woodLight);
  hline(x + 1, y + 10, 46, INK.wood);
  // A pile of books on it, a bell and a green lamp.
  fill(x + 6, y + 1, 10, 6, INK.outline);
  fill(x + 7, y + 2, 8, 1, COVERS.blue[1]);
  fill(x + 7, y + 3, 8, 1, INK.paper);
  fill(x + 7, y + 4, 8, 1, COVERS.red[1]);
  fill(x + 7, y + 5, 8, 1, COVERS.gold[1]);
  fill(x + 34, y + 0, 8, 3, INK.leafDeep);
  hline(x + 35, y + 0, 6, INK.leaf);
  vline(x + 38, y + 3, 4, INK.goldShade);
  hline(x + 35, y + 3, 6, INK.glass);
  fill(x + 22, y + 4, 4, 3, INK.goldShade);
  set(x + 23, y + 3, INK.gold);
  // The front, panelled.
  box(x, y + 11, 48, 21, INK.wood, INK.outline);
  hline(x + 1, y + 12, 46, INK.woodLight);
  for (const px of [3, 19, 35]) box(x + px, y + 15, 10, 12, INK.woodShade, INK.woodDeep);
  hline(x + 1, y + 30, 46, INK.woodDeep);
}

/**
 * The end bookcase swung open on its hinge, 2x2: the case turned edge-on
 * against the wall on the right, and where it stood a dark arch into THE CHART
 * ROOM, a worn step and a lamp glow beyond. The bottom-left cell is walked
 * into (`rooms.ts`), so its floor is the passage's own.
 */
function secretCaseOpen(x, y) {
  // The wall behind, panelled like the rest of the back wall.
  fill(x, y, 32, 32, INK.woodShade);
  hline(x, y, 32, INK.outline);
  fill(x + 1, y + 1, 30, 2, INK.woodLight);
  hline(x + 1, y + 3, 30, INK.wood);
  // The arch: dark, with the lamp-lit room glowing at its far end.
  fill(x + 2, y + 6, 18, 26, INK.dark);
  fill(x + 4, y + 4, 14, 2, INK.dark);
  set(x + 3, y + 5, INK.dark);
  set(x + 18, y + 5, INK.dark);
  // Stone round the arch, lit from the top left.
  hline(x + 4, y + 3, 14, INK.stoneLight);
  vline(x + 1, y + 6, 26, INK.stoneLight);
  set(x + 2, y + 5, INK.stoneLight);
  set(x + 3, y + 4, INK.stoneLight);
  vline(x + 20, y + 6, 26, INK.stoneShade);
  set(x + 19, y + 5, INK.stoneShade);
  set(x + 18, y + 4, INK.stoneShade);
  // The glow of the lamp in the room beyond, and its light spilling down.
  fill(x + 7, y + 10, 8, 10, INK.glassShade);
  fill(x + 8, y + 11, 6, 8, INK.glassDeep);
  fill(x + 9, y + 12, 4, 5, INK.glass);
  // The floor of the passage: worn planks, lit by the room beyond.
  fill(x + 2, y + 22, 18, 10, INK.plankShade);
  for (let row = 24; row < 32; row += 3) hline(x + 2, y + row, 18, INK.plankLine);
  hline(x + 2, y + 22, 18, INK.glassShade);
  fill(x + 6, y + 23, 10, 2, INK.plank);
  // The bookcase, swung back against the wall on its hinge, seen edge-on.
  box(x + 21, y + 2, 10, 30, INK.woodDeep);
  fill(x + 22, y + 3, 3, 28, INK.wood);
  vline(x + 22, y + 3, 28, INK.woodLight);
  for (const shelf of [5, 13, 21]) {
    fill(x + 25, y + shelf, 5, 7, INK.woodBlack);
    for (let book = 0; book < 5; book += 1) {
      vline(x + 25 + book, y + shelf + 1 + (book % 2), 6 - (book % 2), SPINES[(book + shelf) % SPINES.length]);
    }
    hline(x + 25, y + shelf + 7, 5, INK.woodLight);
  }
  hline(x, y + 31, 2, INK.outline);
}

/**
 * The smugglers' chest, opened, 2x2: the domed lid thrown back against the
 * wall, iron bands and a brass lock, and inside nothing but a few coins
 * nobody wanted and the straw it was packed in.
 */
function seaChestOpen(x, y) {
  // The lid, thrown back: its inside face, planked, banded in iron.
  box(x + 3, y + 2, 26, 13, INK.woodShade, INK.outline);
  for (let row = 5; row < 14; row += 3) hline(x + 4, y + row, 24, INK.woodDeep);
  fill(x + 8, y + 3, 2, 11, '#585868');
  fill(x + 22, y + 3, 2, 11, '#585868');
  hline(x + 4, y + 3, 24, INK.wood);
  // The body: the rim, the dark inside and its straw, then the front.
  box(x + 2, y + 14, 28, 6, INK.dark, INK.outline);
  fill(x + 3, y + 16, 26, 3, '#b89848');
  for (let i = 0; i < 26; i += 3) set(x + 3 + i, y + 16 + (i % 2), '#e0c868');
  set(x + 12, y + 17, INK.gold);
  set(x + 13, y + 17, INK.goldShade);
  set(x + 19, y + 16, INK.gold);
  box(x + 2, y + 19, 28, 12, INK.wood, INK.outline);
  hline(x + 3, y + 20, 26, INK.woodLight);
  for (let row = 23; row < 30; row += 3) hline(x + 3, y + row, 26, INK.woodShade);
  fill(x + 8, y + 19, 2, 12, '#585868');
  fill(x + 22, y + 19, 2, 12, '#585868');
  vline(x + 8, y + 20, 10, '#8888a0');
  vline(x + 22, y + 20, 10, '#8888a0');
  // The lock, hanging open.
  box(x + 13, y + 20, 6, 6, INK.gold, INK.goldDeep);
  set(x + 15, y + 22, INK.goldDeep);
  set(x + 16, y + 22, INK.goldDeep);
  set(x + 15, y + 23, INK.goldDeep);
  set(x + 14, y + 21, '#f8f0a0');
  // Its shadow on the boards.
  hline(x + 3, y + 31, 26, INK.plankLine);
}

// --- the sheet ----------------------------------------------------------------------

building(0, 0);
floor(5 * TILE, 0, false);
floor(6 * TILE, 0, true);
wallUpper(7 * TILE, 0);
wallLower(8 * TILE, 0);
runner(9 * TILE, 0);
mat(10 * TILE, 0);
wallCase(5 * TILE, TILE);
stack(7 * TILE, TILE);
backWindow(10 * TILE, TILE, 'night');
backWindow(13 * TILE, 4 * TILE, 'day');
backWindow(14 * TILE, 4 * TILE, 'dusk');
globe(11 * TILE, TILE);
fern(12 * TILE, TILE);
Object.values(COVERS).forEach((cover, index) => lectern(index * TILE, 4 * TILE, cover));
desk(6 * TILE, 4 * TILE);
goldenPlinth(9 * TILE, 4 * TILE, false);
goldenPlinth(10 * TILE, 4 * TILE, true);
secretCaseOpen(13 * TILE, TILE);
seaChestOpen(11 * TILE, 4 * TILE);

writePng(new URL('public/assets/great-library.png', ROOT), sheet);
console.log(`great-library.png ${sheet.width}x${sheet.height}`);
