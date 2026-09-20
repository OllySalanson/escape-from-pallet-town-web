// Draws the four pack icons into public/assets/icons.
//
//   node scripts/draw-pack-icons.mjs
//
// 16x16 RGBA, the same one shared outline (#241f2e) and shade/base/light triple
// per hue as the rest of the set (see ASSET_PROVENANCE.md). Drawn in code so the
// output is byte-stable and a colour can be changed in one place.
//
// The four read as one family at a glance and apart at a second look, because
// that is the decision the loadout screen is asking about: they are the same
// silhouette in four sizes, each a little taller and a little more built than
// the last - oilcloth satchel, canvas raid pack, framed ranger pack, steel
// hauler frame - so a player can tell which one they are wearing without
// reading the word beside it.
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
  // oilcloth: the smallest pack, drab and soft
  d: hex('7a6a4f'), D: hex('9c8a68'), e: hex('5b4e39'),
  // canvas: the pack the game starts you in
  g: hex('4f7d5c'), G: hex('6fa37c'), h: hex('3a5c44'),
  // ranger canvas, a warmer and better-made green
  j: hex('3f6f8d'), J: hex('5f97b6'), k: hex('2d5069'),
  // hauler: steel and strap
  s: hex('6d7684'), S: hex('9aa4b2'), t: hex('454c58'),
  // straps and buckles, shared by all four
  b: hex('6b4a2a'), B: hex('b98a4e'), m: hex('c9ba8f'),
};

const blank = () => Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
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

const icons = {};

// The Satchel: twelve squares of oilcloth, a flap and one buckle. Squat, and
// deliberately the least of them.
icons.satchel = fromRows([
  '................',
  '................',
  '................',
  '.....oooooo.....',
  '....oDDDDDDo....',
  '...oDDDDDDDDo...',
  '...oDDDDDDDDo...',
  '...oddddddddo...',
  '...odbbBbbddo...',
  '...oddddddddo...',
  '...odddddddeo...',
  '...oeeeeeeeeo...',
  '....oooooooo....',
  '................',
  '................',
  '................',
]);

// The Raid pack: eighteen squares of canvas, a lid, two straps and a side
// pocket. The shape the other three are read against.
icons['raid-pack'] = fromRows([
  '................',
  '......oooo......',
  '.....oBmmBo.....',
  '....ooooooooo...',
  '...oGGGGGGGGo...',
  '...oGGGGGGGGo...',
  '...oggggggggo...',
  '...obBbbbBbgo...',
  '...oggggggggo...',
  '...oggggggggo...',
  '...ogghggggho...',
  '...ogghggggho...',
  '...ohhhhhhhho...',
  '....oooooooo....',
  '................',
  '................',
]);

// The Ranger pack: twenty-four squares, a taller body, a lashed top and a
// second strap across it.
icons['ranger-pack'] = fromRows([
  '................',
  '......oooo......',
  '.....oBmmBo.....',
  '....ooooooooo...',
  '...oJJJJJJJJo...',
  '...oJJJJJJJJo...',
  '...ojjjjjjjjo...',
  '...obBbbbBbjo...',
  '...ojjjjjjjjo...',
  '...ojjjjjjjjo...',
  '...obBbbbBbjo...',
  '...ojjkjjjjko...',
  '...ojjkjjjjko...',
  '...okkkkkkkko...',
  '....oooooooo....',
  '................',
]);

// The Hauler frame: thirty squares on a steel frame that stands proud of the
// body at the top and the foot. Nothing else in the set is this tall.
icons['hauler-frame'] = fromRows([
  '....o......o....',
  '....oo....oo....',
  '....otooooto....',
  '...oSSSSSSSSo...',
  '...oSSSSSSSSo...',
  '...ossssssso....',
  '...obBbbbBbso...',
  '...osssssssso...',
  '...osssssssso...',
  '...obBbbbBbso...',
  '...osssssssso...',
  '...osstssssso...',
  '...osstssssso...',
  '...ottttttto....',
  '....ot....to....',
  '....o......o....',
]);

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
