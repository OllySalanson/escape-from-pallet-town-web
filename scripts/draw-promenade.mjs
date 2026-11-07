// Draws THE PROMENADE's own art onto `public/assets/promenade.png`.
//
//   node scripts/draw-promenade.mjs
//
// THE HARBOUR grew east into a seaside front (`src/game/base/baseMap.ts`), and
// a seaside front has things a FireRed town does not: lamps along the walk,
// parasols and deckchairs on the sand, a row of painted beach huts, railings
// along the edge, a lifebuoy, an ice-cream cart and pennants. None of that is
// on any sheet the game has, so it is drawn here, in FireRed's own hand - the
// GBA's 15-bit colours (every value a multiple of eight), a dark outline round
// everything and light from the top left - so it stands on FireRed's sand and
// stone without a seam.
//
// And it makes its buildings say what they are, as THE RAID ARENA does
// (`scripts/draw-raid-arena.mjs`): THE GAME CORNER is Celadon's own Game
// Corner from FireRed's cut (`public/assets/frlg-towns.png`,
// `TOWN_PIECES.gameCorner`, made by `scripts/cut-frlg-towns.mjs`) with a
// marquee across its front that reads GAME CORNER in lit letters inside a ring
// of bulbs, its doors lit from inside, and the little building beside it - the
// prize window - under a gold ticket that reads PRIZES. A sign is a row of
// `SIGNS` below, so the next building on the front (THE BATTLE ARENA, the
// Fighting Dojo, `TOWN_PIECES.dojo`) is given its own the same way.
//
// The cut is read whole and only the pixels named below change, so a re-cut of
// the Game Corner moves the building with it. Nothing here is taken from
// anywhere else; `public/assets/ASSET_PROVENANCE.md` records it. The layout of
// the sheet is `src/game/base/promenadeSheet.ts`.
import { readFileSync } from 'node:fs';
import { readPng, writePng } from '../tools/tileset/tileSheet.mjs';

const ROOT = new URL('../', import.meta.url);
const TILE = 16;
const SHEET_COLUMNS = 16;
const SHEET_ROWS = 12;

const hex = (value) => [
  parseInt(value.slice(1, 3), 16),
  parseInt(value.slice(3, 5), 16),
  parseInt(value.slice(5, 7), 16),
  255,
];

// FireRed's own colours wherever the Game Corner already has one, and every
// new one a 15-bit value, as the GBA draws them.
const INK = {
  outline: '#404868',
  dark: '#282838',
  iron: '#303848',
  ironLight: '#687088',
  ironShine: '#a0a8c0',
  white: '#f8f8f8',
  cream: '#f8f0d0',
  shade: '#c8c8d8',
  // Lamp light.
  lamp: '#f8d058',
  lampHot: '#fff8c8',
  lampDeep: '#e09030',
  // The marquee's night: a deep violet field, and its neon.
  night: '#302050',
  nightLight: '#483070',
  neon: '#f860b0',
  neonHot: '#ffc8e8',
  neonDeep: '#b02878',
  bulb: '#f8e070',
  bulbHot: '#fff8d0',
  bulbOff: '#c09030',
  // The ticket's gold and its red letters.
  gold: '#f8c840',
  goldLight: '#f8e890',
  goldDark: '#b07818',
  red: '#d03030',
  redDark: '#901818',
  // Wood.
  wood: '#b07840',
  woodLight: '#d8a060',
  woodDark: '#704020',
  // Stone.
  stone: '#a8a8b8',
  stoneLight: '#d0d0e0',
  stoneDark: '#686878',
  // Leaves and petals.
  leaf: '#48a048',
  leafDark: '#286828',
  leafLight: '#88d070',
  // The cabinet's screen.
  screen: '#103828',
  screenLight: '#48b868',
  vine: '#68d050',
  vineDark: '#287830',
  sky: '#88c8f8',
};

/** The colours a striped thing comes in: its colour, its shadow, and its highlight. */
const STRIPES = {
  red: { c: '#e04040', d: '#a02028', l: '#f88080' },
  blue: { c: '#4078e0', d: '#2848a0', l: '#88b0f8' },
  yellow: { c: '#f8c030', d: '#c08818', l: '#f8e080' },
  green: { c: '#40b060', d: '#287840', l: '#88e098' },
  pink: { c: '#f070b0', d: '#b04080', l: '#f8b0d8' },
  teal: { c: '#30b0b0', d: '#207878', l: '#80e0e0' },
};

const canvas = (width, height) => ({ width, height, data: Buffer.alloc(width * height * 4) });

function name([r, g, b]) {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function get(image, x, y) {
  const at = (y * image.width + x) * 4;
  return [...image.data.subarray(at, at + 4)];
}

function set(image, x, y, rgba) {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return;
  const at = (y * image.width + x) * 4;
  for (let channel = 0; channel < 4; channel += 1) image.data[at + channel] = rgba[channel];
}

function copy(from, sx, sy, width, height, to, dx, dy) {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) set(to, dx + x, dy + y, get(from, sx + x, sy + y));
  }
}

/** Character art at (x, y): one character a pixel, `.` left alone, every other character a colour from `key`. */
function draw(image, x, y, rows, key) {
  rows.forEach((row, dy) => {
    [...row].forEach((character, dx) => {
      if (character === '.') return;
      const colour = key[character];
      if (!colour) throw new Error(`no colour for '${character}' in "${row}"`);
      set(image, x + dx, y + dy, hex(colour));
    });
  });
}

/** Recolours every pixel in a rectangle whose colour is a key of `map`. */
function recolour(image, x0, y0, width, height, map) {
  const from = new Map(Object.entries(map).map(([source, target]) => [source.toLowerCase(), hex(target)]));
  for (let y = y0; y < y0 + height; y += 1) {
    for (let x = x0; x < x0 + width; x += 1) {
      const [r, g, b, a] = get(image, x, y);
      if (a === 0) continue;
      const target = from.get(name([r, g, b]));
      if (target) set(image, x, y, target);
    }
  }
}

function fill(image, x0, y0, width, height, colour) {
  for (let y = y0; y < y0 + height; y += 1) {
    for (let x = x0; x < x0 + width; x += 1) set(image, x, y, hex(colour));
  }
}

/** Where a named piece sits on the town sheet, read from the module the cut writes. */
function townPiece(piece) {
  const source = readFileSync(new URL('src/game/world/generated/townPieces.ts', ROOT), 'utf8');
  const match = new RegExp(`\\b${piece}: \\{\\s*column: (\\d+),\\s*row: (\\d+),\\s*width: (\\d+),\\s*height: (\\d+)`).exec(
    source,
  );
  if (!match) throw new Error(`no town piece '${piece}'`);
  const [, column, row, width, height] = match.map(Number);
  return { column, row, width, height };
}

// --- Lettering -----------------------------------------------------------

/** Five-by-seven capitals for a marquee, which is read from across the front. */
const BIG = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  ' ': ['...', '...', '...', '...', '...', '...', '...'],
};

/** Three-by-five capitals, for a plate. */
const SMALL = {
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'],
  M: ['#.#', '###', '###', '#.#', '#.#'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  Z: ['###', '..#', '.#.', '#..', '###'],
};

/** A word in a font as rows of `#` and `.`, a column apart. */
function lettering(word, font) {
  const height = font[Object.keys(font)[0]].length;
  return Array.from({ length: height }, (_, row) =>
    [...word]
      .map((letter) => {
        const glyph = font[letter];
        if (!glyph) throw new Error(`no glyph for '${letter}'`);
        return glyph[row];
      })
      .join('.'),
  );
}

/**
 * A marquee: lit letters on a night-violet board in a ring of bulbs, the bulbs
 * alternately lit and dim as a chase is caught mid-step. Neon letters are
 * drawn three times - a deep shadow a pixel down, the tube, and a hot core on
 * the top row of each stroke - so they read as light rather than paint.
 */
function marquee(image, x, y, width, height, word) {
  const letters = lettering(word, BIG);
  const textWidth = letters[0].length;
  // The board and its frame.
  fill(image, x, y, width, height, INK.night);
  fill(image, x + 1, y + 1, width - 2, 1, INK.nightLight);
  for (let dx = 0; dx < width; dx += 1) {
    set(image, x + dx, y, hex(INK.dark));
    set(image, x + dx, y + height - 1, hex(INK.dark));
  }
  for (let dy = 0; dy < height; dy += 1) {
    set(image, x, y + dy, hex(INK.dark));
    set(image, x + width - 1, y + dy, hex(INK.dark));
  }
  // The bulbs, every third pixel round the inside of the frame.
  const bulb = (bx, by, lit) => {
    set(image, bx, by, hex(lit ? INK.bulbHot : INK.bulbOff));
    if (lit) {
      set(image, bx + 1, by, hex(INK.bulb));
      set(image, bx, by + 1, hex(INK.bulb));
    }
  };
  let count = 0;
  for (let dx = 2; dx < width - 3; dx += 3) {
    bulb(x + dx, y + 2, count % 2 === 0);
    bulb(x + dx, y + height - 4, count % 2 === 1);
    count += 1;
  }
  // The word, centred.
  const ox = x + Math.floor((width - textWidth) / 2);
  const oy = y + Math.floor((height - letters.length) / 2);
  letters.forEach((row, dy) => {
    [...row].forEach((pixel, dx) => {
      if (pixel !== '#') return;
      set(image, ox + dx, oy + dy + 1, hex(INK.neonDeep));
    });
  });
  letters.forEach((row, dy) => {
    [...row].forEach((pixel, dx) => {
      if (pixel !== '#') return;
      const above = dy > 0 && letters[dy - 1][dx] === '#';
      set(image, ox + dx, oy + dy, hex(above ? INK.neon : INK.neonHot));
    });
  });
}

/**
 * A gold ticket round a word: its ends notched like a raffle ticket's, a light
 * bevel above and a dark one below, red letters on gold.
 */
function ticket(image, x, y, word) {
  const letters = lettering(word, SMALL);
  const width = letters[0].length + 8;
  const height = letters.length + 6;
  for (let dy = 0; dy < height; dy += 1) {
    for (let dx = 0; dx < width; dx += 1) {
      const notch = (dx === 0 || dx === width - 1) && dy >= 2 && dy <= height - 3 && dy === Math.floor(height / 2);
      const corner = (dx === 0 || dx === width - 1) && (dy === 0 || dy === height - 1);
      if (corner || notch) continue;
      const edge = dx === 0 || dy === 0 || dx === width - 1 || dy === height - 1;
      const colour = edge ? INK.goldDark : dy === 1 ? INK.goldLight : dy === height - 2 ? INK.goldDark : INK.gold;
      set(image, x + dx, y + dy, hex(colour));
    }
  }
  // A dotted line inside each end, where a ticket tears.
  for (let dy = 2; dy < height - 2; dy += 2) {
    set(image, x + 2, y + dy, hex(INK.goldDark));
    set(image, x + width - 3, y + dy, hex(INK.goldDark));
  }
  letters.forEach((row, dy) => {
    [...row].forEach((pixel, dx) => {
      if (pixel === '#') set(image, x + 4 + dx, y + 3 + dy, hex(dy === letters.length - 1 ? INK.redDark : INK.red));
    });
  });
  return { width, height };
}

// --- The buildings -------------------------------------------------------

/** FireRed's grass, which the cut lifted under every building it stands on. */
const LIFTED_GROUND = new Set(['#70c8a0', '#a0e0c0', '#40b088', '#000000']);

/** A building's own pixels back where the cut lifted them as ground, down to its front row. */
function putBack(image, foot) {
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const [r, g, b, a] = get(image, x, y);
      if (a === 0 && y < foot(x) && !LIFTED_GROUND.has(name([r, g, b]))) set(image, x, y, [r, g, b, 255]);
    }
  }
}

/** The door glass lit warm from inside, as THE RAID ARENA's is. */
function lightDoor(image, x, y, width, height) {
  recolour(image, x, y, width, height, { '#4880c0': INK.lampDeep, '#60a0d8': INK.lamp, '#98d0f8': INK.lampHot });
}

/**
 * Every building on the front that says what it is, by the town piece it is
 * drawn from. Each is a function of the cut, so a re-cut redraws it.
 */
const SIGNS = {
  gameCorner(towns) {
    const piece = townPiece('gameCorner');
    if (piece.width !== 10 || piece.height !== 6) throw new Error('the Game Corner is no longer 10x6: redraw its signs');
    const image = canvas(piece.width * TILE, piece.height * TILE);
    copy(towns, piece.column * TILE, piece.row * TILE, image.width, image.height, image, 0, 0);
    // The main hall's front comes down to its step at row 5; the prize
    // window's is a row shorter.
    putBack(image, (x) => (x < 112 ? 80 : 64));
    // GAME CORNER across the hall's front, over the two rows of windows, in a
    // ring of bulbs.
    marquee(image, 6, 11, 100, 23, 'GAME CORNER');
    // The board's two brackets down to the eaves.
    for (const bx of [16, 92]) draw(image, bx, 34, ['kk', 'ks', 'kk'], { k: INK.iron, s: INK.ironLight });
    // PRIZES over the prize window, on a gold ticket.
    const plateWidth = lettering('PRIZES', SMALL)[0].length + 8;
    ticket(image, 112 + Math.floor((48 - plateWidth) / 2), 13, 'PRIZES');
    // Both doors lit from inside.
    lightDoor(image, 44, 60, 24, 20);
    lightDoor(image, 124, 44, 24, 20);
    return image;
  },
};

// --- The front -----------------------------------------------------------

const IRON = { k: INK.iron, s: INK.ironLight, w: INK.ironShine };

/** A seaside lamp post, 1x2: a lantern on a fluted iron post. */
function lamp() {
  const image = canvas(TILE, 2 * TILE);
  draw(
    image,
    0,
    0,
    [
      '.......kk.......',
      '......kssk......',
      '.....kssssk.....',
      '....kkkkkkkk....',
      '.....kHHYYk.....',
      '.....kHYYYk.....',
      '.....kYYYOk.....',
      '.....kYYOOk.....',
      '....kkkkkkkk....',
      '......kssk......',
      '.......ks.......',
      '.......ks.......',
      '.......ks.......',
      '.....kkkskk.....',
      '.......ks.......',
      '.......ks.......',
      '.......ks.......',
      '.......ks.......',
      '.......kw.......',
      '.......ks.......',
      '.......ks.......',
      '.......ks.......',
      '.......ks.......',
      '.......kw.......',
      '.......ks.......',
      '......kkss......',
      '......kkss......',
      '.....kkksss.....',
      '....kkkkssss....',
      '....kkkkkkkk....',
      '................',
      '................',
    ],
    { ...IRON, H: INK.lampHot, Y: INK.lamp, O: INK.lampDeep },
  );
  return image;
}

/** A beach parasol, 2x2, striped in `colour` and white, on its pole in the sand. */
function parasol(colour) {
  const image = canvas(2 * TILE, 2 * TILE);
  const { c, d, l } = STRIPES[colour];
  const cx = 15.5;
  const cy = 12;
  for (let y = 2; y <= 13; y += 1) {
    for (let x = 1; x < 31; x += 1) {
      const nx = (x - cx) / 14.5;
      const ny = (y - cy) / 10;
      if (nx * nx + ny * ny > 1) continue;
      const edge = nx * nx + ny * ny > 0.82 || y === 13;
      const band = Math.floor((x + 1) / 5) % 2 === 0;
      const top = ny < -0.75;
      let ink = band ? c : INK.white;
      if (top) ink = band ? l : INK.white;
      if (y >= 11) ink = band ? d : INK.shade;
      set(image, x, y, hex(edge ? INK.outline : ink));
    }
  }
  // Scallops under the rim.
  for (let x = 3; x < 29; x += 5) draw(image, x, 14, ['kk'], { k: INK.outline });
  // The finial and the pole down into the sand.
  draw(image, 15, 0, ['kk', 'ks'], IRON);
  for (let y = 14; y < 29; y += 1) draw(image, 15, y, ['ks'], { k: INK.woodDark, s: INK.woodLight });
  draw(image, 13, 28, ['dddddd', '.dddd.'], { d: '#c8b080' });
  return image;
}

/** A deckchair, 1x1, its canvas striped in `colour`. */
function deckchair(colour) {
  const image = canvas(TILE, TILE);
  const { c, d } = STRIPES[colour];
  draw(
    image,
    0,
    0,
    [
      '................',
      '...oooooooooo...',
      '...wCWCWCWCWw...',
      '...wCWCWCWCWw...',
      '...wCWCWCWCWw...',
      '...wCWCWCWCWw...',
      '...wDWDWDWDWw...',
      '..owwwwwwwwwwo..',
      '..wCWCWCWCWCWw..',
      '..wCWCWCWCWCWw..',
      '..wDSDSDSDSDSw..',
      '..owwwwwwwwwwo..',
      '..o.o......o.o..',
      '..o.o......o.o..',
      '..o..........o..',
      '................',
    ],
    { o: INK.woodDark, w: INK.wood, C: c, D: d, W: INK.white, S: INK.shade },
  );
  return image;
}

/** A painted beach hut, 2x3: a pitched roof, boards striped in `colour`, and its door shut. */
function beachHut(colour) {
  const image = canvas(2 * TILE, 3 * TILE);
  const { c, d, l } = STRIPES[colour];
  // The roof, pitched from the ridge down to the eaves.
  for (let y = 2; y <= 15; y += 1) {
    const half = Math.min(15, 2 + (y - 2) * 1.1);
    for (let x = Math.round(16 - half); x < Math.round(16 + half); x += 1) {
      const edge = x === Math.round(16 - half) || x === Math.round(16 + half) - 1 || y === 15;
      const side = x < 16 ? l : c;
      set(image, x, y, hex(edge ? INK.outline : y % 3 === 0 ? d : side));
    }
  }
  // The gable's white trim and a little round window.
  draw(image, 13, 8, ['.ww.', 'wSSw', 'wSSw', '.ww.'], { w: INK.white, S: INK.sky });
  // The boards.
  for (let y = 16; y < 43; y += 1) {
    for (let x = 2; x < 30; x += 1) {
      const edge = x === 2 || x === 29 || y === 42;
      const band = Math.floor((x - 2) / 4) % 2 === 0;
      let ink = band ? c : INK.white;
      if (x >= 26) ink = band ? d : INK.shade;
      if (y === 16) ink = INK.outline;
      set(image, x, y, hex(edge ? INK.outline : ink));
    }
  }
  // The door, shut, with its knob, and the step in front of it.
  fill(image, 11, 24, 10, 18, INK.outline);
  fill(image, 12, 25, 8, 17, d);
  fill(image, 13, 26, 6, 15, c);
  draw(image, 17, 33, ['y'], { y: INK.gold });
  fill(image, 9, 43, 14, 2, INK.woodDark);
  fill(image, 10, 43, 12, 1, INK.wood);
  return image;
}

/** A run of promenade railing, 1x1: iron posts and two rails, joined to its neighbours. */
function railing() {
  const image = canvas(TILE, TILE);
  draw(
    image,
    0,
    0,
    [
      '................',
      '................',
      '................',
      '.kk.............',
      'wsswwwwwwwwwwwww',
      'kkkkkkkkkkkkkkkk',
      '.ks.............',
      '.ks.............',
      'wsswwwwwwwwwwwww',
      'kkkkkkkkkkkkkkkk',
      '.ks.............',
      '.ks.............',
      '.ks.............',
      'kkss............',
      '................',
      '................',
    ],
    IRON,
  );
  return image;
}

/** A lifebuoy on its post, 1x2, its ring quartered red and white. */
function lifebuoy() {
  const image = canvas(TILE, 2 * TILE);
  // The post, and the hook the ring hangs from.
  for (let y = 1; y < 27; y += 1) draw(image, 7, y, ['ks'], { k: INK.woodDark, s: INK.wood });
  draw(image, 5, 25, ['.kkss.', 'kkksss', 'kkkkkk'], { k: INK.woodDark, s: INK.wood });
  const cx = 7.5;
  const cy = 9.5;
  for (let y = 2; y < 18; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const r = Math.hypot(x - cx, y - cy);
      if (r > 6.4 || r < 2.6) continue;
      const edge = r > 5.5 || r < 3.4;
      const quarter = (x < cx) === (y < cy);
      const shade = y > cy + 2;
      const ink = edge ? INK.outline : quarter ? (shade ? '#a02028' : '#e04040') : shade ? INK.shade : INK.white;
      set(image, x, y, hex(ink));
    }
  }
  return image;
}

/** A pennant on a pole, 1x2, flying `colour`. */
function pennant(colour) {
  const image = canvas(TILE, 2 * TILE);
  const { c, d, l } = STRIPES[colour];
  draw(
    image,
    0,
    0,
    [
      '....yy..........',
      '....yy..........',
      '....kooooooooo..',
      '....kLLLLLLLo...',
      '....kCCCCCCo....',
      '....kCCCCCo.....',
      '....kCCCCo......',
      '....kDDDo.......',
      '....kDDo........',
      '....koo.........',
      '....ks..........',
      '....ks..........',
      '....ks..........',
      '....ks..........',
      '....ks..........',
      '....ks..........',
      '....ks..........',
      '....ks..........',
      '....ks..........',
      '....ks..........',
      '....ks..........',
      '....ks..........',
      '....ks..........',
      '....ks..........',
      '....ks..........',
      '...kkss.........',
      '..kkksss........',
      '..kkkkkk........',
      '................',
      '................',
      '................',
      '................',
    ],
    { ...IRON, y: INK.gold, o: INK.outline, C: c, D: d, L: l },
  );
  return image;
}

/** A stone trough of flowers, 2x1, planted `colour` and white. */
function trough(colour) {
  const image = canvas(2 * TILE, TILE);
  const { c, d, l } = STRIPES[colour];
  draw(
    image,
    0,
    0,
    [
      '................................',
      '...g.C.g..W.gC..g..C.W.g.C..g...',
      '..gCgLCggWWgCLCggCgLCgWgCLCgg...',
      '.ggCCDgggWgggCDgCCggDgggCDCggg..',
      '.gGggggGgggGgggGggggGgggGggGgg..',
      '.oooooooooooooooooooooooooooooo.',
      '.ollllllllllllllllllllllllllllo.',
      '.osssssssssssssssssssssssssssso.',
      '.osssssssssssssssssssssssssssso.',
      '.oddddddddddddddddddddddddddddo.',
      '.oddddddddddddddddddddddddddddo.',
      '..oooooooooooooooooooooooooooo..',
      '................................',
      '................................',
      '................................',
      '................................',
    ],
    {
      o: INK.outline,
      l: INK.stoneLight,
      s: INK.stone,
      d: INK.stoneDark,
      g: INK.leaf,
      G: INK.leafDark,
      C: c,
      D: d,
      L: l,
      W: INK.white,
    },
  );
  return image;
}

/** An ice-cream cart, 2x2: a striped sunshade over a white cart on two wheels. */
function iceCart() {
  const image = canvas(2 * TILE, 2 * TILE);
  const { c, d, l } = STRIPES.pink;
  // The sunshade.
  for (let y = 1; y <= 8; y += 1) {
    const half = Math.min(14, 6 + (y - 1) * 1.4);
    for (let x = Math.round(16 - half); x < Math.round(16 + half); x += 1) {
      const edge = x === Math.round(16 - half) || x === Math.round(16 + half) - 1 || y === 1 || y === 8;
      const band = Math.floor((x + 1) / 4) % 2 === 0;
      set(image, x, y, hex(edge ? INK.outline : band ? (y < 4 ? l : c) : INK.white));
    }
  }
  for (let x = 3; x < 29; x += 4) draw(image, x, 9, ['kk'], { k: d });
  // Its pole.
  for (let y = 9; y < 14; y += 1) draw(image, 15, y, ['ks'], IRON);
  // The cart: a white body with a pink band and three tubs of ice cream on top.
  draw(image, 7, 12, ['.CcW.CcW.CcW.CcW..'.slice(0, 18)], { C: '#f8a0c8', c: '#e8d090', W: '#a8d8a0' });
  fill(image, 5, 14, 22, 11, INK.outline);
  fill(image, 6, 15, 20, 9, INK.white);
  fill(image, 6, 15, 20, 1, INK.cream);
  fill(image, 6, 19, 20, 2, c);
  fill(image, 6, 23, 20, 1, INK.shade);
  // ICE on its side would be too small to read; a cone painted on it is not.
  draw(image, 14, 16, ['.pp.', 'pPPp', '.yy.', '.yy.'], { p: '#f8a0c8', P: '#f8d0e8', y: '#d8a050' });
  // Two wheels and a handle.
  draw(image, 7, 24, ['.kk.', 'kssk', 'kssk', '.kk.'], IRON);
  draw(image, 21, 24, ['.kk.', 'kssk', 'kssk', '.kk.'], IRON);
  draw(image, 26, 15, ['kk', '.k', '.k', '.k'], IRON);
  return image;
}

/**
 * THE GAME CORNER's POKéMON JUMP cabinet, 2x3: a marquee that says JUMP over a
 * screen with a vine swinging round a Pokémon, a panel with its one button,
 * and a cabinet painted Venusaur's green.
 */
function jumpCabinet() {
  const image = canvas(2 * TILE, 3 * TILE);
  const body = { o: INK.outline, b: '#3c9850', B: '#287038', l: '#70c880' };
  // The cabinet.
  fill(image, 3, 1, 26, 45, INK.outline);
  fill(image, 4, 2, 24, 43, body.b);
  fill(image, 4, 2, 3, 43, body.l);
  fill(image, 25, 2, 3, 43, body.B);
  // Its marquee: JUMP in lit letters.
  fill(image, 6, 3, 20, 9, INK.night);
  const word = lettering('JUMP', SMALL);
  word.forEach((row, dy) => {
    [...row].forEach((pixel, dx) => {
      if (pixel === '#') set(image, 8 + dx, 5 + dy, hex(dy === 0 ? INK.bulbHot : INK.bulb));
    });
  });
  // The screen: a vine round a jumper.
  fill(image, 6, 14, 20, 15, INK.outline);
  fill(image, 7, 15, 18, 13, INK.screen);
  for (let x = 7; x < 25; x += 1) {
    const t = (x - 16) / 9;
    const y = Math.round(25 - 9 * (1 - t * t));
    set(image, x, y, hex(INK.vine));
    set(image, x, y + 1, hex(INK.vineDark));
  }
  draw(image, 14, 21, ['.rr.', 'rRRr', 'rRRr', '.rr.'], { r: '#d06030', R: '#f89850' });
  fill(image, 7, 27, 18, 1, INK.screenLight);
  // The panel and its one button, which is all Pokémon Jump asks for.
  fill(image, 4, 30, 24, 5, INK.shade);
  fill(image, 4, 30, 24, 1, INK.white);
  draw(image, 14, 31, ['.rr.', 'rRRr', '.rr.'], { r: INK.redDark, R: '#f05050' });
  // The coin slot and the kick plate.
  draw(image, 15, 38, ['kk'], { k: INK.dark });
  fill(image, 4, 42, 24, 3, body.B);
  return image;
}


/**
 * THE GAME CORNER's BERRY PICKING cabinet, 2x3, beside the POKéMON JUMP one:
 * a marquee that says BERRY over a screen with FireRed's three berries -
 * blue, green and gold - falling to a three-headed bird, a panel with the
 * three ways it reaches, and a cabinet painted Dodrio's tan and brown.
 */
function berryCabinet() {
  const image = canvas(2 * TILE, 3 * TILE);
  const body = { b: '#c89060', B: '#906038', l: '#e8c090' };
  // The cabinet.
  fill(image, 3, 1, 26, 45, INK.outline);
  fill(image, 4, 2, 24, 43, body.b);
  fill(image, 4, 2, 3, 43, body.l);
  fill(image, 25, 2, 3, 43, body.B);
  // Its marquee: BERRY in lit letters.
  fill(image, 5, 3, 22, 9, INK.night);
  const word = lettering('BERRY', SMALL);
  word.forEach((row, dy) => {
    [...row].forEach((pixel, dx) => {
      if (pixel === '#') set(image, 6 + dx, 5 + dy, hex(dy === 0 ? INK.neonHot : INK.neon));
    });
  });
  // The screen: three berries falling in three columns over the bird's heads.
  fill(image, 6, 14, 20, 15, INK.outline);
  fill(image, 7, 15, 18, 13, '#184868');
  fill(image, 7, 15, 18, 3, '#287838');
  const berry = (x, y, c, l) => draw(image, x, y, ['.cc.', 'cllc', 'cccc', '.cc.'], { c, l });
  berry(8, 18, '#3870e0', '#90c0f8');
  berry(14, 20, '#38a848', '#a0e890');
  berry(20, 17, '#e0a818', '#f8e880');
  // Three heads at the foot, the middle one reaching up.
  draw(image, 9, 24, ['h.', 'hh', '.k'], { h: '#d8a868', k: '#202020' });
  draw(image, 15, 22, ['hh', 'hh', 'hk'], { h: '#d8a868', k: '#202020' });
  draw(image, 21, 24, ['.h', 'hh', 'k.'], { h: '#d8a868', k: '#202020' });
  fill(image, 7, 27, 18, 1, '#58a8d8');
  // The panel: left, up and right, which is all Berry Picking asks for.
  fill(image, 4, 30, 24, 5, INK.shade);
  fill(image, 4, 30, 24, 1, INK.white);
  draw(image, 8, 31, ['.r', 'rR', '.r'], { r: INK.redDark, R: '#f05050' });
  draw(image, 15, 31, ['.r.', 'rRr', '...'], { r: INK.redDark, R: '#f05050' });
  draw(image, 22, 31, ['r.', 'Rr', 'r.'], { r: INK.redDark, R: '#f05050' });
  // The coin slot and the kick plate.
  draw(image, 15, 38, ['kk'], { k: INK.dark });
  fill(image, 4, 42, 24, 3, body.B);
  return image;
}

/**
 * THE FIELD-MOVE COURSE's gate, 3x3: two timber posts under a board that says
 * COURSE in big green letters, the four field moves it asks for painted under
 * the word - a small tree, a cracked rock, a boulder and a wave - and bunting
 * strung between the posts over the way in.
 */
function courseGate() {
  const image = canvas(3 * TILE, 3 * TILE);
  const wood = { k: INK.woodDark, w: INK.wood, l: INK.woodLight };
  // The posts.
  for (const px of [3, 40]) {
    fill(image, px, 14, 5, 34, INK.outline);
    fill(image, px + 1, 15, 3, 32, INK.wood);
    fill(image, px + 1, 15, 1, 32, INK.woodLight);
    fill(image, px + 3, 15, 1, 32, INK.woodDark);
    fill(image, px, 45, 5, 2, INK.woodDark);
  }
  // The board.
  fill(image, 0, 1, 48, 22, INK.outline);
  fill(image, 1, 2, 46, 20, INK.woodDark);
  fill(image, 2, 3, 44, 18, INK.cream);
  fill(image, 2, 3, 44, 1, INK.white);
  fill(image, 2, 20, 44, 1, INK.shade);
  // COURSE in big letters, green as a course's grass.
  const letters = lettering('COURSE', BIG);
  const ox = Math.floor((48 - letters[0].length) / 2);
  letters.forEach((row, dy) => {
    [...row].forEach((pixel, dx) => {
      if (pixel !== '#') return;
      set(image, ox + dx, 5 + dy + 1, hex(INK.leafDark));
    });
  });
  letters.forEach((row, dy) => {
    [...row].forEach((pixel, dx) => {
      if (pixel === '#') set(image, ox + dx, 5 + dy, hex(dy === 0 ? INK.leafLight : INK.leaf));
    });
  });
  // The four moves, under the word: a tree to CUT, a rock to SMASH, a boulder
  // for STRENGTH and a wave to SURF.
  draw(image, 5, 13, ['.gg.', 'gGGg', '.gg.', '.tt.', '.tt.'], { g: INK.leafDark, G: INK.leaf, t: INK.woodDark });
  draw(image, 16, 14, ['.ss.', 'sSxs', 'sxSs', 'ssss'], { s: INK.stoneDark, S: INK.stoneLight, x: INK.dark });
  draw(image, 27, 13, ['.bb.', 'bBBb', 'bBbb', 'bbbb', '.bb.'], { b: '#805830', B: '#c09060' });
  draw(image, 37, 14, ['.ww...', 'wWWw.w', '....ww', 'wwwwww'], { w: '#3878d8', W: '#88c0f8' });
  // Bunting over the way in, between the posts.
  const flags = ['#e04040', '#f8c030', '#4078e0', '#40b060', '#f070b0'];
  for (let x = 8; x < 40; x += 1) set(image, x, 25 + Math.round(Math.sin(((x - 8) / 31) * Math.PI) * 2), hex(INK.dark));
  for (let index = 0; index < 5; index += 1) {
    const fx = 10 + index * 6;
    const fy = 26 + Math.round(Math.sin(((fx - 8) / 31) * Math.PI) * 2);
    draw(image, fx, fy, ['fff', '.f.'], { f: flags[index] });
  }
  void wood;
  return image;
}

/**
 * THE FIELD-MOVE COURSE's TIMES board, 1x2: a chalk board on two legs, a
 * stopwatch chalked at its top and three lines of times under it - the board a player reads
 * the day's times off, as FireRed's Trainer Tower posts its Time Attack.
 */
function timeBoard() {
  const image = canvas(TILE, 2 * TILE);
  // The legs.
  fill(image, 3, 18, 2, 13, INK.woodDark);
  fill(image, 11, 18, 2, 13, INK.woodDark);
  fill(image, 3, 18, 1, 13, INK.wood);
  fill(image, 11, 18, 1, 13, INK.wood);
  // The board, framed.
  fill(image, 0, 2, 16, 18, INK.outline);
  fill(image, 1, 3, 14, 16, INK.wood);
  fill(image, 2, 4, 12, 15, '#285040');
  fill(image, 2, 4, 12, 1, '#386858');
  // A stopwatch in chalk: the board is too narrow for a word, and a clock face says it.
  draw(
    image,
    4,
    4,
    ['..ww....', '.wwww...', 'w....w..', 'w..w.w..', 'w.ww.w..', 'w....w..', '.wwww...'],
    { w: INK.white },
  );
  draw(image, 10, 6, ['ww', 'w.', 'ww'], { w: INK.shade });
  // Chalk times.
  for (const [y, length] of [[13, 9], [15, 7], [17, 8]]) {
    for (let x = 4; x < 4 + length; x += 1) if (x % 3 !== 0) set(image, x, y, hex(INK.shade));
  }
  return image;
}

// --- The sheet -----------------------------------------------------------

/**
 * Where each piece is drawn on the sheet, in tiles. `promenadeSheet.ts` says
 * the same thing, and `promenadeSheet.test.ts` reads every one back.
 */
const LAYOUT = [
  ['gameCorner', 0, 0, (towns) => SIGNS.gameCorner(towns)],
  ['lamp', 10, 0, lamp],
  ['lifebuoy', 11, 0, lifebuoy],
  ['pennantRed', 12, 0, () => pennant('red')],
  ['pennantBlue', 13, 0, () => pennant('blue')],
  ['pennantYellow', 14, 0, () => pennant('yellow')],
  ['pennantGreen', 15, 0, () => pennant('green')],
  ['parasolRed', 10, 2, () => parasol('red')],
  ['parasolBlue', 12, 2, () => parasol('blue')],
  ['parasolYellow', 14, 2, () => parasol('yellow')],
  ['iceCart', 10, 4, iceCart],
  ['jumpCabinet', 12, 4, jumpCabinet],
  ['railing', 14, 4, railing],
  ['deckchairRed', 15, 4, () => deckchair('red')],
  ['deckchairBlue', 14, 5, () => deckchair('blue')],
  ['deckchairYellow', 15, 5, () => deckchair('yellow')],
  ['hutRed', 0, 6, () => beachHut('red')],
  ['hutBlue', 2, 6, () => beachHut('blue')],
  ['hutYellow', 4, 6, () => beachHut('yellow')],
  ['hutGreen', 6, 6, () => beachHut('green')],
  ['hutPink', 8, 6, () => beachHut('pink')],
  ['hutTeal', 10, 6, () => beachHut('teal')],
  ['troughPink', 12, 7, () => trough('pink')],
  ['troughYellow', 14, 7, () => trough('yellow')],
  ['troughRed', 12, 8, () => trough('red')],
  ['troughBlue', 14, 8, () => trough('blue')],
  ['berryCabinet', 0, 9, berryCabinet],
  ['courseGate', 2, 9, courseGate],
  ['timeBoard', 5, 9, timeBoard],
];

const towns = readPng(new URL('public/assets/frlg-towns.png', ROOT).pathname);
const sheet = canvas(SHEET_COLUMNS * TILE, SHEET_ROWS * TILE);
for (const [, column, row, paint] of LAYOUT) {
  const image = paint(towns);
  copy(image, 0, 0, image.width, image.height, sheet, column * TILE, row * TILE);
}

const out = new URL('public/assets/promenade.png', ROOT).pathname;
writePng(out, sheet);
console.log(`wrote ${out} (${sheet.width}x${sheet.height})`);
