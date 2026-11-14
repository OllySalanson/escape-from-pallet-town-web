// Cuts FireRed's Cerulean Gym and Fuchsia Gym out of pret's FireRed
// disassembly, onto `public/assets/frlg-gyms.png`: what a room dressed as
// either gym is drawn with (`src/game/world/tileset/insideTileset.ts`, the
// `cerulean-gym` and `fuchsia-gym` styles).
//
//   git clone --filter=blob:none --no-checkout https://github.com/pret/pokefirered.git /tmp/pokefirered
//   git -C /tmp/pokefirered sparse-checkout set --no-cone 'data/tilesets/' 'data/layouts/'
//   git -C /tmp/pokefirered checkout 037335f4c725d7c9aecdac87066f2002b4bd7e14
//   node scripts/cut-frlg-gyms.mjs /tmp/pokefirered
//
// The checkout is never committed, and what ships is a cut: named pieces drawn
// out of the game's own metatiles and packed onto a new grid, as
// `cut-frlg-hideout.mjs` cuts the Rocket Hideout. `public/assets/ASSET_PROVENANCE.md`
// says where it comes from, and this script is the record of which metatile
// every piece is and which of its two layers are drawn.
//
// Both gyms are drawn with `gTileset_Building` and the gym's own secondary
// tileset (`CeruleanCity_Gym` and `FuchsiaCity_Gym` in `data/layouts/layouts.json`).
// Every piece is named by its metatile number, read off the gym's own layout.
//
// One piece is not as FireRed draws it. Fuchsia Gym's walls are invisible -
// FireRed's maze is walked into blind - and a room here is read by somebody
// who does not read, so its partitions are FireRed's own maze partitions, the
// Rocket Hideout's (`RocketHideout_B2F`), drawn in Fuchsia Gym's own colours:
// the hideout's palette 12 with its teal and grey swapped for the green and
// gold of the pillars along Fuchsia Gym's back wall (`RECOLOUR` below).
//
// The script writes the sheet, and `src/game/world/generated/gymPieces.ts`:
// where each piece landed, and each gym's own layout as the ground letters it
// is laid on and the piece FireRed draws at every cell, which
// `insideTileset.test.ts` holds the styles' drawing rules to.
//
// Colours are read back to the five bits a channel the Game Boy Advance shows
// and written `x << 3`, as every other `frlg-*.png` writes them.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { blank, readPalette, tilesetPair } from './gba.mjs';
import { writePng } from '../tools/tileset/tileSheet.mjs';

const PRET_COMMIT = '037335f4c725d7c9aecdac87066f2002b4bd7e14';
const TILE = 16;
const SHEET_COLUMNS = 16;

const pret = process.argv[2];
if (!pret) {
  console.error('usage: node scripts/cut-frlg-gyms.mjs <pokefirered checkout>');
  process.exit(2);
}
const head = execFileSync('git', ['-C', pret, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (head !== PRET_COMMIT) {
  console.error(`the checkout is at ${head}; this sheet is cut from ${PRET_COMMIT}`);
  process.exit(1);
}

const palettesOf = (art, swap = {}) => {
  const primary = join(pret, 'data/tilesets/primary/building');
  // FireRed's primary tilesets own palettes 0-6 and the secondary 7-12.
  return Array.from({ length: 13 }, (_, n) =>
    readPalette(join(n < 7 ? primary : art, 'palettes', `${String(n).padStart(2, '0')}.pal`)).map(
      (rgb, index) => swap[n]?.[index] ?? rgb.map((value) => Math.round((value * 31) / 255) << 3),
    ),
  );
};

/** A tileset pair as a room loads it: `tiles` names the secondary's art, `metatiles` its blocks. */
function pairOf(tiles, metatiles, swap) {
  const primary = join(pret, 'data/tilesets/primary/building');
  const art = join(pret, 'data/tilesets/secondary', tiles);
  return tilesetPair({
    primaryTiles: join(primary, 'tiles.png'),
    secondaryTiles: join(art, 'tiles.png'),
    primaryMetatiles: join(primary, 'metatiles.bin'),
    secondaryMetatiles: join(join(pret, 'data/tilesets/secondary', metatiles), 'metatiles.bin'),
    palettes: palettesOf(art, swap),
    split: { tiles: 640, metatiles: 640 },
  });
}

/**
 * The hideout's partitions in Fuchsia Gym's colours: palette 12's teal top
 * (8), its pale rim (9, 15) and its grey shade (2) become the green of the
 * pillars on Fuchsia Gym's back wall, the gold of its beams, and the pillars'
 * dark green (Fuchsia Gym's palette 7, indices 11, 6, 7 and 10). The outline
 * and everything else are the same colours in both.
 */
const RECOLOUR = {
  12: {
    8: [56, 128, 112],
    9: [208, 192, 104],
    15: [240, 232, 144],
    2: [40, 104, 80],
  },
};

const PAIRS = {
  cerulean: pairOf('cerulean_gym', 'cerulean_gym'),
  fuchsia: pairOf('fuchsia_gym', 'fuchsia_gym'),
  // The Rocket Hideout's: Silph Co.'s blocks on the Condominiums' tiles, with
  // the partitions' palette swapped for Fuchsia Gym's.
  partition: pairOf('condominiums', 'silph_co', RECOLOUR),
};

/** The gyms' own layouts, read for the pieces cut by place and for the ground letters. */
const LAYOUTS = {
  cerulean: { layout: 'CeruleanCity_Gym', pair: 'cerulean', width: 17, height: 20, attributes: 'cerulean_gym' },
  fuchsia: { layout: 'FuchsiaCity_Gym', pair: 'fuchsia', width: 15, height: 23, attributes: 'fuchsia_gym' },
};
const blocks = Object.fromEntries(
  Object.entries(LAYOUTS).map(([name, room]) => [
    name,
    readFileSync(join(pret, 'data/layouts', room.layout, 'map.bin')),
  ]),
);
/** A cell of a gym's layout: its metatile and whether FireRed lets you stand on it. */
const cell = (room, x, y) => {
  const value = blocks[room].readUInt16LE((y * LAYOUTS[room].width + x) * 2);
  return { metatile: value & 1023, walked: ((value >> 10) & 3) === 0 };
};
/** FireRed's metatile behaviour: 0x15 is water, `MB_OCEAN_WATER`. */
const behaviour = (room, metatile) => {
  if (metatile < 640) return 0;
  const attributes = readFileSync(join(pret, 'data/tilesets/secondary', LAYOUTS[room].attributes, 'metatile_attributes.bin'));
  return attributes.readUInt32LE((metatile - 640) * 4) & 0x1ff;
};
const MB_OCEAN_WATER = 0x15;

/**
 * Every piece: its pair, its metatiles row by row (or `at`, a place in its
 * gym's layout, and `size`), whether it is a prop - something stood in a room
 * rather than its ground - which layers are drawn - `both` as FireRed draws
 * the cell, `top` for what stands on a floor - and `fit`, which crops what was
 * drawn to its own pixels and centres it in a cell that size: a door mat hangs
 * half a tile off the foot of its room, and is put back on the one row a mat
 * here stands on.
 */
const PIECES = [
  // === Cerulean Gym: a pool, walked round and walked over =========================
  // --- its floor: the tiles round the pool, shaded under the back wall and down
  // the west side.
  { name: 'pool.floor', pair: 'cerulean', metatiles: [[641]] },
  { name: 'pool.floorWest', pair: 'cerulean', metatiles: [[652]] },
  { name: 'pool.floorUnderWall', pair: 'cerulean', metatiles: [[670]] },
  { name: 'pool.floorUnderWallWest', pair: 'cerulean', metatiles: [[669]] },
  { name: 'pool.floorUnderWallEast', pair: 'cerulean', metatiles: [[671]] },
  // --- its back wall, three rows - the cornice, the cream face and its foot -
  // each with its own ends, and the side walls down either side of the room.
  { name: 'pool.wallTop', pair: 'cerulean', metatiles: [[646]] },
  { name: 'pool.wallTopWest', pair: 'cerulean', metatiles: [[645]] },
  { name: 'pool.wallTopEast', pair: 'cerulean', metatiles: [[647]] },
  { name: 'pool.wallFace', pair: 'cerulean', metatiles: [[654]] },
  { name: 'pool.wallFaceWest', pair: 'cerulean', metatiles: [[653]] },
  { name: 'pool.wallFaceEast', pair: 'cerulean', metatiles: [[655]] },
  { name: 'pool.wallFoot', pair: 'cerulean', metatiles: [[662]] },
  { name: 'pool.wallFootWest', pair: 'cerulean', metatiles: [[661]] },
  { name: 'pool.wallFootEast', pair: 'cerulean', metatiles: [[663]] },
  { name: 'pool.sideTopWest', pair: 'cerulean', metatiles: [[678]] },
  { name: 'pool.sideTopEast', pair: 'cerulean', metatiles: [[679]] },
  { name: 'pool.sideWest', pair: 'cerulean', metatiles: [[686]] },
  { name: 'pool.sideEast', pair: 'cerulean', metatiles: [[687]] },
  // What hangs on the back wall: a porthole, and the water badge over the
  // cream panel at its middle, its drop in the cornice.
  { name: 'pool.porthole', pair: 'cerulean', metatiles: [[715]], prop: true },
  { name: 'pool.badge', pair: 'cerulean', metatiles: [[660], [706]] },
  // --- the water: open, its rim where it meets the floor, and the shadow the
  // walkways throw on it, with the posts they stand on.
  { name: 'pool.water', pair: 'cerulean', metatiles: [[657]] },
  { name: 'pool.rimN', pair: 'cerulean', metatiles: [[649]] },
  { name: 'pool.rimNw', pair: 'cerulean', metatiles: [[648]] },
  { name: 'pool.rimNe', pair: 'cerulean', metatiles: [[650]] },
  { name: 'pool.rimW', pair: 'cerulean', metatiles: [[656]] },
  { name: 'pool.rimE', pair: 'cerulean', metatiles: [[658]] },
  { name: 'pool.rimS', pair: 'cerulean', metatiles: [[665]] },
  { name: 'pool.rimSw', pair: 'cerulean', metatiles: [[664]] },
  { name: 'pool.rimSe', pair: 'cerulean', metatiles: [[666]] },
  // The south rim beside a walkway's foot, where the walkway's shadow falls on it.
  { name: 'pool.rimSShadow', pair: 'cerulean', metatiles: [[667]] },
  // Water whose corner to the north-west is the floor: where the pool reaches up into it.
  { name: 'pool.notch', pair: 'cerulean', metatiles: [[688]] },
  { name: 'pool.shadow', pair: 'cerulean', metatiles: [[700]] },
  { name: 'pool.shadowPost', pair: 'cerulean', metatiles: [[701]] },
  { name: 'pool.shadowStart', pair: 'cerulean', metatiles: [[702]] },
  { name: 'pool.shadowStartPost', pair: 'cerulean', metatiles: [[699]] },
  { name: 'pool.shadowCorner', pair: 'cerulean', metatiles: [[707]] },
  { name: 'pool.shadowTail', pair: 'cerulean', metatiles: [[703]] },
  { name: 'pool.shadowTailPost', pair: 'cerulean', metatiles: [[711]] },
  { name: 'pool.shadowEast', pair: 'cerulean', metatiles: [[659]] },
  { name: 'pool.shadowEastTop', pair: 'cerulean', metatiles: [[695]] },
  // --- the walkways: FireRed's cream boards, one plank wide, with their own
  // corners, ends and junctions.
  { name: 'pool.deckH', pair: 'cerulean', metatiles: [[690]] },
  { name: 'pool.deckV', pair: 'cerulean', metatiles: [[668]] },
  { name: 'pool.deckNw', pair: 'cerulean', metatiles: [[673]] },
  { name: 'pool.deckNe', pair: 'cerulean', metatiles: [[674]] },
  { name: 'pool.deckSw', pair: 'cerulean', metatiles: [[681]] },
  { name: 'pool.deckSe', pair: 'cerulean', metatiles: [[682]] },
  { name: 'pool.deckCapW', pair: 'cerulean', metatiles: [[689]] },
  { name: 'pool.deckTeeS', pair: 'cerulean', metatiles: [[709]] },
  { name: 'pool.deckTeeW', pair: 'cerulean', metatiles: [[708]] },
  // The walk in from the door, three planks wide: its top edge, the top edge
  // where a walkway comes down into it, and its foot, which runs out onto the
  // floor; and a plank with no edge at all, inside anything wider.
  { name: 'pool.deckTop', pair: 'cerulean', metatiles: [[697]] },
  { name: 'pool.deckTopJoin', pair: 'cerulean', metatiles: [[698]] },
  { name: 'pool.deckFoot', pair: 'cerulean', metatiles: [[705]] },
  { name: 'pool.deck', pair: 'cerulean', metatiles: [[704]] },
  // The leader's dais, its plaque at the middle: where Misty stands. The
  // plaque's top stands up out of the water behind it.
  { name: 'pool.dais', pair: 'cerulean', metatiles: [[675, 676, 677], [683, 684, 685], [691, 692, 693]] },
  { name: 'pool.plaqueTop', pair: 'cerulean', metatiles: [[723]], prop: true },
  // The statues either side of the walk in, standing on its edge.
  { name: 'pool.statueWest', pair: 'cerulean', metatiles: [[720], [722]] },
  { name: 'pool.statueEast', pair: 'cerulean', metatiles: [[721], [722]] },
  // A ladder down into the pool from its north rim, and up out of it at its south.
  { name: 'pool.ladderNorth', pair: 'cerulean', metatiles: [[672], [680]] },
  { name: 'pool.ladderSouth', pair: 'cerulean', metatiles: [[710], [718]] },
  { name: 'pool.mat', pair: 'cerulean', layout: 'cerulean', at: [7, 18], size: [3, 2], layers: 'top', fit: [3, 1] },

  // === Fuchsia Gym: a maze, round Koga =============================================
  // --- its floor, shaded under the back wall and down the west side, and
  // under each pillar of the back wall.
  { name: 'maze.floor', pair: 'fuchsia', metatiles: [[641]] },
  { name: 'maze.floorShade', pair: 'fuchsia', metatiles: [[649]] },
  // --- its back wall, two rows of gold beams, and what stands in it: the green
  // pillars with their shadow on the floor, the windows and the badge at the middle.
  { name: 'maze.wallUpper', pair: 'fuchsia', metatiles: [[647]] },
  { name: 'maze.wallLower', pair: 'fuchsia', metatiles: [[655]] },
  { name: 'maze.pillar', pair: 'fuchsia', metatiles: [[646], [654], [662]] },
  { name: 'maze.window', pair: 'fuchsia', metatiles: [[664, 665], [672, 673]] },
  { name: 'maze.badge', pair: 'fuchsia', metatiles: [[671]], prop: true },
  // Koga's dais, and the statues by the door.
  {
    name: 'maze.dais',
    pair: 'fuchsia',
    metatiles: [
      [643, 644, 645],
      [651, 652, 653],
      [659, 660, 661],
    ],
  },
  { name: 'maze.statue', pair: 'fuchsia', metatiles: [[648], [663]], layers: 'top' },
  { name: 'maze.mat', pair: 'fuchsia', layout: 'fuchsia', at: [6, 21], size: [3, 2], layers: 'top', fit: [3, 1] },
  // --- the partitions of the maze, seen from above: the hideout's own
  // (`RocketHideout_B2F`), in Fuchsia's colours - one block, the ends and
  // runs of a line, and the four corners.
  { name: 'maze.partition', pair: 'partition', metatiles: [[0x2e5]] },
  { name: 'maze.partitionCapW', pair: 'partition', metatiles: [[0x2a5]] },
  { name: 'maze.partitionRunH', pair: 'partition', metatiles: [[0x2a7]] },
  { name: 'maze.partitionCapE', pair: 'partition', metatiles: [[0x29f]] },
  { name: 'maze.partitionCapN', pair: 'partition', metatiles: [[0x29d]] },
  { name: 'maze.partitionRunV', pair: 'partition', metatiles: [[0x29e]] },
  { name: 'maze.partitionCapS', pair: 'partition', metatiles: [[0x2ae]] },
  { name: 'maze.partitionNw', pair: 'partition', metatiles: [[0x28d]] },
  { name: 'maze.partitionNe', pair: 'partition', metatiles: [[0x28e]] },
  { name: 'maze.partitionSw', pair: 'partition', metatiles: [[0x295]] },
  { name: 'maze.partitionSe', pair: 'partition', metatiles: [[0x296]] },
];

/** One piece drawn, in the layers it asks for. */
function cutPiece(piece) {
  const pair = PAIRS[piece.pair];
  const rows =
    piece.metatiles ??
    Array.from({ length: piece.size[1] }, (_, dy) =>
      Array.from({ length: piece.size[0] }, (_, dx) => cell(piece.layout, piece.at[0] + dx, piece.at[1] + dy).metatile),
    );
  const image = blank(rows[0].length * TILE, rows.length * TILE);
  const keepLayer = { bottom: [0], top: [1], both: [0, 1] }[piece.layers ?? 'both'];
  rows.forEach((row, y) =>
    row.forEach((metatile, x) => {
      pair.drawMetatile(image, metatile, x * TILE, y * TILE, (_tile, _palette, layer) => keepLayer.includes(layer));
    }),
  );
  return piece.fit ? fitted(image, piece.fit) : image;
}

/** What was drawn, cropped to its own pixels and centred in a cell `[w, h]` tiles. */
function fitted(image, [w, h]) {
  let left = image.width;
  let top = image.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (image.data[(y * image.width + x) * 4 + 3] > 0) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  }
  const out = blank(w * TILE, h * TILE);
  const width = right - left + 1;
  const height = bottom - top + 1;
  if (width > out.width || height > out.height) {
    throw new Error(`a ${width}x${height} piece does not fit ${w}x${h} tiles`);
  }
  const ox = Math.floor((out.width - width) / 2);
  const oy = Math.floor((out.height - height) / 2);
  for (let y = 0; y < height; y += 1) {
    image.data.copy(
      out.data,
      ((oy + y) * out.width + ox) * 4,
      ((top + y) * image.width + left) * 4,
      ((top + y) * image.width + left + width) * 4,
    );
  }
  return out;
}

const cut = PIECES.map((piece) => ({ name: piece.name, image: cutPiece(piece) }));
const names = new Set();
for (const piece of cut) {
  if (names.has(piece.name)) throw new Error(`two pieces are called ${piece.name}`);
  names.add(piece.name);
}

// Shelf packing: tallest first, left to right, a new shelf when a row is full.
const order = [...cut].sort((a, b) => b.image.height - a.image.height || b.image.width - a.image.width);
const placed = new Map();
let column = 0;
let row = 0;
let shelfHeight = 0;
for (const piece of order) {
  const width = piece.image.width / TILE;
  const height = piece.image.height / TILE;
  if (column + width > SHEET_COLUMNS) {
    column = 0;
    row += shelfHeight;
    shelfHeight = 0;
  }
  placed.set(piece.name, { column, row, width, height });
  column += width;
  shelfHeight = Math.max(shelfHeight, height);
}
const rows = row + shelfHeight;
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
writePng('public/assets/frlg-gyms.png', sheet);

/**
 * A gym's own layout, written out twice: as ground letters - floor (`P`),
 * wall (`B`), the dark beside it (`C`), water (`W`), a walkway (`_`) and a
 * partition (`F`) - and as the piece of ground FireRed draws at each cell, by
 * this sheet's names, or null where the cell is a prop (the dais, a statue, a
 * ladder, a porthole, the mat) or something this sheet does not cut at all.
 */
function layoutOf(room, letterAt) {
  const { width, height } = LAYOUTS[room];
  const byMetatile = new Map(
    PIECES.filter(
      (piece) => piece.pair === LAYOUTS[room].pair && !piece.prop && piece.metatiles?.length === 1 && piece.metatiles[0].length === 1,
    ).map(
      (piece) => [piece.metatiles[0][0], piece.name],
    ),
  );
  const ground = [];
  const pieces = [];
  for (let y = 0; y < height; y += 1) {
    let letters = '';
    const names = [];
    for (let x = 0; x < width; x += 1) {
      const { metatile, walked } = cell(room, x, y);
      letters += letterAt(x, y, metatile, walked);
      names.push(byMetatile.get(metatile) ?? null);
    }
    ground.push(letters);
    pieces.push(names);
  }
  return { ground, pieces };
}

/** The pool's walkways, by metatile: everything cream FireRed stands you on. */
const DECK = new Set([668, 673, 674, 675, 676, 677, 681, 682, 683, 684, 685, 689, 690, 691, 692, 693, 697, 698, 704, 705, 708, 709, 720, 721, 722]);
const cerulean = layoutOf('cerulean', (x, y, metatile) => {
  // The side walls and the room's last row (FireRed's border, under the mat) are the dark.
  if (x === 0 || x === LAYOUTS.cerulean.width - 1 || y === LAYOUTS.cerulean.height - 1) return 'C';
  if (y < 3) return 'B';
  if (behaviour('cerulean', metatile) === MB_OCEAN_WATER) return 'W';
  if (DECK.has(metatile)) return '_';
  return 'P';
});
const fuchsia = layoutOf('fuchsia', (x, y, _metatile, walked) => {
  if (y === LAYOUTS.fuchsia.height - 1) return 'C';
  if (y < 2) return 'B';
  // FireRed's invisible walls, drawn: everything you cannot stand on but the
  // statues' feet, which are statues.
  const statueFoot = (x === 4 || x === 10) && y === 19;
  return walked || statueFoot ? 'P' : 'F';
});

mkdirSync('src/game/world/generated', { recursive: true });
const entries = cut
  .map((piece) => {
    const at = placed.get(piece.name);
    return `  '${piece.name}': { column: ${at.column}, row: ${at.row}, width: ${at.width}, height: ${at.height} },`;
  })
  .join('\n');
const layoutEntry = (name, layout) =>
  `  ${name}: {\n    ground: [\n${layout.ground.map((letters) => `      '${letters}',`).join('\n')}\n    ],\n    pieces: [\n${layout.pieces
    .map((names) => `      [${names.map((one) => (one ? `'${one}'` : 'null')).join(', ')}],`)
    .join('\n')}\n    ],\n  },`;
writeFileSync(
  'src/game/world/generated/gymPieces.ts',
  `// Generated by scripts/cut-frlg-gyms.mjs from pret/pokefirered at ${PRET_COMMIT}.
// Do not edit: re-run the script.

/** The sheet Cerulean Gym and Fuchsia Gym are drawn from. */
export const GYM_SHEET = {
  imagePath: 'assets/frlg-gyms.png',
  columns: ${SHEET_COLUMNS},
  rows: ${rows},
} as const;

/** Where each named piece sits on the sheet, in tiles. */
export const GYM_PIECES = {
${entries}
} as const;

export type GymPieceName = keyof typeof GYM_PIECES;

/**
 * Each gym as FireRed lays it: its ground letters, and the piece FireRed draws
 * at each cell (null where that is a piece cut whole, or nothing cut here).
 */
export const GYM_LAYOUTS: {
  readonly [gym in 'cerulean' | 'fuchsia']: {
    readonly ground: readonly string[];
    readonly pieces: readonly (readonly (GymPieceName | null)[])[];
  };
} = {
${layoutEntry('cerulean', cerulean)}
${layoutEntry('fuchsia', fuchsia)}
};
`,
);
console.log(`public/assets/frlg-gyms.png  ${SHEET_COLUMNS}x${rows} tiles, ${cut.length} pieces`);
