// Cuts the berry trees a map maker plants into one sheet,
// `public/assets/berry-trees.png`, from Pokemon Emerald's own overworld art.
//
//   git clone --depth 1 --filter=blob:none --sparse https://github.com/pret/pokeemerald.git /tmp/pokeemerald
//   git -C /tmp/pokeemerald sparse-checkout set --no-cone /graphics/object_events/ /src/data/object_events/
//   node scripts/cut-emerald-berry-trees.mjs /tmp/pokeemerald
//
// FireRed has no berry trees - they are Ruby, Sapphire and Emerald's - so these
// are the one piece of the map maker's art that is not FireRed's. They are the
// same generation and the same 16-colour overworld palettes FireRed's own
// figures are drawn in, which is why they stand on its grass without a seam.
//
// A tree's sheet is six 16x32 frames: two of the grown tree, two flowering and
// two hung with berries, each pair a sway. Which palette a stage is drawn in is
// `gBerryTreePaletteSlotTable_<Berry>` in
// `src/data/object_events/berry_tree_graphics_tables.h` - a hardware palette
// slot, which `include/event_object_movement.h` numbers from the player's, so
// slot 2 is `npc_1.pal` - and every stage from the grown tree on uses the same
// one. Nothing from pret is committed: what ships is the frames, recoloured,
// one berry a row in the order of `BERRIES` below, and
// `public/assets/ASSET_PROVENANCE.md` credits the origin.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';

const FRAME_WIDTH = 16;
const FRAME_HEIGHT = 32;
const FRAMES = 6;
/** The berries a tree can be planted with: every one of them is an item the game has. */
const BERRIES = ['oran', 'sitrus', 'pecha', 'cheri', 'rawst', 'chesto', 'aspear'];
/** Hardware palette slot to the NPC palette file the overworld loads into it. */
const SLOT_PALETTES = { 2: 'npc_1', 3: 'npc_2', 4: 'npc_3', 5: 'npc_4' };
/** The stages a sheet holds, in the palette table's own order: grown, flowering, berries. */
const GROWN_STAGE = 2;

const [pret] = process.argv.slice(2);
if (!pret) {
  console.error('usage: node scripts/cut-emerald-berry-trees.mjs <pret/pokeemerald checkout> (see the top of this script)');
  process.exit(1);
}

const tables = readFileSync(join(pret, 'src/data/object_events/berry_tree_graphics_tables.h'), 'utf8');

function paletteOf(file) {
  return readFileSync(join(pret, 'graphics/object_events/palettes', `${file}.pal`), 'utf8')
    .trim()
    .split(/\r?\n/)
    .slice(3)
    .map((line) => line.trim().split(/\s+/).map(Number));
}

function readIndexed(path) {
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

const width = FRAMES * FRAME_WIDTH;
const height = BERRIES.length * FRAME_HEIGHT;
const sheet = Buffer.alloc(width * height * 4);
BERRIES.forEach((berry, row) => {
  const name = berry[0].toUpperCase() + berry.slice(1);
  const slots = tables.match(new RegExp(`gBerryTreePaletteSlotTable_${name}\\[\\] = \\{([^}]*)\\}`));
  if (!slots) throw new Error(`no palette table for ${name}`);
  const grown = slots[1].split(',').map(Number).slice(GROWN_STAGE);
  if (new Set(grown).size !== 1) throw new Error(`${name} changes palette after it is grown`);
  const palette = paletteOf(SLOT_PALETTES[grown[0]]);
  const art = readIndexed(join(pret, 'graphics/object_events/pics/berry_trees', `${berry}.png`));
  if (art.width !== width || art.height !== FRAME_HEIGHT) {
    throw new Error(`${berry}.png is ${art.width}x${art.height}, expected ${width}x${FRAME_HEIGHT}`);
  }
  for (let y = 0; y < FRAME_HEIGHT; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const colour = art.pixels[y * width + x];
      if (colour === 0) continue;
      const [r, g, b] = palette[colour];
      const at = ((row * FRAME_HEIGHT + y) * width + x) * 4;
      sheet[at] = r;
      sheet[at + 1] = g;
      sheet[at + 2] = b;
      sheet[at + 3] = 255;
    }
  }
});
writeFileSync(new URL('../public/assets/berry-trees.png', import.meta.url), encodePng(width, height, sheet));

writeFileSync(
  new URL('../src/game/world/generated/berryTrees.ts', import.meta.url),
  `// Generated by scripts/cut-emerald-berry-trees.mjs from pret/pokeemerald's own
// berry trees. Do not edit: re-run the script.

/** The sheet of berry trees: six 16x32 frames a berry - grown, flowering, ripe - one berry a row. */
export const BERRY_TREE_SHEET = {
  imagePath: 'assets/berry-trees.png',
  frameWidth: ${FRAME_WIDTH},
  frameHeight: ${FRAME_HEIGHT},
  framesPerBerry: ${FRAMES},
} as const;

/** Every berry a tree can be planted with, in the order its row sits on the sheet. */
export const BERRY_TREE_ORDER = [
${BERRIES.map((berry) => `  '${berry}',`).join('\n')}
] as const;
`,
);
console.log(`berry-trees.png ${width}x${height}, ${BERRIES.length} berries`);
