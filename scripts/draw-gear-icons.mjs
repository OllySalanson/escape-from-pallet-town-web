// Draws the held-item (gear) icons into public/assets/icons.
//
//   node scripts/draw-gear-icons.mjs
//
// Same rules as the rest of the set (see ASSET_PROVENANCE.md): 16x16 RGBA, one
// shared outline (#241f2e) and a shade/base/light triple per hue. Written as
// character art so a shape can be nudged a pixel without redrawing it, and so
// the output is byte-stable.
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
  // roast meat, for the leftovers
  m: hex('7f3f18'), M: hex('c06a30'), E: hex('e8a35c'),
  // band red, with a cream stripe
  d: hex('96291f'), D: hex('d94f3d'), e: hex('f08c74'), f: hex('f4efe2'),
  // orb purple, with its highlight
  p: hex('4b2f78'), P: hex('8a5fc4'), q: hex('c7a6f0'), w: hex('ffffff'),
  // claw bone, with the amber sheath it sits in
  n: hex('8d8671'), N: hex('c9c1ad'), l: hex('f4efe2'),
  a: hex('a85e14'), A: hex('f0a02e'),
  // seed green, as FireRed's Miracle Seed is a green bud with a leaf on it
  s: hex('2f6b2a'), S: hex('4fa83d'), t: hex('9be070'),
  // never-melt ice, in FireRed's own icon palette
  // (`graphics/items/icon_palettes/never_melt_ice.pal`, pret/pokefirered at 037335f)
  i: hex('f6ffff'), j: hex('def6ff'), k: hex('a4d5e6'), K: hex('73a4c5'), z: hex('317ba4'),
  // charcoal, in FireRed's own icon palette
  // (`graphics/items/icon_palettes/charcoal.pal`, pret/pokefirered at 037335f)
  c: hex('313131'), g: hex('414141'), h: hex('626262'), H: hex('8b8b8b'), b: hex('bdbdbd'),
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
  edge.forEach(([x, y]) => {
    if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) grid[y][x] = 'o';
  });
  return grid;
};

const icons = {};

// Leftovers: a drumstick, half eaten. Food that is still worth something is the
// whole idea, and a drumstick is the one food shape that survives sixteen
// pixels - an apple with a bite out of it reads as an apple.
icons.leftovers = outline(
  fromRows([
    '................',
    '......EEEEE.....',
    '....EEMMMMME....',
    '...EMMMMMMMME...',
    '..EMMMMMMMMMME..',
    '..EMMMMMMMMMMm..',
    '..mMMMMMMMMMmm..',
    '...mMMMMMMMmm...',
    '....NNmmmmm.....',
    '...lNNn.........',
    '...lNNn.........',
    '..lNNNNl........',
    '..lNNNNl........',
    '..lNNNNl........',
    '...llll.........',
    '................',
  ]),
);

// Focus Band: a headband with a cream stripe, knotted, with its two tails
// hanging from the knot.
icons['focus-band'] = outline(
  fromRows([
    '................',
    '................',
    '................',
    '...eeeeeeeeee...',
    '..dDDDDDDDDDDd..',
    '..dDDDDDDDDDDd..',
    '..dffffffffffd..',
    '..dDDDDDDDDDDd..',
    '..dDDDDDDDDDDd..',
    '...dddDDDDddd...',
    '......dDDd......',
    '.....dDDDDd.....',
    '....dDDddDDd....',
    '....dDd..dDd....',
    '.....d....d.....',
    '................',
  ]),
);

// Life Orb: a dark sphere with a hard highlight and a lit rim.
icons['life-orb'] = outline(
  fromRows([
    '................',
    '.....qqqq.......',
    '...qqPPPPqq.....',
    '..qPwwPPPPPq....',
    '..qPwwPPPPPPq...',
    '.qPPPPPPPPPPPq..',
    '.qPPPPPPPPPPPq..',
    '.qPPPPPPPPPPpq..',
    '.qPPPPPPPPPppq..',
    '.qPPPPPPPPpppq..',
    '..qPPPPPPpppq...',
    '..qpPPPpppppq...',
    '...qppppppq.....',
    '.....qqqq.......',
    '................',
    '................',
  ]),
);

// Quick Claw: one talon, curving up and to the right out of the amber base it
// is set in, needle-fine at the tip.
icons['quick-claw'] = outline(
  fromRows([
    '................',
    '...........lll..',
    '.........lllNN..',
    '........llNNNn..',
    '.......lNNNn....',
    '......lNNNn.....',
    '.....lNNNn......',
    '....lNNNn.......',
    '....lNNn........',
    '...lNNn.........',
    '...lNNn.........',
    '...lNNn.........',
    '..aAAAAa........',
    '.aAAAAAAa.......',
    '.aAAAAAAa.......',
    '..aaaaaa........',
  ]),
);

// The Miracle Seed: a round green bud, lit from the top left, with one leaf
// sprouting from its crown - FireRed's own icon redrawn at the set's size.
icons['miracle-seed'] = outline(
  fromRows([
    '................',
    '..........ss....',
    '.........sSSs...',
    '........sSStS...',
    '.......sSSts....',
    '......ss.s......',
    '.....sSSSSSs....',
    '....sStttSSSs...',
    '...sSttSSSSSSs..',
    '...sStSSSSSSSs..',
    '...sSSSSSSSSSs..',
    '...sSSSSSSSSss..',
    '....sSSSSSSss...',
    '.....ssSSsss....',
    '.......sss......',
    '................',
  ]),
);

// NeverMeltIce: a cluster of icicles standing up out of a frozen base, the
// tallest in the middle and two shorter either side, as FireRed's own 24x24
// icon draws it - redrawn at sixteen rather than resampled.
icons['never-melt-ice'] = outline(
  fromRows([
    '................',
    '......i.........',
    '.....iiK........',
    '.....ikK........',
    '.....ikK...i....',
    '..i..ikKz.iiK...',
    '.iiK.ikKz.ikK...',
    '.ikK.ikKzjikKz..',
    '.ikKjikKzjikKz..',
    '.ikKjikkKjjkKz..',
    '.ikkjjkkKjjkkz..',
    '.jkkjjkkkjjkkz..',
    '.jkkkjkkkkjkKz..',
    '.zKkkkkkkkkkKz..',
    '..zzzzzzzzzzz...',
    '................',
  ]),
);

// Charcoal: a stick of burnt wood lying corner to corner, its grain in streaks
// of grey and its broken end showing the light, as FireRed's own 24x24 icon
// draws it - redrawn at sixteen rather than resampled.
icons['charcoal'] = outline(
  fromRows([
    '................',
    '..........bb....',
    '.........hbHb...',
    '........hbHhHg..',
    '.......hHhHhhg..',
    '......hHhHhhHg..',
    '.....hHhHhhgHg..',
    '....hHhHhhgHg...',
    '...hHhhHhgHgg...',
    '..ghHhhhgHgc....',
    '..gHghhgHgc.....',
    '..ggcghHgc......',
    '..gcgggcc.......',
    '...ccgcc........',
    '....ccc.........',
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
