// Draws the scrip icon into public/assets/icons.
//
//   node scripts/draw-scrip-icon.mjs
//
// Money is the one item in the bag that is neither a supply, a material nor
// gear, so it is drawn to read as none of them at a glance: a banded bundle of
// notes rather than a tin, a crate or a coil.
//
// 16x16 RGBA, one shared outline (#241f2e) and a shade/base/light triple per
// hue, the same rules as the rest of the set (see ASSET_PROVENANCE.md). Drawn
// in code from character art and small shapes, so the output is byte-stable
// and a colour can be changed in one place.
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
  // glass
  L: hex('cdeef5'), G: hex('7fb4c6'), w: hex('ffffff'),
  // filament / amber / flame
  c: hex('f2a03d'), a: hex('e8a33a'), A: hex('f7d36b'), r: hex('d9622b'),
  // brass, wood
  k: hex('6b4a2a'), B: hex('b98a4e'), b: hex('8a6234'), W: hex('d8b070'),
  // steel
  s: hex('7d8794'), S: hex('b9c2cc'), t: hex('4c5563'),
  // copper
  m: hex('a4552a'), M: hex('e08a4d'), n: hex('f2b884'),
  // rope
  q: hex('9c7b4e'), Q: hex('d9bd8a'), u: hex('6d5233'),
  // linen
  l: hex('f4efe2'), i: hex('c9c1ad'), v: hex('5b8fd6'), V: hex('3b64a8'),
  // scrip: water-stained league notes, and the band round the bundle
  p: hex('cfd8b6'), P: hex('e8eed2'), d: hex('9aa77e'), e: hex('7d8a63'),
  z: hex('9c5b3a'), Z: hex('c47a4e'),
};

const blank = () => Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
const put = (grid, x, y, key) => {
  if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) grid[y][x] = key;
};
const fromRows = (rows) => {
  const grid = blank();
  if (rows.length !== SIZE) throw new Error(`expected ${SIZE} rows, got ${rows.length}`);
  rows.forEach((row, y) => {
    if (row.length !== SIZE) throw new Error(`row ${y} is ${row.length} wide: "${row}"`);
    [...row].forEach((ch, x) => {
      if (ch !== '.') {
        if (!C[ch]) throw new Error(`no colour "${ch}"`);
        grid[y][x] = ch;
      }
    });
  });
  return grid;
};
/** Fills a shape, then outlines every empty pixel that touches it. */
const outline = (grid) => {
  const edge = [];
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      if (grid[y][x] !== null) continue;
      const touches = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(
        ([dx, dy]) => grid[y + dy]?.[x + dx] != null && grid[y + dy][x + dx] !== 'o',
      );
      if (touches) edge.push([x, y]);
    }
  }
  edge.forEach(([x, y]) => put(grid, x, y, 'o'));
  return grid;
};
const disc = (grid, cx, cy, radius, pick) => {
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.hypot(dx, dy);
      if (d <= radius) {
        const key = pick(dx, dy, d);
        if (key) put(grid, x, y, key);
      }
    }
  }
};
const rect = (grid, x0, y0, x1, y1, key) => {
  for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) put(grid, x, y, key);
};

const icons = {};

// Two notes, the back one offset up and left, with a seal printed on the face.
//
// Flat, square-cornered and wider than tall, because that is what reads as
// paper at sixteen pixels. Every earlier draft shaded the body like a solid
// object and came out as a tin or a jar - which is what every other icon in
// the Other pocket already is. The only shading left is the one row along each
// note's foot that makes it a sheet lying on another sheet.
icons['scrip'] = outline(
  fromRows([
    '................',
    '..PPPPPPPPPPP...',
    '..PPPPPPPPPPP...',
    '..PddddddddPP...',
    '..PP.........PP.',
    '..PPPPPPPPPPPPP.',
    '...PPPPPPPPPPPP.',
    '...PPZZZZZZPPPP.',
    '...PPZzzzzZPPPP.',
    '...PPZzZZzZPPPP.',
    '...PPZzzzzZPPPP.',
    '...PPZZZZZZPPPP.',
    '...PPPPPPPPPPPP.',
    '...PdddddddddPP.',
    '................',
    '................',
  ]),
);

// PNG, written by hand so the script needs no dependency.
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
