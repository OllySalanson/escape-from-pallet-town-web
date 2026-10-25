// Cuts FireRed's own tile animations - the sea that ripples, the waterline
// that laps at sand, the flowers that sway - for the tiles this game already
// draws, from pret's disassembly of FireRed/LeafGreen.
//
//   node scripts/cut-frlg-tile-anims.mjs <pret/pokefirered checkout>
//
// Only these files of the checkout are read, so a sparse one will do (pinned
// at 037335f, the commit every other FireRed cut here uses):
//
//   data/tilesets/primary/general/{tiles.png,metatiles.bin,palettes/*.pal}
//   data/tilesets/primary/general/anim/{water_current_landwatersedge,sandwatersedge,flower}/*.png
//
// FireRed animates a tileset by overwriting 8x8 tiles in video memory on a
// timer (`src/tileset_anims.c`, `TilesetAnim_General`): the 48 tiles from 416
// are the sea and the edge where it meets land, eight frames, one every 16
// game frames; the 18 from 464 are where it meets sand, eight frames, one
// every 8; the 4 from 508 are the flowers, five frames, one every 16. Every
// 16x16 metatile that uses one of those tiles animates with it. So the whole
// of FireRed's animated ground is: render each such metatile once a frame,
// with that frame's tiles in.
//
// This game draws its ground from rips (`frlg-tiles.png`, `frlg-kanto.png`),
// not from pret, so which of *its* cells are which animated metatile - and at
// which frame of the animation the rip caught it - is read off the pixels: a
// cell that matches a frame of a metatile exactly is that metatile, at that
// phase. Nothing is guessed and no cell is approximated: a cell that matches
// nothing animated stays still.
//
// It writes `public/assets/frlg-tile-anims.png` (one row a matched cell, its
// frames left to right, starting at the frame the rip shows so frame 0 is
// always the still cell) and `src/game/world/generated/tileAnimations.ts`
// (which cell of which sheet each row animates, and how fast).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TILE = 16;
const [pret] = process.argv.slice(2);
const general = pret && join(pret, 'data/tilesets/primary/general');
if (!general || !existsSync(join(general, 'tiles.png'))) {
  console.error('usage: node scripts/cut-frlg-tile-anims.mjs <pret/pokefirered checkout> (see the top of this script)');
  process.exit(1);
}

/** FireRed's animated tile ranges, each a timer that swaps its tiles in. */
const ANIMS = [
  { name: 'water', dir: 'water_current_landwatersedge', first: 416, count: 48, frames: 8, ticks: 16 },
  { name: 'sandEdge', dir: 'sandwatersedge', first: 464, count: 18, frames: 8, ticks: 8 },
  { name: 'flower', dir: 'flower', first: 508, count: 4, frames: 5, ticks: 16 },
];
/** One GBA frame. */
const TICK_MS = 1000 / 59.7275;

/** A 4- or 8-bit indexed PNG as its palette indices. */
function indexed(path) {
  const file = readFileSync(path);
  let offset = 8;
  const idat = [];
  let width = 0;
  let height = 0;
  let depth = 8;
  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.toString('ascii', offset + 4, offset + 8);
    const body = file.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8];
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
  return { width, height, pixels };
}

/** An RGBA PNG (the rips this game draws from). */
function rgba(path) {
  const file = readFileSync(path);
  let offset = 8;
  const idat = [];
  let width = 0;
  let height = 0;
  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.toString('ascii', offset + 4, offset + 8);
    const body = file.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      if (body[8] !== 8 || body[9] !== 6) throw new Error(`${path}: expected 8-bit RGBA`);
    } else if (type === 'IDAT') {
      idat.push(body);
    }
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const data = Buffer.alloc(width * height * 4);
  let previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i += 1) {
      const a = i >= 4 ? line[i - 4] : 0;
      const b = previous[i];
      const c = i >= 4 ? previous[i - 4] : 0;
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
    line.copy(data, y * stride);
    previous = line;
  }
  return { width, height, data };
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

function encodePng(width, height, data) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** A JASC palette, every channel put on the GBA's `<< 3` footing. */
function palette(number) {
  return readFileSync(join(general, 'palettes', `${String(number).padStart(2, '0')}.pal`), 'utf8')
    .trim()
    .split(/\r?\n/)
    .slice(3)
    .map((line) => line.trim().split(/\s+/).map((value) => Math.round((Number(value) * 31) / 255) << 3));
}

const tiles = indexed(join(general, 'tiles.png'));
const palettes = Array.from({ length: 7 }, (_, n) => palette(n));
const metatiles = readFileSync(join(general, 'metatiles.bin'));
const metatileCount = metatiles.length / 16;
const animFrames = ANIMS.map((anim) =>
  Array.from({ length: anim.frames }, (_, frame) => indexed(join(general, 'anim', anim.dir, `${frame}.png`))),
);

/** The 8x8 tile `index` as palette indices, with each animation at the frame given. */
function tilePixels(index, frames) {
  const out = new Uint8Array(64);
  const anim = ANIMS.findIndex((each) => index >= each.first && index < each.first + each.count);
  const source = anim >= 0 ? animFrames[anim][frames[anim]] : tiles;
  const local = anim >= 0 ? index - ANIMS[anim].first : index;
  const columns = source.width / 8;
  const tx = (local % columns) * 8;
  const ty = Math.floor(local / columns) * 8;
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) out[y * 8 + x] = source.pixels[(ty + y) * source.width + tx + x];
  }
  return out;
}

const entriesOf = (metatile) => Array.from({ length: 8 }, (_, k) => metatiles.readUInt16LE(metatile * 16 + k * 2));

/** A metatile drawn whole, both layers, as FireRed draws it. */
function renderMetatile(metatile, frames) {
  const out = Buffer.alloc(TILE * TILE * 4);
  entriesOf(metatile).forEach((entry, k) => {
    const index = entry & 1023;
    if (index >= 640) return;
    const pixels = tilePixels(index, frames);
    const dx = (k & 1) * 8;
    const dy = ((k & 3) >> 1) * 8;
    const layer = k >> 2;
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        const colour = pixels[(entry & 2048 ? 7 - y : y) * 8 + (entry & 1024 ? 7 - x : x)];
        if (colour === 0 && layer === 1) continue;
        const rgb = palettes[(entry >> 12) % 7][colour];
        const at = ((dy + y) * TILE + dx + x) * 4;
        out[at] = rgb[0];
        out[at + 1] = rgb[1];
        out[at + 2] = rgb[2];
        out[at + 3] = 255;
      }
    }
  });
  return out;
}

/** Which animations a metatile uses, by index into `ANIMS`. */
const animsOf = (metatile) =>
  ANIMS.flatMap((anim, n) =>
    entriesOf(metatile).some((entry) => (entry & 1023) >= anim.first && (entry & 1023) < anim.first + anim.count) ? [n] : [],
  );

/**
 * One whole cycle of a metatile, a frame per change: the tick period is the
 * fastest of its animations, and the cycle runs until every one of them is
 * back where it started.
 */
function cycleOf(metatile) {
  const used = animsOf(metatile);
  if (used.length === 0) return null;
  const ticks = Math.min(...used.map((n) => ANIMS[n].ticks));
  const lcm = (a, b) => {
    const gcd = (x, y) => (y === 0 ? x : gcd(y, x % y));
    return (a * b) / gcd(a, b);
  };
  const length = used.map((n) => ANIMS[n].frames * ANIMS[n].ticks).reduce(lcm) / ticks;
  const frames = Array.from({ length }, (_, step) => {
    const timer = step * ticks;
    const at = ANIMS.map((anim) => Math.floor(timer / anim.ticks) % anim.frames);
    return renderMetatile(metatile, at);
  });
  return { frames, frameMs: ticks * TICK_MS };
}

const cellOf = (sheet, column, row) => {
  const out = Buffer.alloc(TILE * TILE * 4);
  for (let y = 0; y < TILE; y += 1) {
    sheet.data.copy(out, y * TILE * 4, ((row * TILE + y) * sheet.width + column * TILE) * 4, ((row * TILE + y) * sheet.width + column * TILE + TILE) * 4);
  }
  return out;
};

/**
 * The same picture, give or take a ripped colour's rounding. A cell cut with
 * its ground made clear (Kanto's flowers stand on whatever they are planted
 * on) is compared where it is drawn, and must be mostly drawn.
 */
function same(cell, frame) {
  let drawn = 0;
  for (let i = 0; i < cell.length; i += 4) {
    if (cell[i + 3] === 0) continue;
    if (cell[i + 3] < 255) return false;
    drawn += 1;
    for (let c = 0; c < 3; c += 1) if (Math.abs(cell[i + c] - frame[i + c]) > 8) return false;
  }
  return drawn >= (TILE * TILE) / 2;
}

/** A frame cut to the cell's own outline, so what was clear stays clear. */
function masked(cell, frame) {
  const out = Buffer.from(frame);
  for (let i = 0; i < cell.length; i += 4) if (cell[i + 3] === 0) out.fill(0, i, i + 4);
  return out;
}

const cycles = [];
for (let metatile = 0; metatile < metatileCount; metatile += 1) {
  const cycle = cycleOf(metatile);
  if (cycle) cycles.push({ metatile, ...cycle });
}

const SHEETS = [
  { key: 'frlg', path: 'public/assets/frlg-tiles.png' },
  { key: 'kanto', path: 'public/assets/frlg-kanto.png' },
];
const rows = [];
for (const { key, path } of SHEETS) {
  const sheet = rgba(join(ROOT, path));
  for (let row = 0; row < sheet.height / TILE; row += 1) {
    for (let column = 0; column < sheet.width / TILE; column += 1) {
      const cell = cellOf(sheet, column, row);
      for (const cycle of cycles) {
        const phase = cycle.frames.findIndex((frame) => same(cell, frame));
        if (phase < 0) continue;
        // Distinct frames only: a metatile whose animated tiles sit where its
        // own top layer covers them does not visibly move, and is left still.
        const ordered = [...cycle.frames.slice(phase), ...cycle.frames.slice(0, phase)].map((frame) => masked(cell, frame));
        if (ordered.every((frame) => frame.equals(ordered[0]))) break;
        rows.push({ sheet: key, column, row, metatile: cycle.metatile, frames: ordered, frameMs: cycle.frameMs });
        break;
      }
    }
  }
}

const width = Math.max(...rows.map((each) => each.frames.length)) * TILE;
const image = Buffer.alloc(width * rows.length * TILE * 4);
rows.forEach((each, index) => {
  each.frames.forEach((frame, n) => {
    for (let y = 0; y < TILE; y += 1) {
      frame.copy(image, ((index * TILE + y) * width + n * TILE) * 4, y * TILE * 4, (y + 1) * TILE * 4);
    }
  });
});
writeFileSync(join(ROOT, 'public/assets/frlg-tile-anims.png'), encodePng(width, rows.length * TILE, image));

const generated = `// Generated by scripts/cut-frlg-tile-anims.mjs from pret/pokefirered@037335f.
// Do not edit by hand: run the script again.

/** The animation sheet: one row a cell below, its frames left to right. */
export const TILE_ANIMATION_SHEET = {
  imagePath: 'assets/frlg-tile-anims.png',
  columns: ${width / TILE},
  rows: ${rows.length},
} as const;

/**
 * Every cell of the ground sheets that FireRed animates: which sheet and
 * cell, which general metatile it is, how many frames its cycle has and how
 * long each is shown. Row \`n\` of the sheet is entry \`n\`; its frame 0 is the
 * still cell.
 */
export const TILE_ANIMATIONS = [
${rows
  .map(
    (each) =>
      `  { sheet: '${each.sheet}', column: ${each.column}, row: ${each.row}, metatile: ${each.metatile}, frames: ${each.frames.length}, frameMs: ${Math.round(each.frameMs * 10) / 10} },`,
  )
  .join('\n')}
] as const;
`;
writeFileSync(join(ROOT, 'src/game/world/generated/tileAnimations.ts'), generated);
console.log(`${rows.length} animated cells: ${SHEETS.map(({ key }) => `${key} ${rows.filter((each) => each.sheet === key).length}`).join(', ')}`);
