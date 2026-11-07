// Draws the vale's secret finds into public/assets/icons: the three pieces of
// the torn chart and FireRed's two fossils (`src/game/world/secrets.ts`).
//
//   node scripts/draw-relic-icons.mjs
//
// 16x16 RGBA, the set's one outline (#241f2e) and a shade/base/light triple
// per hue (see ASSET_PROVENANCE.md). Each chart piece is a different torn
// corner of the same chart - parchment, sea and the red dotted course - so
// three in the pack read as parts of one thing; each fossil is a stone with
// its own shell in it, the Helix's spiral and the Dome's ribbed cap.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const SIZE = 16;
const OUT = new URL('../public/assets/icons/', import.meta.url);

const hex = (value) => [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16), 255];
const C = {
  o: hex('241f2e'),
  // parchment
  P: hex('f2e3b6'), p: hex('d9c28a'), e: hex('b39a5e'),
  // sea
  V: hex('5b8fd6'), v: hex('9cc3ea'),
  // the course, in red ink
  r: hex('d9442b'),
  // stone
  t: hex('6b604f'), s: hex('9a8d7a'), S: hex('c9bda5'), w: hex('e8dfcc'),
  // shell
  h: hex('8a5a3a'), H: hex('c48a52'), n: hex('e6b77d'),
};

const charts = {
  // The moor's piece: the chart's top-left corner, torn along the right and the foot.
  'chart-piece-1': [
    'oooooooooooo....',
    'oPPPPPPPPPPPo...',
    'oPvvvPPPPPPPPo..',
    'oPvVvvPPrPPPPo..',
    'oPPvVvPPPrPPPPo.',
    'oPPPvvPPPPPrPPo.',
    'oPPPPPPPPPPPPrPo',
    'oPPPPPPPPPPPPPpo',
    'oPrPPPPPPPPPPppo',
    'oPPrPPPPPPPPpppo',
    'oPPPPPPPPPPppeo.',
    'oPPPPPrPPPppeeo.',
    'oPPPPPPPppeeoo..',
    'oPPPPPppeeoo....',
    'oppeeoooo.......',
    'ooooo...........',
  ],
  // The hollow's piece: a long strip from the middle, torn top and bottom.
  'chart-piece-2': [
    '................',
    '..o..o...o..o...',
    '.oPooPoooPooPo..',
    '.oPPPPPPPPPPPPo.',
    '.oPPPrPPPPvvPPo.',
    '.oPPPPrPPvVVvPo.',
    '.oPPPPPrPPvvPPo.',
    '.oPPPPPPPrPPPPo.',
    '.oPPPPPPPPPrPPo.',
    '.oPvvPPPPPPPPro.',
    '.ovVVvPPPPPPPPo.',
    '.oPvvPPPPPPPppo.',
    '.oppPPPPPPPppeo.',
    '.oeppppppppeeeo.',
    '..oeoeooeoooeo..',
    '...o.o..o...o...',
  ],
  // The fold's piece: the bottom-right corner, with the X where the course ends.
  'chart-piece-3': [
    '...........ooooo',
    '........ooooPPPo',
    '......ooPPPPPPPo',
    '....ooPPPPrPPPPo',
    '...oPPPPPPPPrPPo',
    '..oPPPPPPPPPPPPo',
    '.oPPvvPPPPPPrPPo',
    '.oPvVVvPPPPPPPPo',
    'oPPPvvPPPPPPrPPo',
    'oPPPPPPPPrPPPrPo',
    'oPPPPPPPPPrPrPPo',
    'oPPPPPPPPPPrPPPo',
    'oPPPPPPPPPrPrPPo',
    'oppPPPPPPrPPPrpo',
    'oeppppppppppppeo',
    'oooooooooooooooo',
  ],
};

const fossils = {
  // A spiral shell set in a rounded stone.
  'helix-fossil': [
    '................',
    '.....oooooo.....',
    '...oowSSSSwoo...',
    '..owSSoooooSSo..',
    '.oSSooHHnHHooSo.',
    '.oSoHHhhhhHHoSo.',
    'oSSoHhooooHnoSSo',
    'oSoHhohHHohHoSso',
    'oSoHhohoHohHosso',
    'oSoHhhoooohHosso',
    'oSSoHhhhhhHosSso',
    '.oSSoHHHHHoossSo',
    '.osSSooooossssto',
    '..ossssssssstto.',
    '...oottttttoo...',
    '.....oooooo.....',
  ],
  // A ribbed dome shell set in a flat stone.
  'dome-fossil': [
    '................',
    '................',
    '.....oooooo.....',
    '...ooHnnnnHoo...',
    '..oHnHHnnHHnHo..',
    '..oHHhHHHHhHHo..',
    '.oHhHHhHHhHHhHo.',
    '.oHhHhHHHHhHhHo.',
    '.ohhhhhhhhhhhho.',
    'oSoooooooooooooo',
    'oSwSSSSSSSSSSSSo',
    'oSSSSoSSSSSoSSso',
    'osSSSSSSSSSSSsso',
    'osssssssssssssto',
    '.ottttttttttttto',
    '..oooooooooooooo',
  ].map((row) => row.padEnd(SIZE, '.').slice(0, SIZE)),
};

const icons = Object.fromEntries(
  Object.entries({ ...charts, ...fossils }).map(([name, rows]) => {
    if (rows.length !== SIZE) throw new Error(`${name}: expected ${SIZE} rows`);
    return [
      name,
      rows.map((row, y) => {
        if (row.length !== SIZE) throw new Error(`${name} row ${y} is ${row.length} wide`);
        return [...row].map((ch) => {
          if (ch === '.') return null;
          if (!C[ch]) throw new Error(`${name}: no colour "${ch}"`);
          return ch;
        });
      }),
    ];
  }),
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
    row.forEach((key, x) => raw.set(key ? C[key] : [0, 0, 0, 0], base + 1 + x * 4));
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
