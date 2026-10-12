// Draws the Bicycle into public/assets/icons: the rare find a raid can ride
// (`src/game/world/bicycle.ts`).
//
//   node scripts/draw-bicycle-icon.mjs
//
// 16x16 RGBA on the set's own rules (see ASSET_PROVENANCE.md): the shared
// outline #241f2e and a handful of tones, written as character art for the
// same reason a map is: a grid of numbers cannot be looked at. FireRed's own
// bag icon is 24x24 and does not go into a 16-pixel set, so this is drawn here,
// side on, in the colours of that icon's palette (`bicycle.pal` in
// pret/pokefirered): the dusky red frame, its pale highlight, grey rims.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const SIZE = 16;
const OUT = new URL('../public/assets/icons/', import.meta.url);

const hex = (value) => [
  parseInt(value.slice(0, 2), 16),
  parseInt(value.slice(2, 4), 16),
  parseInt(value.slice(4, 6), 16),
  255,
];

const ROWS = [
  '................',
  '................',
  '............oo..',
  '....ooo....o....',
  '.....rRRRRRr....',
  '.....r....rr....',
  '..ooo.r..r.oro..',
  '.osssor.r.osrso.',
  'os...sor.os.r.so',
  'os.grrro.os.g.so',
  'os...soooos...so',
  '.ossso....ossso.',
  '..ooo......ooo..',
  '................',
  '................',
  '................',
];

const TONES = {
  r: 'b46262',
  R: 'f6acac',
  s: 'b4b4b4',
  g: '626262',
};

const OUTLINE = hex('241f2e');

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

if (ROWS.length !== SIZE) throw new Error(`expected ${SIZE} rows, got ${ROWS.length}`);
const rgba = Buffer.alloc(SIZE * SIZE * 4);
ROWS.forEach((row, y) => {
  if (row.length !== SIZE) throw new Error(`row ${y} is ${row.length} wide: "${row}"`);
  [...row].forEach((ch, x) => {
    if (ch === '.') return;
    const colour = ch === 'o' ? OUTLINE : TONES[ch] ? hex(TONES[ch]) : null;
    if (!colour) throw new Error(`no colour "${ch}"`);
    Buffer.from(colour).copy(rgba, (y * SIZE + x) * 4);
  });
});
writeFileSync(new URL('bicycle.png', OUT), encodePng(SIZE, SIZE, rgba));
console.log('drew the Bicycle icon');
