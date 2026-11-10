// Draws the drowned bell's rope into public/assets/icons.
//
//   node scripts/draw-bell-rope-icon.mjs
//
// THE DROWNED BELL (`src/game/world/secrets.ts`) is a `summons` nook: a sign
// the raid draws as this rather than as a signpost. The drowned church's bell
// rope comes up out of the sea and is tied off to an iron bollard at the edge
// of Market Street: the bollard, a coil of pale hemp round its neck, and the
// rope running off the foot of the tile into the water below it.
//
// 16x16 RGBA, the same shared outline (#241f2e) as the rest of the set - see
// ASSET_PROVENANCE.md.
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
  o: hex('241f2e'), // the set's one outline
  K: hex('4a4f5c'), // wet iron
  k: hex('8a93a6'), // iron catching the light
  r: hex('d9a75e'), // the bell rope, tarred hemp gone pale
  R: hex('a0743c'), // its shade
};

const rows = [
  '................',
  '................',
  '......oooo......',
  '.....okkKKo.....',
  '.....oKKKKo.....',
  '......oKKo......',
  '.....orrrro.....',
  '.....oRrrRo.....',
  '.....orRRro.....',
  '.....okKKKo.....',
  '.....okKKKo.....',
  '.....okKKKo.....',
  '....ookKKKoo....',
  '....oooorroo....',
  '........orRo....',
  '.........orRo...',
];

const grid = rows.map((row, y) => {
  if (row.length !== SIZE) {
    throw new Error(`row ${y} is ${row.length} wide: "${row}"`);
  }
  return [...row].map((ch) => {
    if (ch === '.') {
      return null;
    }
    if (!C[ch]) {
      throw new Error(`no colour "${ch}"`);
    }
    return ch;
  });
});
if (grid.length !== SIZE) {
  throw new Error(`expected ${SIZE} rows, got ${grid.length}`);
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
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
};
const png = (pixels) => {
  const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
  pixels.forEach((row, y) => {
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

writeFileSync(new URL('bell-rope.png', OUT), png(grid));
console.log('icons/bell-rope.png');
