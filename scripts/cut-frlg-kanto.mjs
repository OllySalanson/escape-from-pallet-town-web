// Cuts Kanto's own outdoor art out of The Spriters Resource's FireRed/LeafGreen
// map renders, onto `public/assets/frlg-kanto.png`.
//
//   mkdir -p /tmp/frlg-kanto && for id in 3736 3737 3764 3769 3777 3698; do
//     curl -sSL -A "Mozilla/5.0" -o /tmp/frlg-kanto/$id.png \
//       "https://www.spriters-resource.com/media/assets/4/$id.png"; done
//   node scripts/cut-frlg-kanto.mjs /tmp/frlg-kanto
//
// The five renders are Route 1 (3736), Route 2 (3737), Route 22 (3764), Cerulean
// City (3769) and Viridian City (3777): every one is the real map drawn out tile
// for tile, which is what makes them the right thing to cut from. A tile sheet
// holds each piece once and says nothing about how the game puts them together;
// a map shows the conifer forest's overlap rows, the fence's corners and the
// paving's inner notches exactly where FireRed uses them. 3698 is the "Overworld
// NPCs" sheet the character designs were cut from, and gives the Cut tree.
//
// None of the sources is committed: the publisher's terms object to their
// content being redistributed "in its original format", so what ships is cut
// and rearranged pieces, and `public/assets/ASSET_PROVENANCE.md` credits the
// origin. This script is the record of exactly which cells those are.
//
// Two things happen to every piece on the way.
//
// **The colour is put on the other sheets' footing.** A GBA colour is five bits a
// channel, and there are two ways to write one as eight: these renders scale
// (`x * 255 / 31`, so FireRed's grass is #73cda4) and `frlg-tiles.png`, every
// other FireRed cut in this repository, shifts (`x << 3`, #70c8a0). The same
// grass written both ways meets in a visible seam, so every channel is read back
// to its five bits and shifted. That is exact: it is the colour the Game Boy
// Advance was showing, written the way the rest of the game writes it.
//
// **The ground is lifted out of anything that stands on it.** A render is a
// picture, so a fence post comes with the grass it was standing on painted in
// behind it. A map here draws ground and what stands on it in two layers, so a
// piece that stands on ground (`key`) has the ground made transparent: each of
// its cells is compared with every ground tile the renders use there, and the
// pixels the best match shares with it are the ground. What is left is the post,
// the tree or the roof, and it stands on whatever the map puts under it.
//
// The script writes the sheet and `src/game/world/generated/kantoPieces.ts`, which
// is the only thing in the game that knows where a piece landed on it.
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readPng, writePng } from '../tools/tileset/tileSheet.mjs';

const TILE = 16;
const SHEET_COLUMNS = 20;

/** Every render's map panel starts at the same place: under the title bar, inside the frame. */
const MAP_ORIGIN = [8, 24];

const SOURCES = {
  route1: '3736',
  route2: '3737',
  route22: '3764',
  cerulean: '3769',
  viridian: '3777',
  npcs: '3698',
};

/**
 * The ground a standing piece may have been painted over: FireRed's four grass
 * tiles (the one its routes are mostly made of and the three with blades in),
 * and the town paving.
 */
const GROUNDS = [
  { from: 'route1', at: [2, 3] },
  { from: 'route1', at: [2, 2] },
  { from: 'route1', at: [3, 2] },
  { from: 'route1', at: [3, 3] },
  { from: 'viridian', at: [21, 5] },
  { from: 'viridian', at: [20, 7] },
];

/**
 * Every piece, in the order it is laid on the sheet.
 *
 * `at` is a cell on the source's own map grid and `size` is in tiles. `key` lifts
 * the ground out (see the top of this file). `px` names a piece by pixel instead,
 * for the NPC sheet, which is not a map.
 */
const PIECES = [
  // --- Ground ------------------------------------------------------------------
  // FireRed's grass is four tiles, not one: the plain green and three with blades
  // drawn in, laid by hand in a loose mix. A lawn of the plain one alone is the
  // flat mat the earlier maps were.
  { name: 'grass.plain', from: 'route1', at: [2, 3] },
  { name: 'grass.blades', from: 'route1', at: [2, 2] },
  { name: 'grass.bladesEast', from: 'route1', at: [3, 2] },
  { name: 'grass.tuft', from: 'route1', at: [3, 3] },
  // Viridian's paving, with its dotted kerb: the thirteen cells a ground needs,
  // read off the one town that uses every one of them.
  { name: 'paving.fill', from: 'viridian', at: [21, 5] },
  { name: 'paving.n', from: 'viridian', at: [21, 2] },
  { name: 'paving.s', from: 'viridian', at: [23, 8] },
  { name: 'paving.w', from: 'viridian', at: [20, 5] },
  { name: 'paving.e', from: 'viridian', at: [22, 5] },
  { name: 'paving.nw', from: 'viridian', at: [20, 2] },
  { name: 'paving.ne', from: 'viridian', at: [22, 2] },
  { name: 'paving.sw', from: 'viridian', at: [39, 11] },
  { name: 'paving.se', from: 'viridian', at: [41, 11] },
  { name: 'paving.innerNw', from: 'viridian', at: [20, 17] },
  { name: 'paving.innerNe', from: 'viridian', at: [22, 6] },
  { name: 'paving.innerSw', from: 'viridian', at: [20, 19] },
  { name: 'paving.innerSe', from: 'viridian', at: [22, 8] },

  // --- The Kanto conifer ---------------------------------------------------------
  // A tree is two tiles wide and three tall - a tip, a body and a base - and a
  // wood of them stacks on a two-row period: the base of one tree is the row the
  // tip of the next is drawn in. Every cell of a wood is one of these fourteen,
  // chosen by which trees stand round it (`kantoTileset.ts`). The tip is drawn
  // over the grass above the wood, which the player walks on: FireRed lets you.
  { name: 'tree.tipWest', from: 'route1', at: [8, 3], key: true },
  { name: 'tree.tipEast', from: 'route1', at: [9, 3], key: true },
  { name: 'tree.bodyEdgeWest', from: 'route1', at: [14, 0], key: true },
  { name: 'tree.bodyEdgeEast', from: 'route1', at: [9, 0], key: true },
  { name: 'tree.bodyWest', from: 'route1', at: [0, 0] },
  { name: 'tree.bodyEast', from: 'route1', at: [1, 0] },
  { name: 'tree.overlapEdgeWest', from: 'route1', at: [22, 3], key: true },
  { name: 'tree.overlapEdgeEast', from: 'route1', at: [1, 3], key: true },
  { name: 'tree.overlapWest', from: 'route1', at: [0, 1] },
  { name: 'tree.overlapEast', from: 'route1', at: [1, 1] },
  { name: 'tree.baseEdgeWest', from: 'route1', at: [14, 1], key: true },
  { name: 'tree.baseEdgeEast', from: 'route1', at: [9, 1], key: true },
  { name: 'tree.baseWest', from: 'route1', at: [2, 1], key: true },
  { name: 'tree.baseEast', from: 'route1', at: [3, 1], key: true },

  // --- Fences --------------------------------------------------------------------
  // The grey post-and-rail every Kanto town is fenced with. A vertical run is drawn
  // on one side of its tile or the other, and FireRed picks the side that meets
  // the corner it runs into.
  { name: 'fence.run', from: 'route1', at: [2, 36], key: true },
  { name: 'fence.west', from: 'route22', at: [2, 5], key: true },
  { name: 'fence.east', from: 'route22', at: [14, 5], key: true },
  { name: 'fence.nw', from: 'route22', at: [2, 4], key: true },
  { name: 'fence.ne', from: 'route1', at: [11, 36], key: true },
  { name: 'fence.sw', from: 'route22', at: [2, 12], key: true },
  { name: 'fence.se', from: 'route22', at: [14, 12], key: true },
  // Route 2's timber posts: a paddock rather than a town.
  { name: 'posts.corner', from: 'route2', at: [12, 2], key: true },
  { name: 'posts.run', from: 'route2', at: [13, 2], key: true },
  { name: 'posts.column', from: 'route2', at: [12, 3], key: true },

  // --- Rock ------------------------------------------------------------------------
  // A rock mound, as FireRed draws Diglett's Cave: a rim two tiles deep at the top,
  // a face two tiles deep at the foot, and a cave mouth that can be cut into the
  // foot. Any mound four wide and five deep is these cells.
  { name: 'rock', from: 'route2', at: [13, 6], size: [8, 6], key: true },

  // --- Standing things ---------------------------------------------------------------
  { name: 'shrub', from: 'route22', at: [3, 5], key: true },
  { name: 'flowers', from: 'route1', at: [19, 2], key: true },
  { name: 'signTown', from: 'viridian', at: [23, 1], key: true },
  { name: 'signTips', from: 'route1', at: [9, 31], key: true },
  { name: 'signGym', from: 'viridian', at: [32, 9], size: [1, 2], key: true },

  // --- Buildings --------------------------------------------------------------------
  // Viridian's own: the Pokemon Center, the Mart, the Gym and the two green-roofed
  // houses, one of them with its window boxes.
  { name: 'pokemonCenter', from: 'viridian', at: [24, 22], size: [5, 5], key: true },
  { name: 'pokeMart', from: 'viridian', at: [34, 16], size: [4, 4], key: true },
  { name: 'gym', from: 'viridian', at: [33, 6], size: [6, 5], key: true },
  { name: 'house', from: 'viridian', at: [24, 8], size: [5, 4], key: true },
  { name: 'houseFlowers', from: 'viridian', at: [24, 15], size: [5, 5], key: true },
  // Route 2's: the blue-roofed cottage, and the two gatehouses on the way to the
  // forest, the long one with its steps and the short one.
  { name: 'cottage', from: 'route2', at: [14, 20], size: [5, 3], key: true },
  { name: 'forestGate', from: 'route2', at: [2, 45], size: [8, 8], key: true },
  { name: 'routeGate', from: 'route2', at: [16, 41], size: [6, 7], key: true },
  // Route 22's: the Pokemon League Front Gate.
  { name: 'leagueGate', from: 'route22', at: [4, 0], size: [9, 7], key: true },
];

const [sourceDir] = process.argv.slice(2);
if (!sourceDir) {
  console.error(`usage: node scripts/cut-frlg-kanto.mjs <directory holding ${Object.values(SOURCES).map((id) => `${id}.png`).join(' ')}>`);
  process.exit(1);
}
const images = new Map();
for (const file of Object.values(SOURCES)) {
  const path = join(sourceDir, `${file}.png`);
  if (!existsSync(path)) {
    console.error(`missing ${path} - fetch it first (see the top of this script)`);
    process.exit(1);
  }
  images.set(file, toGbaFooting(readPng(path)));
}

/** Every channel read back to its five GBA bits and written as `bits << 3`. */
function toGbaFooting(image) {
  for (let i = 0; i < image.data.length; i += 4) {
    for (let c = 0; c < 3; c += 1) image.data[i + c] = Math.round((image.data[i + c] * 31) / 255) << 3;
  }
  return image;
}

const blank = (width, height) => ({ width, height, data: Buffer.alloc(width * height * 4) });

function cell(from, [x, y]) {
  const image = images.get(SOURCES[from]);
  const out = blank(TILE, TILE);
  const [ox, oy] = MAP_ORIGIN;
  for (let py = 0; py < TILE; py += 1) {
    image.data.copy(
      out.data,
      py * TILE * 4,
      ((oy + y * TILE + py) * image.width + ox + x * TILE) * 4,
      ((oy + y * TILE + py) * image.width + ox + x * TILE + TILE) * 4,
    );
  }
  return out;
}

const grounds = GROUNDS.map((ground) => cell(ground.from, ground.at));

/**
 * Makes the ground behind a standing cell transparent: the ground tile that
 * shares the most pixels with the cell is the one it was painted over, and
 * every pixel it shares is ground rather than post or leaf.
 */
function liftGround(tile) {
  let best = null;
  let bestShared = 0;
  for (const ground of grounds) {
    let shared = 0;
    for (let i = 0; i < tile.data.length; i += 4) {
      if (
        tile.data[i] === ground.data[i] &&
        tile.data[i + 1] === ground.data[i + 1] &&
        tile.data[i + 2] === ground.data[i + 2]
      ) {
        shared += 1;
      }
    }
    if (shared > bestShared) {
      best = ground;
      bestShared = shared;
    }
  }
  // A cell with less ground than a sliver in it is all post or all leaf: a
  // handful of coincidences is not a background, and lifting them would put
  // holes in a roof.
  if (!best || bestShared < 12) return tile;
  for (let i = 0; i < tile.data.length; i += 4) {
    if (
      tile.data[i] === best.data[i] &&
      tile.data[i + 1] === best.data[i + 1] &&
      tile.data[i + 2] === best.data[i + 2]
    ) {
      tile.data[i + 3] = 0;
    }
  }
  return tile;
}

function cutPiece(piece) {
  const [w, h] = piece.size ?? [1, 1];
  const out = blank(w * TILE, h * TILE);
  for (let r = 0; r < h; r += 1) {
    for (let q = 0; q < w; q += 1) {
      let tile = cell(piece.from, [piece.at[0] + q, piece.at[1] + r]);
      // Only a piece's outer ring can have ground showing through it: a roof or a
      // wall inside a building is never lifted, whatever colour it happens to share.
      const onRing = r === 0 || q === 0 || r === h - 1 || q === w - 1;
      if (piece.key && onRing) tile = liftGround(tile);
      for (let py = 0; py < TILE; py += 1) {
        tile.data.copy(out.data, ((r * TILE + py) * out.width + q * TILE) * 4, py * TILE * 4, (py + 1) * TILE * 4);
      }
    }
  }
  return { name: piece.name, width: w, height: h, image: out };
}

// Cut tree: the first frame of the Miscellaneous block on the NPC sheet, keyed
// out of the sheet's orange ("used") backing as the character designs are.
function cutTree() {
  const image = images.get(SOURCES.npcs);
  const out = blank(TILE, TILE);
  const [sx, sy] = CUT_TREE_PX;
  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      const s = ((sy + y) * image.width + sx + x) * 4;
      const d = (y * TILE + x) * 4;
      const [r, g, b] = [image.data[s], image.data[s + 1], image.data[s + 2]];
      if (isBacking(r, g, b)) continue;
      out.data[d] = r;
      out.data[d + 1] = g;
      out.data[d + 2] = b;
      out.data[d + 3] = 255;
    }
  }
  return { name: 'cutTree', width: 1, height: 1, image: out };
}
/** Where the Cut tree's first frame sits on the NPC sheet, found by eye and checked by the render. */
const CUT_TREE_PX = [9, 2556];
/** The sheet's orange "used" backing, on the same footing as everything else. */
const isBacking = (r, g, b) => r >= 224 && g >= 112 && g <= 160 && b <= 72;

const cut = [...PIECES.map(cutPiece), cutTree()];

// Shelf packing: tallest first, so a building's rows are not split by singles.
const order = [...cut].sort((a, b) => b.height - a.height || b.width - a.width);
const placed = new Map();
let shelfTop = 0;
let shelfHeight = 0;
let cursor = 0;
for (const piece of order) {
  if (cursor + piece.width > SHEET_COLUMNS) {
    shelfTop += shelfHeight;
    shelfHeight = 0;
    cursor = 0;
  }
  placed.set(piece.name, { column: cursor, row: shelfTop, width: piece.width, height: piece.height });
  cursor += piece.width;
  shelfHeight = Math.max(shelfHeight, piece.height);
}
const rows = shelfTop + shelfHeight;
const sheet = blank(SHEET_COLUMNS * TILE, rows * TILE);
for (const piece of cut) {
  const at = placed.get(piece.name);
  for (let y = 0; y < piece.image.height; y += 1) {
    piece.image.data.copy(
      sheet.data,
      ((at.row * TILE + y) * sheet.width + at.column * TILE) * 4,
      y * piece.image.width * 4,
      (y + 1) * piece.image.width * 4,
    );
  }
}
writePng('public/assets/frlg-kanto.png', sheet);

const entries = cut
  .map((piece) => {
    const at = placed.get(piece.name);
    return `  '${piece.name}': { column: ${at.column}, row: ${at.row}, width: ${at.width}, height: ${at.height} },`;
  })
  .join('\n');
writeFileSync(
  'src/game/world/generated/kantoPieces.ts',
  `// Generated by scripts/cut-frlg-kanto.mjs from The Spriters Resource's
// FireRed/LeafGreen map renders. Do not edit: re-run the script.

/** The sheet Kanto's own outdoor pieces are drawn from. */
export const KANTO_SHEET = {
  imagePath: 'assets/frlg-kanto.png',
  columns: ${SHEET_COLUMNS},
  rows: ${rows},
} as const;

/** Where each named piece sits on the sheet, in tiles. */
export const KANTO_PIECES = {
${entries}
} as const;

export type KantoPieceName = keyof typeof KANTO_PIECES;
`,
);
console.log(`public/assets/frlg-kanto.png  ${SHEET_COLUMNS}x${rows} tiles, ${cut.length} pieces`);
