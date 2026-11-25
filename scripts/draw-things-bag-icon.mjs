// Draws the sack the result screen drops a raid's haul into, standing for YOUR
// THINGS, into public/assets/icons/things-bag.png and things-bag-front.png.
//
//   node scripts/draw-things-bag-icon.mjs
//
// 16x16 RGBA on the set's shared outline (#241f2e) and a shade/base/light
// triple per hue (see ASSET_PROVENANCE.md). A sack standing up, its mouth open
// and dark, its neck tied with a gold cord and knot: blue so it never reads as
// a beaten trainer's tan bag or one of the four packs. It is drawn twice: the
// whole sack, and its front alone from the lip down, so a thing dropped into
// it passes behind the lip and is seen to go in (`ExtractionScene`).
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const SIZE = 16;
/** The first row of the front: the lip of the mouth and everything under it. */
const FRONT_FROM = 4;

const hex = (value) => [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16), 255];
const C = {
  o: hex('241f2e'),
  // the inside of the mouth
  k: hex('1a1424'), K: hex('3a2c48'),
  // blue canvas
  l: hex('3a5ca8'), L: hex('6a94dc'), d: hex('24386c'),
  // the gold cord and its knot
  y: hex('d8a030'), Y: hex('f8d870'), m: hex('fff0c0'),
};

const rows = [
  '....oooooooo....',
  '..ooKKKKKKKKoo..',
  '.oKkkkkkkkkkkKo.',
  '.oLkkkkkkkkkkLo.',
  '..oLLLLLLLLLLo..',
  '..oddddddddddo..',
  '...oyyymmyyyo...',
  '..oLlllllllldo..',
  '.oLlllllllllldo.',
  'oLlllllllllllldo',
  'oLlllllllllllldo',
  'oLlllllllllllldo',
  'oLlllllllllllddo',
  '.odlllllllllddo.',
  '..oddddddddddo..',
  '...oooooooooo...',
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
const png = (keep) => {
  const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
  grid.forEach((row, y) => {
    const base = y * (SIZE * 4 + 1);
    row.forEach((key, x) => raw.set(key && keep(y) ? C[key] : [0, 0, 0, 0], base + 1 + x * 4));
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
writeFileSync(new URL('../public/assets/icons/things-bag.png', import.meta.url), png(() => true));
writeFileSync(new URL('../public/assets/icons/things-bag-front.png', import.meta.url), png((y) => y >= FRONT_FROM));
