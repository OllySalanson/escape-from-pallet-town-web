// Draws the jump-in card's icons into public/assets/icons: the raid clock, the
// three skies a raid can jump under, and the padlock that marks what a wipe
// cannot take.
//
//   node scripts/draw-briefing-icons.mjs
//
// Same rules as the rest of the set (see ASSET_PROVENANCE.md): 16x16 RGBA, one
// shared outline (#241f2e) and a shade/base/light triple per hue. Written as
// character art so a shape can be nudged a pixel without redrawing it, and so
// the output is byte-stable.
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
  // silver, for the stopwatch's case and the padlock's shackle
  n: hex('8d8671'), N: hex('c9c1ad'), l: hex('f4efe2'),
  // the stopwatch's face
  f: hex('fff6c8'),
  // the sun's gold, as the Thunder Stone's (`draw-evolution-stone-icons.mjs`)
  v: hex('b0781c'), A: hex('f0b830'), u: hex('ffe078'),
  // the low sun's orange
  q: hex('c06a30'), O: hex('f0a02e'), Y: hex('ffd070'),
  // the sea it sets into
  z: hex('317ba4'), k: hex('73a4c5'),
  // the moon's pale gold
  m: hex('c9a64a'), M: hex('f4e08a'), L: hex('fff6c8'),
  // the padlock's brass
  b: hex('a85e14'), B: hex('f0a02e'), c: hex('f8d878'),
};

const blank = () => Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
const fromRows = (rows) => {
  const grid = blank();
  if (rows.length !== SIZE) throw new Error(`expected ${SIZE} rows, got ${rows.length}`);
  rows.forEach((row, y) => {
    if (row.length !== SIZE) throw new Error(`row ${y} is ${row.length} wide: "${row}"`);
    [...row].forEach((ch, x) => {
      if (ch !== '.') {
        if (!C[ch]) throw new Error(`no colour "${ch}"`);
        grid[y][x] = ch;
      }
    });
  });
  return grid;
};
/** Fills a shape, then outlines every empty pixel that touches it. */
const outline = (grid) => {
  const edge = [];
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      if (grid[y][x] !== null) continue;
      const touches = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(
        ([dx, dy]) => grid[y + dy]?.[x + dx] != null && grid[y + dy][x + dx] !== 'o',
      );
      if (touches) edge.push([x, y]);
    }
  }
  edge.forEach(([x, y]) => {
    if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) grid[y][x] = 'o';
  });
  return grid;
};

const icons = {};

// The raid clock: a stopwatch, its crown up and its hands at a quarter past -
// the one clock shape that says "against the clock" rather than "the time".
icons['raid-clock'] = outline(
  fromRows([
    '................',
    '......NllN......',
    '.......NN.......',
    '......llNN......',
    '....llffffNN....',
    '...lfffoffffN...',
    '...NfffoffffN...',
    '..NffffofffffN..',
    '..NffffooooffN..',
    '..NffffffffffN..',
    '..NffffffffffN..',
    '...NffffffffN...',
    '...NffffffffN...',
    '....NNffffnn....',
    '......nnnn......',
    '................',
  ]),
);

// The day: a sun with eight rays.
icons['sky-day'] = outline(
  fromRows([
    '................',
    '.......AA.......',
    '.......AA.......',
    '...A........A...',
    '......uuAA......',
    '.....uuAAAA.....',
    '....uAAAAAAA....',
    '.AA.uAAAAAAA.AA.',
    '.AA.AAAAAAAv.AA.',
    '....AAAAAAvv....',
    '.....AAAAvv.....',
    '......Avvv......',
    '...A........A...',
    '.......AA.......',
    '.......AA.......',
    '................',
  ]),
);

// Dusk: the sun half down into the sea.
icons['sky-dusk'] = outline(
  fromRows([
    '................',
    '................',
    '.......OO.......',
    '..O....OO....O..',
    '................',
    '.O....YYOO....O.',
    '....YYOOOOqq....',
    '...YOOOOOOOOq...',
    '..YOOOOOOOOOOq..',
    '..OOOOOOOOOOOq..',
    '................',
    'zzzzzzzzzzzzzzzz',
    'zkkkzzzzzzzkkkzz',
    '................',
    '..kkkk....kkkk..',
    '................',
  ]),
);

// Night: a crescent moon.
icons['sky-night'] = outline(
  fromRows([
    '................',
    '................',
    '......L.........',
    '....LLM.........',
    '...LMM..........',
    '..LMMM..........',
    '..LMMM..........',
    '..LMMM..........',
    '..LMMMM.........',
    '..LMMMMm........',
    '...MMMMMMmm.....',
    '....MMMMMMMMmm..',
    '.....mMMMMMMm...',
    '.......mmmm.....',
    '................',
    '................',
  ]),
);

// Safe: a padlock, shut. What it stands beside, a wipe cannot take.
icons['padlock'] = outline(
  fromRows([
    '................',
    '......llll......',
    '.....NN..NN.....',
    '....NN....NN....',
    '....NN....NN....',
    '....Nn....Nn....',
    '...cccccccccc...',
    '...cBBBBBBBBb...',
    '...cBBBooBBBb...',
    '...cBBBooBBBb...',
    '...cBBBooBBBb...',
    '...cBBBBBBBBb...',
    '...bbbbbbbbbb...',
    '................',
    '................',
    '................',
  ]),
);

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
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
};
const png = (grid) => {
  const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
  grid.forEach((row, y) => {
    const base = y * (SIZE * 4 + 1);
    raw[base] = 0;
    row.forEach((key, x) => {
      const [r, g, b, a] = key ? C[key] : [0, 0, 0, 0];
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

for (const [name, grid] of Object.entries(icons)) {
  writeFileSync(new URL(`${name}.png`, OUT), png(grid));
  console.log(`icons/${name}.png`);
}
