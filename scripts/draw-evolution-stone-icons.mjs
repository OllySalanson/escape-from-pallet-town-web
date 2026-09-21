// Draws the evolution-stone icons into public/assets/icons.
//
//   node scripts/draw-evolution-stone-icons.mjs
//
// 16x16 RGBA on the set's own rules (see ASSET_PROVENANCE.md): the shared
// outline #241f2e and a shade/base/light triple for the hue. The stone is a cut
// gem lit from the top left with its emblem cut out of it in the outline
// colour, so the shape reads at 16px without a second hue in it.
//
// Five stones ship. The Thunder Stone is hand-drawn, row by row, and is left
// exactly as it was; the other four are the same cut gem in their own hue with
// their own mark carved through it in the outline colour, which is what a
// player reads at 3x on the ground - a flame, a drop, a leaf and a crescent.
// The gem and the marks are written as character art here for the same reason a
// map is: a grid of numbers cannot be looked at.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const SIZE = 16;
const OUT = new URL('../public/assets/icons/', import.meta.url);

const hex = (value) => [
  parseInt(value.slice(0, 2), 16),
  parseInt(value.slice(2, 4), 16),
  parseInt(value.slice(4, 6), 16),
  255,
];
const C = {
  o: hex('241f2e'),
  // electric yellow, picked to stand beside the set's red and blue triples
  s: hex('b0781c'), b: hex('f0b830'), l: hex('ffe078'),
};

/**
 * A hue triple per stone: shade, base, light. Each is picked to be told apart
 * from the other four *and* from the icons already in the set - the Potion's
 * red, the Great Ball's blue and the scrip's paper - because a stone is drawn
 * on the ground at 16px and the hue is the whole of what says which one it is.
 */
const HUES = {
  'fire-stone': { s: 'a02c14', b: 'ec5a24', l: 'ffa864' },
  'water-stone': { s: '14548c', b: '2c94dc', l: '84d8f8' },
  'leaf-stone': { s: '1c7434', b: '44b848', l: '9ce87c' },
  'moon-stone': { s: '443c6c', b: '7c74ac', l: 'c4bce4' },
};

const fromRows = (rows) => {
  if (rows.length !== SIZE) throw new Error(`expected ${SIZE} rows, got ${rows.length}`);
  return rows.map((row, y) => {
    if (row.length !== SIZE) throw new Error(`row ${y} is ${row.length} wide: "${row}"`);
    return [...row].map((ch) => {
      if (ch === '.') return null;
      if (!C[ch]) throw new Error(`no colour "${ch}"`);
      return ch;
    });
  });
};

const icons = {};

/**
 * The cut gem every stone is, lit from the top left. `l`, `b` and `s` are the
 * hue's three tones and `o` is the shared outline; a mark below carves its own
 * pixels back to `o`, so the shape shows as a cut through the stone rather than
 * as a second colour in it.
 */
const GEM = [
  '................',
  '................',
  '....oooooooo....',
  '...ollllbbbbo...',
  '..olllllbbbbbo..',
  '..olllllbbbbbo..',
  '..ollllbbbbbbo..',
  '..olllbbbbbsso..',
  '..ollbbbbbssso..',
  '...obbbbbssso...',
  '...obbbbsssso...',
  '....obbbssso....',
  '.....obssso.....',
  '......oooo......',
  '................',
  '................',
];

/**
 * The mark cut through each stone: `#` is carved back to the outline colour and
 * `=` back to the hue's light tone, which is the leaf's midrib and the only
 * place a mark needs two tones.
 *
 * Every mark is a solid silhouette rather than an outline, because the Thunder
 * Stone's bolt is solid and it is the one of the five that was looked at on the
 * ground before it shipped. Drawn as outlines first, the flame and the drop
 * came out as the same ring and the leaf came out as a cross.
 */
const MARKS = {
  // A flame: a teardrop with its point up.
  'fire-stone': [
    '................',
    '................',
    '................',
    '................',
    '........#.......',
    '.......###......',
    '.......###......',
    '......#####.....',
    '......#####.....',
    '.......###......',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  // The same teardrop, point down: a drop of water.
  'water-stone': [
    '................',
    '................',
    '................',
    '................',
    '.......###......',
    '......#####.....',
    '......#####.....',
    '.......###......',
    '.......###......',
    '........#.......',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  // A leaf lying up the stone's own diagonal, with its midrib lit.
  'leaf-stone': [
    '................',
    '................',
    '................',
    '................',
    '..........##....',
    '........##=#....',
    '.......#=##.....',
    '......#=##......',
    '.....#=##.......',
    '.....##.........',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  // A crescent, which is the one mark nobody reads as anything else.
  'moon-stone': [
    '................',
    '................',
    '................',
    '................',
    '.......####.....',
    '......##........',
    '......#.........',
    '......#.........',
    '......##........',
    '.......####.....',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
};

/** The gem in one hue with one mark cut through it. */
const stone = (mark) =>
  GEM.map((row, y) =>
    [...row]
      .map((ch, x) => {
        if (ch === '.') return ch;
        if (mark[y][x] === '#') return 'o';
        if (mark[y][x] === '=') return 'l';
        return ch;
      })
      .join(''),
  );

// A cut stone with a bolt struck through it.
icons['thunder-stone'] = fromRows([
  '................',
  '................',
  '....oooooooo....',
  '...olllllbbbo...',
  '..olllllboobbo..',
  '..ollllboobbbo..',
  '..olllboobbbbo..',
  '..ollboooobbso..',
  '..olbbboobbsso..',
  '...obboobbsso...',
  '...oboobbssso...',
  '....obbbssso....',
  '.....obssso.....',
  '......oooo......',
  '................',
  '................',
]);

for (const [name, mark] of Object.entries(MARKS)) {
  icons[name] = fromRows(stone(mark));
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buffer) => {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
};
const png = (grid, palette = C) => {
  const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
  grid.forEach((row, y) => {
    const base = y * (SIZE * 4 + 1);
    raw[base] = 0;
    row.forEach((key, x) => {
      const [r, g, b, a] = key ? palette[key] : [0, 0, 0, 0];
      raw.set([r, g, b, a], base + 1 + x * 4);
    });
  });
  const header = Buffer.alloc(13);
  header.writeUInt32BE(SIZE, 0);
  header.writeUInt32BE(SIZE, 4);
  header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

const paletteFor = (name) => {
  const hue = HUES[name];
  return hue ? { o: C.o, s: hex(hue.s), b: hex(hue.b), l: hex(hue.l) } : C;
};

for (const [name, grid] of Object.entries(icons)) {
  writeFileSync(new URL(`${name}.png`, OUT), png(grid, paletteFor(name)));
  console.log(`icons/${name}.png`);
}
