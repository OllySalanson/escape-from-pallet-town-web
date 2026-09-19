// Draws the TM and HM disc icons into public/assets/icons.
//
//   node scripts/draw-machine-icons.mjs
//
// 16x16 RGBA on the set's own rules (see ASSET_PROVENANCE.md): the shared
// outline #241f2e and a shade/base/light triple for the hue.
//
// One shape for all six, because that is what a machine is - a disc, lit from
// the top left, with the read head's hole through the middle - and the hue is
// the **type of the move it teaches**, which is how the games these are dressed
// as tell one disc from another. So a player learns the shape once and reads the
// colour thereafter: the green one is the Grass move.
//
// The HM is the same disc with a slot through it rather than a pinhole. It has
// to look like a different kind of object at a glance, because it is the one
// machine that is never used up.
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

const OUTLINE = hex('241f2e');

/**
 * The disc, as one template. `l`/`b`/`s` are the hue's light, base and shade;
 * `o` is the outline, and the middle two rows carry the hole the variants
 * differ in.
 */
const DISC = (hole) => [
  '................',
  '................',
  '......oooo......',
  '....ollllbbo....',
  '...olllllbbso...',
  '..ollllbbbbsso..',
  `..olllbbbbbsso..`,
  `..o${hole[0]}o..`,
  `..o${hole[1]}o..`,
  '..ollbbbbsssso..',
  '..olbbbbssssso..',
  '...obbbssssso...',
  '....obbsssso....',
  '......oooo......',
  '................',
  '................',
];

/** A TM: a pinhole two pixels across, in the middle of the plate. */
const PINHOLE = ['llllhhbbss', 'lllbhhbsss'];
/** An HM: a slot four across, so the two never read as the same object. */
const SLOT = ['lllhhhhbss', 'lllhhhhbss'];

const MACHINES = {
  // Grass, Ice, Steel, Ground, Flying and Fighting, in the type colours the
  // series uses, pulled towards this set's own contrast so each reads at 16px
  // against both the cream menus and the map.
  'tm09-bullet-seed': { hue: ['2f7a32', '57b348', '9ee07a'], hole: PINHOLE },
  'tm13-ice-beam': { hue: ['3f8aa8', '74c8dc', 'bdefff'], hole: PINHOLE },
  'tm23-iron-tail': { hue: ['5e6a7a', '97a3b2', 'd3dbe4'], hole: PINHOLE },
  'tm28-dig': { hue: ['8a6430', 'c9974a', 'e9c98a'], hole: PINHOLE },
  'tm40-aerial-ace': { hue: ['5a63a8', '8e97d8', 'c7cdf5'], hole: PINHOLE },
  'hm06-rock-smash': { hue: ['8f3a2c', 'cf6a45', 'f0a482'], hole: SLOT },
};

const fromRows = (rows, palette) => {
  if (rows.length !== SIZE) throw new Error(`expected ${SIZE} rows, got ${rows.length}`);
  return rows.map((row, y) => {
    if (row.length !== SIZE) throw new Error(`row ${y} is ${row.length} wide: "${row}"`);
    return [...row].map((ch) => {
      if (ch === '.') return null;
      if (!palette[ch]) throw new Error(`no colour "${ch}"`);
      return palette[ch];
    });
  });
};

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
    row.forEach((colour, x) => {
      raw.set(colour ?? [0, 0, 0, 0], base + 1 + x * 4);
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

for (const [name, { hue, hole }] of Object.entries(MACHINES)) {
  const palette = { o: OUTLINE, h: OUTLINE, s: hex(hue[0]), b: hex(hue[1]), l: hex(hue[2]) };
  writeFileSync(new URL(`${name}.png`, OUT), png(fromRows(DISC(hole), palette)));
  console.log(`icons/${name}.png`);
}
