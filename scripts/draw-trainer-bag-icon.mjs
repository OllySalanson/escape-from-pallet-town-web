// Draws the dropped trainer's bag a beaten trainer leaves on the map into
// public/assets/icons/trainer-bag.png.
//
//   node scripts/draw-trainer-bag-icon.mjs
//
// 16x16 RGBA on the set's shared outline (#241f2e) and a shade/base/light
// triple per hue (see ASSET_PROVENANCE.md). It is a bag lying on its side with
// its flap thrown open and a Poke Ball rolled out of its mouth: somebody's
// things, spilled where they fell. It must not read as one of the four packs,
// which are items and are drawn standing up, nor as the supply cache's box - a
// bag is a search like a cache is, but it is somebody's, and the spill says so.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const SIZE = 16;
const OUT = new URL('../public/assets/icons/trainer-bag.png', import.meta.url);

const hex = (value) => [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16), 255];
const C = {
  o: hex('241f2e'),
  // tan leather: a trainer's shoulder bag, warmer than any pack's cloth
  l: hex('b8743a'), L: hex('e0a05a'), d: hex('7c4a24'),
  // the strap and its buckle
  b: hex('5a3a20'), m: hex('f0d890'),
  // the Poke Ball rolled out of it
  r: hex('e03c30'), R: hex('ff8070'), w: hex('f8f8f8'), g: hex('b0b0c0'),
};

const rows = [
  '................',
  '................',
  '................',
  '....oooo........',
  '...ob..bo.......',
  '..ob....bo......',
  '.oooooooooo.....',
  'oLLLLLLLLLLo....',
  'oLLLLLLLLLLLo...',
  'olllllmlllllo...',
  'olllllllllllo...',
  'olllllllllloooo.',
  'olllllllllloRRro',
  'oddddddddddooooo',
  '.ooooooooooowwgo',
  '............ooo.',
];

const grid = rows.map((row, y) => {
  if (row.length !== SIZE) throw new Error(`row ${y} is ${row.length} wide: "${row}"`);
  return [...row].map((ch) => {
    if (ch === '.') return null;
    if (!C[ch]) throw new Error(`no colour "${ch}"`);
    return ch;
  });
});
if (grid.length !== SIZE) throw new Error(`expected ${SIZE} rows`);

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
const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
grid.forEach((row, y) => {
  const base = y * (SIZE * 4 + 1);
  row.forEach((key, x) => raw.set(key ? C[key] : [0, 0, 0, 0], base + 1 + x * 4));
});
const header = Buffer.alloc(13);
header.writeUInt32BE(SIZE, 0);
header.writeUInt32BE(SIZE, 4);
header.set([8, 6, 0, 0, 0], 8);
writeFileSync(
  OUT,
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]),
);
