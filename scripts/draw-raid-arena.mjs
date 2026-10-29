// Draws THE RAID ARENA's own front onto `public/assets/raid-arena.png`.
//
//   node scripts/draw-raid-arena.mjs
//
// The Arena used to be Saffron's Gym exactly as FireRed draws it, GYM plate
// and all. It is still that building - the walls, the windows and the door are
// FireRed's own, read out of the committed cut (`public/assets/frlg-towns.png`,
// `TOWN_PIECES.saffronGym`, made by `scripts/cut-frlg-towns.mjs`) - with the
// things that say what it is for drawn onto it here, in FireRed's palette:
//
// - the GYM plate reads RAID, two rows taller so the letters are whole;
// - a gold-rimmed badge on the other side of the door reads ARENA;
// - the emblem over the door is red, and the door glass is lit from inside;
// - a lantern either side of the door, a flag on each end of the roof and a
//   Poke Ball painted on it, as an arena paints its floor;
// - FireRed's Gym statues with a Poke Ball on their plinths where they said GYM;
// - the CC0 banners on the forecourt (ArMM1998's `Overworld.png`) dyed the
//   Arena's red, with a Poke Ball where their emblem was;
// - a red runner from the door down the forecourt, between the statues.
//
// The cut is read whole and only the pixels named below change, so a re-cut of
// the Gym moves the Arena with it. Saffron's cut lifted the Gym's wall as
// ground (its paving is the wall's colour), so the wall is put back here: a
// lifted pixel keeps its colour and is made solid again, which is FireRed's
// own wall rather than whatever ground the Arena stands on.
//
// Nothing here is taken from anywhere else; `public/assets/ASSET_PROVENANCE.md`
// records it. The layout of the sheet is `src/game/base/raidArenaSheet.ts`.
import { readFileSync } from 'node:fs';
import { readPng, writePng } from '../tools/tileset/tileSheet.mjs';

const ROOT = new URL('../', import.meta.url);
const TILE = 16;
const SHEET_COLUMNS = 10;
const SHEET_ROWS = 5;
/** The first row under the Gym's wall: the step and Saffron's ground. */
const WALL_FOOT = 72;

const hex = (value) => [
  parseInt(value.slice(1, 3), 16),
  parseInt(value.slice(3, 5), 16),
  parseInt(value.slice(5, 7), 16),
  255,
];

// FireRed's own colours wherever the Gym already has one, and every new one a
// 15-bit value (a multiple of eight), as the GBA draws them.
const INK = {
  // The Gym's own.
  outline: '#404868',
  frame: '#585870',
  trim: '#787880',
  seam: '#a8b8c8',
  shade: '#c8d8e8',
  white: '#f0f0f8',
  red: '#c85048',
  redDark: '#a82028',
  redLight: '#d86860',
  // The badge's gold and the Arena's red.
  gold: '#f8c840',
  goldLight: '#f8e890',
  goldDark: '#b07818',
  crimson: '#d03030',
  crimsonDark: '#901818',
  crimsonLight: '#f05848',
  // Lantern light.
  lamp: '#f8d058',
  lampHot: '#fff8c8',
  lampDeep: '#e09030',
  // Flag poles.
  pole: '#585870',
  poleLight: '#b8c0d0',
  // The runner's edge.
  runnerEdge: '#e8b030',
};

const canvas = (width, height) => ({ width, height, data: Buffer.alloc(width * height * 4) });

/** A colour as FireRed's tables write it. */
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

/**
 * Draws character art at (x, y): one character a pixel, `.` left alone, every
 * other character a colour from `key`.
 */
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

/** Where a named piece sits on the town sheet, read from the module the cut writes. */
function townPiece(name) {
  const source = readFileSync(new URL('src/game/world/generated/townPieces.ts', ROOT), 'utf8');
  const match = new RegExp(`\\b${name}: \\{\\s*column: (\\d+),\\s*row: (\\d+),\\s*width: (\\d+),\\s*height: (\\d+)`).exec(
    source,
  );
  if (!match) throw new Error(`no town piece '${name}'`);
  const [, column, row, width, height] = match.map(Number);
  return { column, row, width, height };
}

// --- Lettering -----------------------------------------------------------

/**
 * A three-by-five capital for each letter the Arena says. FireRed's own GYM is
 * three pixels tall, which is a word only because everybody knows it; a word
 * nobody has seen before needs five.
 */
const FONT = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  N: ['#.#', '###', '###', '#.#', '#.#'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
};

/** A word as five rows of `#` and `.`, a column apart. */
function lettering(word) {
  return [0, 1, 2, 3, 4].map((row) =>
    [...word].map((letter) => {
      const glyph = FONT[letter];
      if (!glyph) throw new Error(`no glyph for '${letter}'`);
      return glyph[row];
    }).join('.'),
  );
}

/** A FireRed plate round a word: a frame with clipped corners, a lit top row and a shaded bottom one. */
function plate(word, { edge, light, field, ink, foot, margin }) {
  const width = word[0].length + 2 * margin + 2;
  const inner = width - 2;
  const pad = field.repeat(margin);
  const lines = word.map(
    (row, index) =>
      edge +
      pad +
      [...row].map((pixel) => (pixel === '#' ? (index === word.length - 1 ? foot : ink) : field)).join('') +
      pad +
      edge,
  );
  return [
    '.' + edge.repeat(inner) + '.',
    edge + light.repeat(inner) + edge,
    ...lines,
    edge + light.repeat(inner) + edge,
    '.' + edge.repeat(inner) + '.',
  ];
}

/**
 * A Gym badge round a word: pointed at both ends, a light gold bevel above and
 * a dark one below, white letters on red.
 */
function badge(word) {
  const span = word[0].length + 4;
  const rows = [
    '...' + 'o'.repeat(span + 2) + '...',
    '..o' + 'G'.repeat(span + 2) + 'o..',
    '.oG' + 'g' + 'c'.repeat(span) + 'd' + 'do.',
    ...word.map((row) => 'oGg' + 'cc' + [...row].map((pixel) => (pixel === '#' ? 'w' : 'c')).join('') + 'cc' + 'gdo'),
    '.oG' + 'g' + 'c'.repeat(span) + 'd' + 'do.',
    '..o' + 'd'.repeat(span + 2) + 'o..',
    '...' + 'o'.repeat(span + 2) + '...',
  ];
  return rows;
}

// --- The building --------------------------------------------------------

function arena(towns) {
  const gym = townPiece('saffronGym');
  if (gym.width !== 7 || gym.height !== 5) throw new Error('the Gym is no longer 7x5: redraw the Arena');
  const image = canvas(gym.width * TILE, gym.height * TILE);
  copy(towns, gym.column * TILE, gym.row * TILE, image.width, image.height, image, 0, 0);

  // Put the wall back. The cut lifted every pixel the colour of Saffron's
  // paving, which is the colour of the Gym's wall and its trim; a lifted pixel
  // kept its colour, so only those two are made solid again, and only down to
  // the foot of the wall - below it the lifted pixels really are Saffron's
  // ground, round the step.
  const lifted = new Set(['#a8b8c8', '#787880']);
  for (let y = 0; y < WALL_FOOT; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const [r, g, b, a] = get(image, x, y);
      if (a === 0 && lifted.has(name([r, g, b]))) set(image, x, y, [r, g, b, 255]);
    }
  }

  // The roof's first row is the lawn behind the Gym, which FireRed drew into
  // it. Left as it is: the Arena backs onto the same lawn.

  const wall = get(image, 8, 57);

  // RAID, where the plate said GYM: the same white plate in the same frame,
  // three rows taller so each letter is five pixels rather than three, its
  // bottom row in the darker red FireRed shades the GYM letters' feet with.
  const raid = lettering('RAID');
  draw(image, 16, 56, plate(raid, { edge: 't', light: 's', field: 'w', ink: 'r', foot: 'd', margin: 2 }), {
    t: INK.trim,
    s: INK.shade,
    w: INK.white,
    r: INK.red,
    d: INK.redDark,
  });

  // ARENA, on a badge on the other side of the door where four small windows
  // were: a gold rim round a red field, pointed at both ends like the badges a
  // Gym hands out. The windows go first, back to plain wall.
  for (let y = 60; y < 64; y += 1) {
    for (let x = 72; x < 105; x += 1) {
      const [r, g, b] = get(image, x, y);
      const glass = ['#60a0d8', '#4880c0', '#98d0f8', '#787880', '#90a0b0'].includes(name([r, g, b]));
      if (glass) set(image, x, y, x % 8 === 7 ? hex(INK.seam) : wall);
    }
  }
  draw(image, 75, 56, badge(lettering('ARENA')), {
    o: INK.outline,
    G: INK.goldLight,
    g: INK.gold,
    d: INK.goldDark,
    c: INK.crimson,
    w: INK.white,
  });

  // The emblem over the door, in the Arena's red: FireRed's Poke Ball on it is
  // left as it is.
  recolour(image, 41, 49, 30, 15, {
    '#c0a868': INK.crimson,
    '#a89048': INK.crimsonDark,
    '#e0d8a0': INK.crimsonLight,
    '#d0c080': INK.crimsonLight,
  });

  // The door lit from inside: its glass warm rather than sky.
  recolour(image, 48, 64, 16, 14, {
    '#4880c0': INK.lampDeep,
    '#60a0d8': INK.lamp,
    '#98d0f8': INK.lampHot,
  });

  // A lantern either side of the door, on a bracket off the frame.
  const lantern = ['.oo.', 'oHLo', 'oLLo', 'oDDo', '.oo.'];
  const lanternKey = { o: INK.outline, H: INK.lampHot, L: INK.lamp, D: INK.lampDeep };
  draw(image, 38, 64, lantern, lanternKey);
  draw(image, 70, 64, lantern, lanternKey);

  // A crest painted on the roof, as an arena paints its floor: FireRed's Poke
  // Ball, red over white, laid flat - so foreshortened half again as wide as
  // it is deep - over the corrugation, which shows through it.
  const crest = { x: 56, y: 24, rx: 17, ry: 10 };
  for (let y = crest.y - crest.ry; y <= crest.y + crest.ry; y += 1) {
    for (let x = crest.x - crest.rx; x <= crest.x + crest.rx; x += 1) {
      const dx = (x - crest.x + 0.5) / crest.rx;
      const dy = (y - crest.y + 0.5) / crest.ry;
      const r = Math.hypot(dx, dy);
      if (r > 1) continue;
      const [cr, cg, cb] = get(image, x, y);
      const ridge = name([cr, cg, cb]) === '#a89048';
      const inner = Math.hypot((x - crest.x + 0.5) / 5, (y - crest.y + 0.5) / 3);
      let ink;
      if (r > 0.86) ink = INK.outline;
      else if (inner <= 1) ink = inner > 0.62 ? INK.outline : INK.white;
      else if (Math.abs(y - crest.y + 0.5) <= 1.5) ink = INK.outline;
      else if (y < crest.y) ink = ridge ? INK.crimsonDark : INK.crimson;
      else ink = ridge ? INK.shade : INK.white;
      set(image, x, y, hex(ink));
    }
  }

  // A flag on each end of the roof, on a pole stood on the eave, both flying
  // the same way.
  const flag = [
    '.YY.............',
    'YgGY............',
    '.YYoooooooooooo.',
    '.PpoRRRRRRRRRRo.',
    '.PpoRWWWRRRRRRRo',
    '.PpoWWkWWrrrrrRo',
    '.PpoRWWWRrrrrrro',
    '.Ppoddddddddddo.',
    '.Ppooooooooooo..',
  ];
  const flagKey = {
    Y: INK.goldDark,
    g: INK.gold,
    G: INK.goldLight,
    o: '#581820',
    k: INK.outline,
    P: INK.pole,
    p: INK.poleLight,
    R: INK.crimsonLight,
    r: INK.crimson,
    W: INK.white,
    d: INK.crimsonDark,
  };
  for (const x of [7, 89]) {
    draw(image, x, 10, flag, flagKey);
    for (let y = 10 + flag.length; y < 42; y += 1) draw(image, x, y, ['.Pp.'], flagKey);
    draw(image, x, 42, ['kPpk'], flagKey);
  }
  return image;
}

// --- The forecourt -------------------------------------------------------

/** ArMM1998's two banners on their poles, dyed the Arena's red. */
function banners(overworld) {
  const image = canvas(2 * TILE, 2 * TILE);
  copy(overworld, 5 * TILE, 27 * TILE, image.width, image.height, image, 0, 0);
  recolour(image, 0, 0, image.width, image.height, {
    '#462b5e': '#581820',
    '#404077': INK.crimsonDark,
    '#5d5da3': INK.crimson,
  });
  // The emblem in gold rather than white, so the pair reads as the Arena's
  // colours and not as somebody's laundry.
  recolour(image, 0, 0, image.width, image.height, {
    '#d7ddde': INK.gold,
    '#d7dedf': INK.gold,
    '#d8dedf': INK.goldLight,
  });
  return image;
}

/**
 * FireRed's Gym statue with a Poke Ball on its plinth where it said GYM. The
 * plate is three pixels tall and eleven wide: GYM fits because everybody
 * knows the word, and RAID in it read as RAIC, so the plinth carries the
 * Arena's mark and the building says the word.
 */
function statue(towns) {
  const piece = townPiece('gymStatue');
  const image = canvas(TILE, 2 * TILE);
  copy(towns, piece.column * TILE, piece.row * TILE, image.width, image.height, image, 0, 0);
  for (let y = 21; y < 24; y += 1) {
    for (let x = 2; x < 13; x += 1) set(image, x, y, hex('#c0c0d0'));
  }
  draw(image, 5, 21, ['oRRRo', 'kkWkk', 'oWWWo'], {
    o: '#484858',
    k: '#484858',
    R: '#e06848',
    W: '#f8f8f8',
  });
  return image;
}

/** The runner from the door: its head, a length of it, and its fringed foot. */
function runner() {
  const image = canvas(TILE, 3 * TILE);
  const edge = (y) => {
    draw(image, 1, y, ['eGrrrrrrrrrrrrGe'.slice(0, 14)], {
      e: INK.crimsonDark,
      G: INK.runnerEdge,
      r: INK.crimson,
    });
  };
  for (let y = 0; y < 3 * TILE; y += 1) edge(y);
  // A lighter weave down its middle, so a length of it is not a flat block.
  for (let y = 0; y < 3 * TILE; y += 4) {
    draw(image, 7, y, ['LL'], { L: INK.crimsonLight });
  }
  // The head runs under the door's step; the foot ends in a gold fringe.
  draw(image, 1, 2 * TILE + 12, ['dddddddddddddd', 'g.g.g.g.g.g.g.', '.g.g.g.g.g.g.g'], {
    d: INK.crimsonDark,
    g: INK.runnerEdge,
  });
  for (let y = 2 * TILE + 15; y < 3 * TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) set(image, x, y, [0, 0, 0, 0]);
  }
  return image;
}

const towns = readPng(new URL('public/assets/frlg-towns.png', ROOT).pathname);
const overworld = readPng(new URL('public/assets/Overworld.png', ROOT).pathname);
const sheet = canvas(SHEET_COLUMNS * TILE, SHEET_ROWS * TILE);
const building = arena(towns);
copy(building, 0, 0, building.width, building.height, sheet, 0, 0);
const flags = banners(overworld);
copy(flags, 0, 0, flags.width, flags.height, sheet, 7 * TILE, 0);
const plinth = statue(towns);
copy(plinth, 0, 0, plinth.width, plinth.height, sheet, 7 * TILE, 2 * TILE);
const carpet = runner();
copy(carpet, 0, 0, carpet.width, carpet.height, sheet, 9 * TILE, 0);

const out = new URL('public/assets/raid-arena.png', ROOT).pathname;
writePng(out, sheet);
console.log(`wrote ${out} (${sheet.width}x${sheet.height})`);
