// Cuts every Pokemon the game has into one sheet of FireRed's own party icons,
// `public/assets/pokemon-icons.png`, for the Pokemon a map maker stands in the
// world.
//
//   git clone --filter=blob:none --no-checkout https://github.com/pret/pokefirered.git /tmp/pokefirered
//   git -C /tmp/pokefirered checkout 037335f -- graphics/pokemon src/pokemon_icon.c
//   node scripts/cut-frlg-pokemon-icons.mjs /tmp/pokefirered
//
// An icon is the little two-frame figure FireRed draws for a Pokemon in the
// party menu: 32x32, every one of the 151, drawn in one of three shared
// palettes, which `gMonIconPaletteIndices` in `src/pokemon_icon.c` names per
// species. Nothing from pret is committed: what ships is the frames, recoloured
// from those palettes and packed in national-dex order, and
// `public/assets/ASSET_PROVENANCE.md` credits the origin.
//
// The sheet is two frames a species, eight species a row, in the order of
// `SPECIES_ORDER` below; `src/game/pokemon/generated/pokemonIcons.ts` is the
// list the game reads a species' first frame from.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';

const ICON = 32;
const FRAMES = 2;
const SPECIES_PER_ROW = 8;
const DEX_SIZE = 151;

const [pret] = process.argv.slice(2);
if (!pret) {
  console.error('usage: node scripts/cut-frlg-pokemon-icons.mjs <pret/pokefirered checkout> (see the top of this script)');
  process.exit(1);
}

/** National-dex order and each species' icon palette, read off pret's own table. */
const table = readFileSync(join(pret, 'src/pokemon_icon.c'), 'utf8');
const start = table.indexOf('gMonIconPaletteIndices');
const entries = [...table.slice(start).matchAll(/\[SPECIES_([A-Z0-9_]+)\]\s*=\s*(\d)/g)]
  .slice(1, DEX_SIZE + 1)
  .map(([, name, palette]) => ({ folder: name.toLowerCase(), palette: Number(palette) }));
if (entries.length !== DEX_SIZE) throw new Error(`read ${entries.length} species, expected ${DEX_SIZE}`);

const palettes = [0, 1, 2].map((n) =>
  readFileSync(join(pret, 'graphics/pokemon/icon_palettes', `icon_palette_${n}.pal`), 'utf8')
    .trim()
    .split(/\r?\n/)
    .slice(3)
    .map((line) => line.trim().split(/\s+/).map(Number)),
);

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

const columns = SPECIES_PER_ROW * FRAMES;
const rows = Math.ceil(DEX_SIZE / SPECIES_PER_ROW);
const width = columns * ICON;
const height = rows * ICON;
const sheet = Buffer.alloc(width * height * 4);
entries.forEach(({ folder, palette }, index) => {
  const icon = readIndexed(join(pret, 'graphics/pokemon', folder, 'icon.png'));
  for (let frame = 0; frame < FRAMES; frame += 1) {
    const cell = index * FRAMES + frame;
    const left = (cell % columns) * ICON;
    const top = Math.floor(cell / columns) * ICON;
    for (let y = 0; y < ICON; y += 1) {
      for (let x = 0; x < ICON; x += 1) {
        const colour = icon.pixels[(frame * ICON + y) * icon.width + x];
        if (colour === 0) continue;
        const [r, g, b] = palettes[palette][colour];
        const at = ((top + y) * width + left + x) * 4;
        sheet[at] = r;
        sheet[at + 1] = g;
        sheet[at + 2] = b;
        sheet[at + 3] = 255;
      }
    }
  }
});
writeFileSync(new URL('../public/assets/pokemon-icons.png', import.meta.url), encodePng(width, height, sheet));

const ids = entries.map(({ folder }) => folder.replace(/_/g, '-'));
writeFileSync(
  new URL('../src/game/pokemon/generated/pokemonIcons.ts', import.meta.url),
  `// Generated by scripts/cut-frlg-pokemon-icons.mjs from pret/pokefirered's own
// party icons. Do not edit: re-run the script.

/** The sheet of FireRed's party icons: two 32x32 frames a species, in national-dex order. */
export const POKEMON_ICON_SHEET = {
  imagePath: 'assets/pokemon-icons.png',
  frameSize: ${ICON},
  framesPerSpecies: ${FRAMES},
  columns: ${columns},
  rows: ${rows},
} as const;

/** Every species with an icon, in the order its frames sit on the sheet. */
export const POKEMON_ICON_ORDER = [
${ids.map((id) => `  '${id}',`).join('\n')}
] as const;
`,
);
console.log(`pokemon-icons.png ${width}x${height}, ${ids.length} species`);
