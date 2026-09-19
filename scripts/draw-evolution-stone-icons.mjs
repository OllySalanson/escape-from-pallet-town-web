// Draws the evolution-stone icons into public/assets/icons.
//
//   node scripts/draw-evolution-stone-icons.mjs
//
// 16x16 RGBA on the set's own rules (see ASSET_PROVENANCE.md): the shared
// outline #241f2e and a shade/base/light triple for the hue. The stone is a cut
// gem lit from the top left with its emblem cut out of it in the outline
// colour, so the shape reads at 16px without a second hue in it.
//
// Only the Thunder Stone ships today: it is the one stone a player can spend,
// because Pikachu is the only species with a stone evolution that can be owned.
// A second stone is a second block of rows here and nothing else.
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
  o: hex('241f2e'),
  // electric yellow, picked to stand beside the set's red and blue triples
  s: hex('b0781c'), b: hex('f0b830'), l: hex('ffe078'),
};

const fromRows = (rows) => {
  if (rows.length !== SIZE) throw new Error(`expected ${SIZE} rows, got ${rows.length}`);
  return rows.map((row, y) => {
    if (row.length !== SIZE) throw new Error(`row ${y} is ${row.length} wide: "${row}"`);
    return [...row].map((ch) => {
      if (ch === '.') return null;
      if (!C[ch]) throw new Error(`no colour "${ch}"`);
      return ch;
    });
  });
};

const icons = {};

// A cut stone with a bolt struck through it.
icons['thunder-stone'] = fromRows([
  '................',
  '................',
  '....oooooooo....',
  '...olllllbbbo...',
  '..olllllboobbo..',
  '..ollllboobbbo..',
  '..olllboobbbbo..',
  '..ollboooobbso..',
  '..olbbboobbsso..',
  '...obboobbsso...',
  '...oboobbssso...',
  '....obbbssso....',
  '.....obssso.....',
  '......oooo......',
  '................',
  '................',
]);

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
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
};
const png = (grid) => {
  const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
  grid.forEach((row, y) => {
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

for (const [name, grid] of Object.entries(icons)) {
  writeFileSync(new URL(`${name}.png`, OUT), png(grid));
  console.log(`icons/${name}.png`);
}
