// Puts the FireRed tree objects on the grass this game's maps are drawn with.
//
//   node scripts/reground-frlg-objects.mjs [--check]
//
// The trees, the tree column and the 1x1 bush were cut from a part of the
// source sheet where the ground under them is FireRed's *shaded* grass,
// `#38a898` - the blue-green used inside a forest. Every other tile in
// `frlg-tiles.png`, and every ground material a map is drawn on, uses the route
// grass `#70c8a0`. Standing one on the other draws a hard teal rectangle round
// the foot of every tree, which is the single most visible thing wrong with a
// map full of trees and is exactly the kind of bare seam this project will not
// ship.
//
// The fix is one colour. `#38a898` appears nowhere on the sheet except those
// objects - 1415 pixels across rows 9 to 16 and one bush on row 30 - and inside
// them it is only ever the flat background: the shadow the tree casts is a
// different, darker green (`#388860`) and is left alone. So swapping the one
// colour puts the tree on the route's own grass and keeps its shadow.
//
// Idempotent: run it twice and the second run reports nothing to do. `--check`
// exits non-zero if the file still holds the old colour, which is what
// `frlgSheet.test.ts` asserts from the other side.
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';

/** FireRed's shaded forest grass, baked into the cut tree objects. */
const SHADED_GRASS = [0x38, 0xa8, 0x98];
/** The route grass every ground material and every other object is drawn on. */
const ROUTE_GRASS = [0x70, 0xc8, 0xa0];

const TARGET = 'public/assets/frlg-tiles.png';
const check = process.argv.includes('--check');

const file = readFileSync(TARGET);
let offset = 8;
const chunks = [];
let width = 0;
let height = 0;
const idat = [];
while (offset < file.length) {
  const length = file.readUInt32BE(offset);
  const type = file.toString('ascii', offset + 4, offset + 8);
  const body = file.subarray(offset + 8, offset + 8 + length);
  if (type === 'IHDR') {
    width = body.readUInt32BE(0);
    height = body.readUInt32BE(4);
    if (body[8] !== 8 || body[9] !== 6) throw new Error('expected 8-bit RGBA');
  }
  if (type === 'IDAT') idat.push(Buffer.from(body));
  else chunks.push({ type, body: Buffer.from(body) });
  offset += 12 + length;
  if (type === 'IEND') break;
}

const stride = width * 4;
const raw = inflateSync(Buffer.concat(idat));
const pixels = Buffer.alloc(height * stride);
let source = 0;
for (let y = 0; y < height; y += 1) {
  const filter = raw[source];
  source += 1;
  const line = pixels.subarray(y * stride, (y + 1) * stride);
  const previous = y === 0 ? null : pixels.subarray((y - 1) * stride, y * stride);
  for (let x = 0; x < stride; x += 1) {
    const value = raw[source + x];
    const a = x >= 4 ? line[x - 4] : 0;
    const b = previous ? previous[x] : 0;
    const c = previous && x >= 4 ? previous[x - 4] : 0;
    switch (filter) {
      case 0: line[x] = value; break;
      case 1: line[x] = (value + a) & 0xff; break;
      case 2: line[x] = (value + b) & 0xff; break;
      case 3: line[x] = (value + ((a + b) >> 1)) & 0xff; break;
      case 4: {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        line[x] = (value + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
        break;
      }
      default: throw new Error(`unknown PNG filter ${filter}`);
    }
  }
  source += stride;
}

let changed = 0;
for (let i = 0; i < pixels.length; i += 4) {
  if (
    pixels[i + 3] !== 0 &&
    pixels[i] === SHADED_GRASS[0] &&
    pixels[i + 1] === SHADED_GRASS[1] &&
    pixels[i + 2] === SHADED_GRASS[2]
  ) {
    pixels[i] = ROUTE_GRASS[0];
    pixels[i + 1] = ROUTE_GRASS[1];
    pixels[i + 2] = ROUTE_GRASS[2];
    changed += 1;
  }
}

if (check) {
  if (changed > 0) {
    console.error(`${TARGET} still has ${changed} shaded-grass pixels; run without --check`);
    process.exit(1);
  }
  console.log(`${TARGET} is regrounded`);
  process.exit(0);
}

if (changed === 0) {
  console.log(`${TARGET} is already regrounded; nothing to do`);
  process.exit(0);
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();
const crc32 = (buffer) => {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, body) => {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, 'ascii');
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
  return Buffer.concat([head, body, tail]);
};

const filtered = Buffer.alloc(height * (stride + 1));
for (let y = 0; y < height; y += 1) {
  filtered[y * (stride + 1)] = 0;
  pixels.copy(filtered, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(width, 0);
ihdr.writeUInt32BE(height, 4);
ihdr[8] = 8;
ihdr[9] = 6;
writeFileSync(
  TARGET,
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(filtered, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]),
);
console.log(`${TARGET}: ${changed} pixels moved from #38a898 to #70c8a0`);
