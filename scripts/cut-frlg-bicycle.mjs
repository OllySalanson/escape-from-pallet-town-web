// Cuts FireRed's own Bicycle, ridden, into `public/assets/player-bike.png`: the
// figure the player becomes in a raid while riding the Bicycle
// (`src/game/world/bicycle.ts`).
//
//   git clone --filter=blob:none --no-checkout https://github.com/pret/pokefirered.git /tmp/pokefirered
//   git -C /tmp/pokefirered checkout 037335f -- graphics/object_events/pics/people/red_bike.png
//   node scripts/cut-frlg-bicycle.mjs /tmp/pokefirered
//
// pret's `red_bike.png` is one row of nine 32x32 frames in the game's own
// order: facing down, up and left, then two pedal strokes for each of those.
// It is laid on the grid `src/game/playerFrames.ts` reads - a row each for
// down, right, up and left, columns idle, stroke, idle, stroke - with the right
// facing the left one mirrored, as the game draws it. Frames stay 32x32,
// because a bicycle is two tiles long side on, and every frame is lifted by the
// same four pixels so the wheels stand on row 27, the sole line every walking
// figure stands on: FireRed draws them a row below its walkers' feet, and a
// wheel below the line is a wheel on the tile to the south.
//
// Nothing from pret is committed: what ships is the cut, rearranged frames, and
// `public/assets/ASSET_PROVENANCE.md` credits the origin.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';

const FRAME = 32;
const WHEELS_PIXEL_Y = 27;
/** pret's frame for each facing: idle, first stroke, second stroke. */
const SOURCE_FRAMES = { down: [0, 3, 4], up: [1, 5, 6], left: [2, 7, 8] };
const OUTPUT_FACING_ORDER = ['down', 'right', 'up', 'left'];
const OUTPUT_COLUMN_SOURCES = [0, 1, 0, 2];

const [pret] = process.argv.slice(2);
if (!pret) {
  console.error('usage: node scripts/cut-frlg-bicycle.mjs <pret/pokefirered checkout> (see the top of this script)');
  process.exit(1);
}

/** A 4- or 8-bit indexed PNG: its palette and its pixels as indices. */
function readIndexed(path) {
  const file = readFileSync(path);
  let offset = 8;
  const idat = [];
  let width = 0;
  let height = 0;
  let depth = 8;
  let palette = [];
  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.toString('ascii', offset + 4, offset + 8);
    const body = file.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8];
    } else if (type === 'PLTE') {
      palette = Array.from({ length: body.length / 3 }, (_, i) => [body[i * 3], body[i * 3 + 1], body[i * 3 + 2]]);
    } else if (type === 'IDAT') {
      idat.push(body);
    }
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = Math.ceil((width * depth) / 8);
  const pixels = new Uint8Array(width * height);
  let previous = new Uint8Array(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = Uint8Array.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i += 1) {
      const a = i > 0 ? line[i - 1] : 0;
      const b = previous[i];
      const c = i > 0 ? previous[i - 1] : 0;
      if (filter === 1) line[i] = (line[i] + a) & 255;
      else if (filter === 2) line[i] = (line[i] + b) & 255;
      else if (filter === 3) line[i] = (line[i] + ((a + b) >> 1)) & 255;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        line[i] = (line[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
    }
    for (let x = 0; x < width; x += 1) {
      pixels[y * width + x] = depth === 4 ? (x & 1 ? line[x >> 1] & 15 : line[x >> 1] >> 4) : line[x];
    }
    previous = line;
  }
  return { width, height, palette, pixels };
}

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

const source = readIndexed(join(pret, 'graphics/object_events/pics/people/red_bike.png'));
if (source.width !== FRAME * 9 || source.height !== FRAME) {
  throw new Error(`red_bike.png is ${source.width}x${source.height}, expected nine ${FRAME}x${FRAME} frames`);
}
const opaque = (frame, x, y) => source.pixels[y * source.width + frame * FRAME + x] !== 0;
let bottom = 0;
for (const frame of [0, 1, 2]) {
  for (let y = 0; y < FRAME; y += 1) {
    for (let x = 0; x < FRAME; x += 1) {
      if (opaque(frame, x, y)) bottom = Math.max(bottom, y);
    }
  }
}
const lower = WHEELS_PIXEL_Y - bottom;

const outputWidth = FRAME * OUTPUT_COLUMN_SOURCES.length;
const outputHeight = FRAME * OUTPUT_FACING_ORDER.length;
const output = Buffer.alloc(outputWidth * outputHeight * 4);
OUTPUT_FACING_ORDER.forEach((facing, outputRow) => {
  const mirrored = facing === 'right';
  const frames = SOURCE_FRAMES[mirrored ? 'left' : facing];
  OUTPUT_COLUMN_SOURCES.forEach((step, outputColumn) => {
    const frame = frames[step];
    for (let y = 0; y < FRAME; y += 1) {
      for (let x = 0; x < FRAME; x += 1) {
        const sx = mirrored ? FRAME - 1 - x : x;
        if (!opaque(frame, sx, y)) continue;
        const oy = y + lower;
        if (oy < 0 || oy >= FRAME) continue;
        const [r, g, b] = source.palette[source.pixels[y * source.width + frame * FRAME + sx]];
        const to = ((outputRow * FRAME + oy) * outputWidth + outputColumn * FRAME + x) * 4;
        output[to] = r;
        output[to + 1] = g;
        output[to + 2] = b;
        output[to + 3] = 255;
      }
    }
  });
});
writeFileSync(new URL('../public/assets/player-bike.png', import.meta.url), encodePng(outputWidth, outputHeight, output));
console.log(`cut the Bicycle (wheels lifted ${-lower} to row ${WHEELS_PIXEL_Y})`);
