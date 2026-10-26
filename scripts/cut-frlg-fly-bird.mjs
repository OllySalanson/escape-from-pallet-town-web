// Cuts the bird that glides over THE HARBOUR now and then, and its shadow,
// out of pret's disassembly of FireRed/LeafGreen.
//
//   node scripts/cut-frlg-fly-bird.mjs            # fetches the three files
//   node scripts/cut-frlg-fly-bird.mjs <dir>      # or reads them from <dir>
//
// The bird is FireRed's own Fly bird - `graphics/field_effects/pics/bird.png`,
// the first of its five 64x64 frames, the one with nobody riding it
// (`sAnim_Bird_WithoutPlayer` in `src/data/field_effects/field_effect_objects.h`)
// - in the palette FireRed draws it with: object palette 0, the player's
// (`CreateFlyBirdSprite` in `src/field_effect.c` sets `paletteNum = 0`), which
// is `graphics/object_events/palettes/player.pal`. Its shadow is FireRed's
// medium shadow (`graphics/field_effects/pics/shadow_medium.png`), drawn in
// the same palette as every field effect is. Nothing is scaled, filtered or
// moved: colour 0 is clear and every other colour is the palette's, put on the
// GBA's `<< 3` footing as every rip here is.
//
// It writes `public/assets/harbour-bird.png`: the bird (64x64) and, to its
// right, the shadow (16x8) at its top-left corner.
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';

const PRET_COMMIT = '037335f';
const SOURCE_URL = (path) => `https://raw.githubusercontent.com/pret/pokefirered/${PRET_COMMIT}/${path}`;
const FILES = {
  bird: 'graphics/field_effects/pics/bird.png',
  shadow: 'graphics/field_effects/pics/shadow_medium.png',
  palette: 'graphics/object_events/palettes/player.pal',
};

async function read(path) {
  const fromDir = process.argv[2];
  if (fromDir) return readFileSync(`${fromDir}/${path.split('/').pop()}`);
  const response = await fetch(SOURCE_URL(path));
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

/** A 4-bit indexed PNG as its palette indices. */
function indexed(file) {
  let offset = 8;
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
      if (body[8] !== 4) throw new Error('expected a 4-bit picture');
    } else if (type === 'IDAT') {
      idat.push(body);
    }
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width / 2;
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
    for (let x = 0; x < width; x += 1) pixels[y * width + x] = x & 1 ? line[x >> 1] & 15 : line[x >> 1] >> 4;
    previous = line;
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

const palette = (await read(FILES.palette))
  .toString('utf8')
  .trim()
  .split(/\r?\n/)
  .slice(3)
  .map((line) => line.trim().split(/\s+/).map((value) => Math.round((Number(value) * 31) / 255) << 3));
const bird = indexed(await read(FILES.bird));
const shadow = indexed(await read(FILES.shadow));

const FRAME = 64;
const width = FRAME + shadow.width;
const out = Buffer.alloc(width * FRAME * 4);
const paint = (picture, sx, sy, w, h, dx) => {
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const index = picture.pixels[(sy + y) * picture.width + sx + x];
      if (index === 0) continue;
      out.set([...palette[index], 255], (y * width + dx + x) * 4);
    }
  }
};
paint(bird, 0, 0, FRAME, FRAME, 0);
paint(shadow, 0, 0, shadow.width, shadow.height, FRAME);
writeFileSync(new URL('../public/assets/harbour-bird.png', import.meta.url), encodePng(width, FRAME, out));
console.log(`harbour-bird.png ${width}x${FRAME}`);
