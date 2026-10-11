// Draws the fishing rods into public/assets/icons: the Old Rod and the Good Rod
// a raid carries to fish open water (`src/game/world/fishing.ts`).
//
//   node scripts/draw-rod-icons.mjs
//
// 16x16 RGBA on the set's own rules (see ASSET_PROVENANCE.md): the shared
// outline #241f2e and a handful of tones each, written as character art for the
// same reason a map is: a grid of numbers cannot be looked at.
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

// One rod drawn twice, as FireRed tells its rods apart: the Old Rod is plain
// cane, the Good Rod a blue rod with a red reel. The line hangs from the tip so
// the shape reads as a rod and not a stick at 16px.
const ROD_ROWS = [
  '................',
  '............oo..',
  '...........olso.',
  '..........olson.',
  '.........olso.n.',
  '........olso..n.',
  '.......olso...n.',
  '......olso....n.',
  '.....olso.....n.',
  '....olso......n.',
  '...oGHrRo....nn.',
  '..oGHorro.......',
  '.oGHo.oo........',
  'oGHo............',
  '.oo.............',
  '................',
];

const LINE = '7d8da3';

const ICONS = {
  'old-rod': {
    tones: {
      l: 'd9b46a',
      s: '9c7438',
      G: '6b4a2b',
      H: '4a3220',
      r: '97a3b2',
      R: 'd3dbe4',
      n: LINE,
    },
    rows: ROD_ROWS,
  },
  'good-rod': {
    tones: {
      l: '7fb4e0',
      s: '3f6f9d',
      G: '4a4a5c',
      H: '2e2e3a',
      r: 'c8443c',
      R: 'ff8a70',
      n: LINE,
    },
    rows: ROD_ROWS,
  },
};

const OUTLINE = hex('241f2e');

function crc32(bytes) {
  let crc = ~0;
  for (const byte of bytes) {
    crc ^= byte;
    for (let k = 0; k < 8; k += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function encodePng(width, height, rgba) {
  const chunk = (type, body) => {
    const out = Buffer.alloc(body.length + 12);
    out.writeUInt32BE(body.length, 0);
    out.write(type, 4, 'ascii');
    body.copy(out, 8);
    out.writeUInt32BE(crc32(out.subarray(4, 8 + body.length)), 8 + body.length);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const [name, { tones, rows }] of Object.entries(ICONS)) {
  if (rows.length !== SIZE) throw new Error(`${name}: expected ${SIZE} rows, got ${rows.length}`);
  const rgba = Buffer.alloc(SIZE * SIZE * 4);
  rows.forEach((row, y) => {
    if (row.length !== SIZE) throw new Error(`${name}: row ${y} is ${row.length} wide: "${row}"`);
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      const colour = ch === 'o' ? OUTLINE : tones[ch] ? hex(tones[ch]) : null;
      if (!colour) throw new Error(`${name}: no colour "${ch}"`);
      Buffer.from(colour).copy(rgba, (y * SIZE + x) * 4);
    });
  });
  writeFileSync(new URL(`${name}.png`, OUT), encodePng(SIZE, SIZE, rgba));
}
console.log(`drew ${Object.keys(ICONS).length} rod icons`);
