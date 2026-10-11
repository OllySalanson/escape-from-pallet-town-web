// Cuts FireRed's two pieces of shiny art onto files the game loads:
//
//   node scripts/cut-frlg-shiny.mjs
//
// - `public/assets/battle/shiny-sparkle.png`, the battle's gold stars
//   (`graphics/battle_anims/sprites/gold_stars.png`, ANIM_TAG_GOLD_STARS):
//   the 16x16 wish star in the top two rows of tiles and the two 8x8 twinkles
//   under it, exactly as the sheet lays them out, because
//   `AnimTask_ShinySparkles` (`src/battle_anim_special.c`) reads them by tile -
//   the star at tile 0, the twinkles at tiles 4 and 5. `ui/shinySparkle.ts`
//   names the three frames.
// - `public/assets/battle/shiny-star.png`, the summary screen's shiny star
//   (`graphics/summary_screen/shiny_star.png`), whose one animation frame is
//   the sheet's second 8x8 tile (`sStarObjAnim0` in
//   `src/pokemon_summary_screen.c`). The menus draw it beside a shiny's name.
//
// Both are read from pret/pokefirered at the commit every other FireRed cut is
// pinned to, colours as the sheet's own palette writes them, with index 0 -
// the GBA's transparent colour - left clear. Nothing from pret is committed;
// `public/assets/ASSET_PROVENANCE.md` credits the origin.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'public', 'assets', 'battle');
const COMMIT = '037335f';
const BASE = `https://raw.githubusercontent.com/pret/pokefirered/${COMMIT}/graphics`;

const download = async (url) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(url);
    if (response.ok) return Buffer.from(await response.arrayBuffer());
    if (response.status === 404) throw new Error(`nothing at ${url}`);
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }
  throw new Error(`could not fetch ${url}`);
};

/** An indexed PNG as pret keeps one: its size, its palette and one index a pixel. */
function readIndexed(file) {
  let offset = 8;
  const idat = [];
  let width = 0;
  let height = 0;
  let depth = 8;
  let palette = Buffer.alloc(0);
  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.toString('ascii', offset + 4, offset + 8);
    const body = file.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8];
      if (body[9] !== 3) throw new Error('expected an indexed PNG');
    } else if (type === 'PLTE') {
      palette = body;
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

/** A region of an indexed image as RGBA, index 0 transparent. */
function crop(image, x0, y0, width, height) {
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = image.pixels[(y0 + y) * image.width + x0 + x];
      if (index === 0) continue;
      const at = (y * width + x) * 4;
      rgba[at] = image.palette[index * 3];
      rgba[at + 1] = image.palette[index * 3 + 1];
      rgba[at + 2] = image.palette[index * 3 + 2];
      rgba[at + 3] = 255;
    }
  }
  return rgba;
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
    const chunkBytes = Buffer.alloc(body.length + 12);
    chunkBytes.writeUInt32BE(body.length, 0);
    chunkBytes.write(type, 4, 'ascii');
    body.copy(chunkBytes, 8);
    chunkBytes.writeUInt32BE(crc32(chunkBytes.subarray(4, 8 + body.length)), 8 + body.length);
    return chunkBytes;
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

const stars = readIndexed(await download(`${BASE}/battle_anims/sprites/gold_stars.png`));
if (stars.width !== 16 || stars.height !== 24) throw new Error(`gold_stars is ${stars.width}x${stars.height}, expected 16x24`);
writeFileSync(join(out, 'shiny-sparkle.png'), encodePng(16, 24, crop(stars, 0, 0, 16, 24)));

const star = readIndexed(await download(`${BASE}/summary_screen/shiny_star.png`));
if (star.width !== 8 || star.height !== 16) throw new Error(`shiny_star is ${star.width}x${star.height}, expected 8x16`);
writeFileSync(join(out, 'shiny-star.png'), encodePng(8, 8, crop(star, 0, 8, 8, 8)));

process.stderr.write('shiny-sparkle.png and shiny-star.png written\n');
