// Cuts the overworld character designs in `public/assets/characters/` out of
// The Spriters Resource's "Overworld NPCs" sheet for Pokemon FireRed/LeafGreen.
//
//   curl -sSL -A "Mozilla/5.0" -o /tmp/frlg-3698.png \
//     "https://www.spriters-resource.com/media/assets/4/3698.png"
//   node scripts/cut-frlg-characters.mjs /tmp/frlg-3698.png
//
// The source sheet is never committed - the publisher's terms object to their
// content being redistributed "in its original format", so what ships is the
// cut and rearranged frames and `public/assets/ASSET_PROVENANCE.md` credits the
// origin. This script is the record of exactly which cells those frames are.
//
// No dependencies: the sheet is plain 8-bit RGBA, so the PNG codec below is the
// whole of what is needed and the script runs on a bare checkout.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';

/** Top edge of each design's row of cells on the source sheet. */
const DESIGN_ROWS = {
  'protagonist-red': 42,
  'protagonist-leaf': 67,
  lass: 192,
  'heavy-man': 217,
  scientist: 242,
  boy: 267,
  youngster: 292,
  woman: 492,
  'bald-man': 642,
  'old-man': 725,
  'old-woman': 775,
  'straw-hat': 800,
  'bug-catcher': 825,
  hiker: 875,
  cooltrainer: 1184,
  beauty: 1309,
  sailor: 1334,
};

// The sheet lays 16x24 cells on a 17px pitch from x=9, twelve to a design:
// down, up, left, right, each as idle, step A, step B.
const CELL_WIDTH = 16;
const CELL_HEIGHT = 24;
const CELL_PITCH = 17;
const CELL_ORIGIN_X = 9;
const SOURCE_FACING_ORDER = ['down', 'up', 'left', 'right'];
/** The sheet's "used" orange and "unused" green cell backings. */
const BACKINGS = new Set(['255,127,39', '34,177,76']);

// What `src/game/playerFrames.ts` reads from `character.png`: 16x32 frames, a
// row per facing in this order, idle in column 0 and the walk cycle 1, 0, 3, 0.
const FRAME_WIDTH = 16;
const FRAME_HEIGHT = 32;
const OUTPUT_FACING_ORDER = ['down', 'right', 'up', 'left'];
const OUTPUT_COLUMN_SOURCES = [0, 1, 0, 2];
/** Cell rows 0-23 land on frame rows 4-27, so the soles rest on row 27. */
const CELL_OFFSET_Y = 4;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function decodePng(bytes) {
  if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error('not a PNG');
  let width = 0;
  let height = 0;
  const idat = [];
  for (let at = 8; at < bytes.length;) {
    const length = bytes.readUInt32BE(at);
    const type = bytes.subarray(at + 4, at + 8).toString('ascii');
    const data = bytes.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 6 || data[12] !== 0) {
        throw new Error('expected non-interlaced 8-bit RGBA');
      }
    } else if (type === 'IDAT') {
      idat.push(data);
    }
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x += 1) {
      const value = raw[y * (stride + 1) + 1 + x];
      const left = x >= 4 ? pixels[y * stride + x - 4] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upLeft = x >= 4 && y > 0 ? pixels[(y - 1) * stride + x - 4] : 0;
      let predicted = 0;
      if (filter === 1) predicted = left;
      else if (filter === 2) predicted = up;
      else if (filter === 3) predicted = (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        predicted = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      }
      pixels[y * stride + x] = (value + predicted) & 0xff;
    }
  }
  return { width, height, pixels };
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  let crc = 0xffffffff;
  for (const byte of body) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE((crc ^ 0xffffffff) >>> 0, body.length + 4);
  return out;
}

function encodePng(width, height, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const sourcePath = process.argv[2];
if (!sourcePath) {
  console.error('usage: node scripts/cut-frlg-characters.mjs <Overworld NPCs sheet, asset 3698>');
  process.exit(1);
}

const sheet = decodePng(readFileSync(sourcePath));
const outputRoot = new URL('../public/assets/characters/', import.meta.url);
mkdirSync(outputRoot, { recursive: true });

const outputWidth = FRAME_WIDTH * OUTPUT_COLUMN_SOURCES.length;
const outputHeight = FRAME_HEIGHT * OUTPUT_FACING_ORDER.length;

for (const [design, rowY] of Object.entries(DESIGN_ROWS)) {
  const output = Buffer.alloc(outputWidth * outputHeight * 4);
  OUTPUT_FACING_ORDER.forEach((facing, outputRow) => {
    OUTPUT_COLUMN_SOURCES.forEach((sourceStep, outputColumn) => {
      const cell = SOURCE_FACING_ORDER.indexOf(facing) * 3 + sourceStep;
      const cellX = CELL_ORIGIN_X + CELL_PITCH * cell;
      for (let y = 0; y < CELL_HEIGHT; y += 1) {
        for (let x = 0; x < CELL_WIDTH; x += 1) {
          const from = ((rowY + y) * sheet.width + cellX + x) * 4;
          const [r, g, b] = sheet.pixels.subarray(from, from + 3);
          if (BACKINGS.has(`${r},${g},${b}`)) continue;
          const to =
            ((outputRow * FRAME_HEIGHT + CELL_OFFSET_Y + y) * outputWidth +
              outputColumn * FRAME_WIDTH +
              x) *
            4;
          sheet.pixels.copy(output, to, from, from + 4);
        }
      }
    });
  });
  writeFileSync(new URL(`${design}.png`, outputRoot), encodePng(outputWidth, outputHeight, output));
  console.log(`cut ${design}`);
}
