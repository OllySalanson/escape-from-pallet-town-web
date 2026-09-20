// Draws the "landmark worked" map icon into public/assets/icons.
//
//   node scripts/draw-worked-landmark-icon.mjs
//
// It is the radio mast the map already draws on a landmark that seals an exit
// (`radio-mast.png`), with the one difference a player has to read at 16px and
// at a glance: the beacon is lit green rather than dark red, and the signal is
// coming off both sides of it in full arcs instead of one broken pair. Green
// because that is already the colour of a door you have opened, on the map and
// on the lobby's own picture of it.
//
// 16x16 RGBA, the same shared outline (#241f2e) as the rest of the set - see
// ASSET_PROVENANCE.md.
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
const C = {
  o: hex('241f2e'), // the set's one outline
  L: hex('9be27a'), // the lit beacon: the green a door you opened is drawn in
  l: hex('dcfce7'), // its highlight
  S: hex('9be27a'), // the signal, solid where the sealed mast's is a thin arc
  s: hex('4d9e3f'), // its shade
  D: hex('9db0c4'), // the mast's steel, as radio-mast.png draws it
};

// At 16px a silhouette this close to `radio-mast.png` only reads as a different
// object if the colour mass does, so the signal is two solid blocks rather than
// that icon's thin broken arcs, and the lamp is three pixels of lit green
// rather than one of dark red.
const rows = [
  '.....olLlo......',
  '.....oLLLo......',
  '......oLo.......',
  'ooooo..o..ooooo.',
  'oSSSo.oDo.oSSSo.',
  'oSsso.oDo.ossso.',
  'ooooo.oDo.ooooo.',
  '.....oD.Do......',
  '.....oD.Do......',
  '....oDDDDDo.....',
  '....oD...Do.....',
  '...oD.....Do....',
  '...oDDDDDDDo....',
  '..oD.......Do...',
  '..oDDDDDDDDDo...',
  '................',
];

const grid = rows.map((row, y) => {
  if (row.length !== SIZE) {
    throw new Error(`row ${y} is ${row.length} wide: "${row}"`);
  }
  return [...row].map((ch) => {
    if (ch === '.') {
      return null;
    }
    if (!C[ch]) {
      throw new Error(`no colour "${ch}"`);
    }
    return ch;
  });
});
if (grid.length !== SIZE) {
  throw new Error(`expected ${SIZE} rows, got ${grid.length}`);
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buffer) => {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
};
const png = (pixels) => {
  const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
  pixels.forEach((row, y) => {
    const base = y * (SIZE * 4 + 1);
    raw[base] = 0;
    row.forEach((key, x) => {
      const [r, g, b, a] = key ? C[key] : [0, 0, 0, 0];
      raw.set([r, g, b, a], base + 1 + x * 4);
    });
  });
  const header = Buffer.alloc(13);
  header.writeUInt32BE(SIZE, 0);
  header.writeUInt32BE(SIZE, 4);
  header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

writeFileSync(new URL('landmark-worked.png', OUT), png(grid));
console.log('icons/landmark-worked.png');
