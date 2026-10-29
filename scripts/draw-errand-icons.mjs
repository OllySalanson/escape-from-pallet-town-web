// Draws the errand icons (`src/game/hub/errands.ts`) into public/assets/icons.
//
//   node scripts/draw-errand-icons.mjs
//
// Each is a thing somebody at base is waiting on, drawn on the ground as well
// as in the pack, so which one it is has to read at 16px across a clearing:
// Oak's parcel in brown paper and string, Joy's white bag with the Center's
// red cross, Brock's crate in steel-banded wood with a grey stone on it, Bill's
// amber with something dark inside, the Safari Warden's gold teeth on their
// pink plate, and the captain's ship's log in navy with a gold anchor - and
// the "!" bubble the favours list marks somebody who wants a word with.
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
  // brown paper, string, a label
  P: hex('d6a866'), p: hex('b2823f'), d: hex('7f5a2b'), w: hex('f4efe2'), x: hex('c9c1ad'),
  // the Center's white and red
  W: hex('fbf8ef'), i: hex('d3cbb8'), r: hex('d94848'), R: hex('a83030'), k: hex('5a3b22'), B: hex('e2b65c'),
  // wood and steel
  T: hex('c08a4e'), t: hex('8f6131'), u: hex('5f3f1f'), s: hex('7d8794'), S: hex('b9c2cc'), g: hex('9aa1a8'), G: hex('5e656d'),
  // amber, and gold
  a: hex('e8962e'), A: hex('f6c45a'), Y: hex('fde7a0'), m: hex('b5641b'), n: hex('4a2a14'),
  // a denture's gum
  q: hex('ef8fa4'), Q: hex('c25c76'),
  // a ship's log's navy cloth
  N: hex('3d5d92'), v: hex('283f68'), V: hex('6489c2'),
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

// Oak's parcel: brown paper, tied with string, a white label with a red stamp.
icons['oaks-parcel'] = outline(
  fromRows([
    '................',
    '................',
    '................',
    '..PPPPPPwPPPPP..',
    '.PPPPPPPwPPPPPP.',
    '.PPPPPPPwPPPPPp.',
    '.wwwwwwwwwwwwwp.',
    '.ppppppppwppppp.',
    '.pWWWWWppwppppd.',
    '.pWrrWWppwppppd.',
    '.pWWWWWppwppppd.',
    '.ppppppppwppppd.',
    '.dddddddddxdddd.',
    '................',
    '................',
    '................',
  ]),
);

// Joy's medicine bag: a white doctor's bag, its clasp, the Center's red cross.
icons['medicine-bag'] = outline(
  fromRows([
    '................',
    '................',
    '.....kkkkkk.....',
    '....k......k....',
    '...WWWWWWWWWW...',
    '..WWWWWBBWWWWi..',
    '..iiiiiiiiiiii..',
    '..WWWWWrrWWWWi..',
    '..WWWWWrrWWWWi..',
    '..WWWrrrrrrWWi..',
    '..WWWrrrrrrWWi..',
    '..WWWWWrrWWWWi..',
    '..WWWWWrrWWWWi..',
    '..iiiiiiiiiiii..',
    '................',
    '................',
  ]),
);

// Brock's crate: planks in steel bands, and a grey stone stencilled on its face.
icons['brocks-crate'] = outline(
  fromRows([
    '................',
    '..SSSSSSSSSSSS..',
    '..sTTTTTTTTTTs..',
    '..sttttttttttG..',
    '..sTTTTggTTTTG..',
    '..sTTTgSSgTTTG..',
    '..SSSgSSggSSSG..',
    '..sTTgSggGgTTG..',
    '..sTTTgGGgTTTG..',
    '..sttttggttttG..',
    '..sTTTTTTTTTTG..',
    '..sttttttttttG..',
    '..sTTTTTTTTTTG..',
    '..GGGGGGGGGGGG..',
    '................',
    '................',
  ]),
);

// Old Amber: a lump of resin, lit from the top left, with something dark in it.
icons['old-amber'] = outline(
  fromRows([
    '................',
    '................',
    '......AAAa......',
    '....AYYAAaaa....',
    '...AYYAAaaaam...',
    '...AYAAaanaam...',
    '..AAAAannnaaam..',
    '..AAAanannaaam..',
    '..aAaaannaaamm..',
    '..aaaannananm...',
    '...aaaaanaamm...',
    '...maaaaaamm....',
    '....mmmmmmm.....',
    '................',
    '................',
    '................',
  ]),
);

// The Safari Warden's gold teeth: FireRed's own lost property, a plate of
// gold teeth on a pink gum, upper row over lower.
icons['gold-teeth'] = outline(
  fromRows([
    '................',
    '................',
    '................',
    '....qqqqqqqq....',
    '..qqqqQqqQqqqq..',
    '.qqYAmYAmYAmYqq.',
    '.qYAmYAmYAmYAmq.',
    '.qaamaamaamaamQ.',
    '..nnnnnnnnnnnn..',
    '..nYAmYAmYAmYn..',
    '.qaamaamaamaamQ.',
    '.qqqqQqqqqQqqqQ.',
    '...qqqqqqqqqQ...',
    '................',
    '................',
    '................',
  ]),
);

// The captain's ship's log: navy cloth boards, a gold anchor, the pages' edge.
icons['ships-log'] = outline(
  fromRows([
    '................',
    '................',
    '...VVVVVVVVVV...',
    '...NNNNNNNNNNW..',
    '...NNNNYNNNNNW..',
    '...NNNYAYNNNNW..',
    '...NNNNANNNNNW..',
    '...NNAAAAANNNW..',
    '...NNNNANNNNNW..',
    '...NNNNANNNNNW..',
    '...NANNANNANNW..',
    '...NNAAAAANNNW..',
    '...vvvvvvvvvvW..',
    '....iiiiiiiiii..',
    '................',
    '................',
  ]),
);

// Somebody wants a word: the "!" bubble that stands over a favour's giver in
// the harbour (`BaseScene.markKeeper`), for the favours list's rows of people
// who have not yet said what they want.
icons['favour-ask'] = outline(
  fromRows([
    '................',
    '................',
    '.....WWWWWW.....',
    '....WWWWWWWW....',
    '....WWWrrWWW....',
    '....WWWrrWWW....',
    '....WWWrrWWW....',
    '....WWWrrWWW....',
    '....WWWWWWWW....',
    '....WWWrrWWW....',
    '....WWWWWWWW....',
    '.....WWWWWW.....',
    '.......WW.......',
    '.......W........',
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
