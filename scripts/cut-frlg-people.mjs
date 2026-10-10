// Cuts more overworld character designs into `public/assets/characters/`, from
// pret/pokefirered's own object-event graphics.
//
//   git clone --filter=blob:none --no-checkout https://github.com/pret/pokefirered.git /tmp/pokefirered
//   git -C /tmp/pokefirered checkout 037335f -- graphics/object_events/pics/people
//   node scripts/cut-frlg-people.mjs /tmp/pokefirered
//
// The first designs were cut from The Spriters Resource's "Overworld NPCs" sheet
// (`cut-frlg-characters.mjs`), and those four named people and five hunters were
// already checked frame for frame against these very files. pret holds one file
// per person, named, in the game's own frame order, so a design cut from it is
// the right figure by construction. The Spriters Resource now answers an
// automated fetch with a browser challenge.
//
// Nothing from pret is committed: what ships is the cut, rearranged frames, and
// `public/assets/ASSET_PROVENANCE.md` credits the origin.
//
// A pret people file is one row of frames: facing down, up and left, then two
// steps for each of those, and sometimes a pose after them. The game draws the
// right-hand facing as the left one mirrored, so this does too. Each design is
// laid on the grid `src/game/playerFrames.ts` reads: 16x32 frames, a row each
// for down, right, up and left, columns idle, step, idle, step - with the soles
// on row 27, where every other figure's are. The colours are left as pret's
// palettes write them, which is exactly how the first cut's colours came.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';

/** Design id: the pret file it is cut from. All of them are a class of person, never somebody. */
const DESIGNS = {
  'black-belt': 'black_belt',
  camper: 'camper',
  picnicker: 'picnicker',
  fisherman: 'fisher',
  swimmer: 'swimmer_m_land',
  'swimmer-woman': 'swimmer_f_land',
  'tuber-boy': 'tuber_m_land',
  'tuber-girl': 'tuber_f',
  'little-boy': 'little_boy',
  'little-girl': 'little_girl',
  rocker: 'rocker',
  channeler: 'channeler',
  gentleman: 'gentleman',
  'rich-boy': 'rich_boy',
  'crush-girl': 'crush_girl',
  'cooltrainer-woman': 'cooltrainer_f',
  'poke-maniac': 'poke_maniac',
  'rocket-grunt': 'rocket_m',
  'rocket-grunt-woman': 'rocket_f',
  policeman: 'policeman',
  captain: 'captain',
  chef: 'chef',
  clerk: 'clerk',
  'gym-guide': 'gym_guy',
  worker: 'worker_m',
  'worker-woman': 'worker_f',
  man: 'man',
  cameraman: 'cameraman',
};

const FRAME_WIDTH = 16;
const FRAME_HEIGHT = 32;
const FEET_PIXEL_Y = 27;
/** pret's frame for each facing: idle, first step, second step. */
const SOURCE_FRAMES = { down: [0, 3, 4], up: [1, 5, 6], left: [2, 7, 8] };
const OUTPUT_FACING_ORDER = ['down', 'right', 'up', 'left'];
const OUTPUT_COLUMN_SOURCES = [0, 1, 0, 2];

const [pret] = process.argv.slice(2);
if (!pret) {
  console.error('usage: node scripts/cut-frlg-people.mjs <pret/pokefirered checkout> (see the top of this script)');
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

const outputRoot = new URL('../public/assets/characters/', import.meta.url);
const outputWidth = FRAME_WIDTH * OUTPUT_COLUMN_SOURCES.length;
const outputHeight = FRAME_HEIGHT * OUTPUT_FACING_ORDER.length;

for (const [design, file] of Object.entries(DESIGNS)) {
  const source = readIndexed(join(pret, 'graphics/object_events/pics/people', `${file}.png`));
  const frameHeight = source.height;
  const opaque = (frame, x, y) => source.pixels[y * source.width + frame * FRAME_WIDTH + x] !== 0;
  // Every frame is lowered by the same amount, so the idle frame facing down
  // stands on the shared sole line and the steps keep their own bob.
  let bottom = 0;
  for (let y = 0; y < frameHeight; y += 1) {
    for (let x = 0; x < FRAME_WIDTH; x += 1) {
      if (opaque(0, x, y)) bottom = y;
    }
  }
  const lower = FEET_PIXEL_Y - bottom;
  const output = Buffer.alloc(outputWidth * outputHeight * 4);
  OUTPUT_FACING_ORDER.forEach((facing, outputRow) => {
    const mirrored = facing === 'right';
    const frames = SOURCE_FRAMES[mirrored ? 'left' : facing];
    OUTPUT_COLUMN_SOURCES.forEach((step, outputColumn) => {
      const frame = frames[step];
      // A stride frame can reach a pixel below the idle frame's soles; it is
      // lifted onto the sole line, because a foot below it is a foot drawn on
      // the tile to the south.
      let frameBottom = 0;
      for (let y = 0; y < frameHeight; y += 1) {
        for (let x = 0; x < FRAME_WIDTH; x += 1) {
          if (opaque(frame, x, y)) frameBottom = y;
        }
      }
      const lift = Math.max(0, frameBottom + lower - FEET_PIXEL_Y);
      for (let y = 0; y < frameHeight; y += 1) {
        for (let x = 0; x < FRAME_WIDTH; x += 1) {
          const sx = mirrored ? FRAME_WIDTH - 1 - x : x;
          if (!opaque(frame, sx, y)) continue;
          const oy = y + lower - lift;
          if (oy < 0 || oy >= FRAME_HEIGHT) continue;
          const [r, g, b] = source.palette[source.pixels[y * source.width + frame * FRAME_WIDTH + sx]];
          const to = ((outputRow * FRAME_HEIGHT + oy) * outputWidth + outputColumn * FRAME_WIDTH + x) * 4;
          output[to] = r;
          output[to + 1] = g;
          output[to + 2] = b;
          output[to + 3] = 255;
        }
      }
    });
  });
  writeFileSync(new URL(`${design}.png`, outputRoot), encodePng(outputWidth, outputHeight, output));
  // Where the head starts on the idle frame facing down, for the registry.
  let head = FRAME_HEIGHT;
  for (let y = 0; y < FRAME_HEIGHT && head === FRAME_HEIGHT; y += 1) {
    for (let x = 0; x < FRAME_WIDTH; x += 1) {
      if (output[(y * outputWidth + x) * 4 + 3] > 0) {
        head = y;
        break;
      }
    }
  }
  console.log(`cut ${design} (head ${head})`);
}
