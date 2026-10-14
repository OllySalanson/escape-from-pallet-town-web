// Cuts FireRed's Rocket Hideout and its Power Plant out of pret's FireRed
// disassembly, onto `public/assets/frlg-hideout.png`: what a room dressed as
// the hideout or the power plant is drawn with
// (`src/game/world/tileset/insideTileset.ts`, the `hideout` and `power-plant`
// styles).
//
//   git clone --filter=blob:none --no-checkout https://github.com/pret/pokefirered.git /tmp/pokefirered
//   git -C /tmp/pokefirered sparse-checkout set --no-cone 'data/tilesets/' 'data/layouts/'
//   git -C /tmp/pokefirered checkout 037335f4c725d7c9aecdac87066f2002b4bd7e14
//   node scripts/cut-frlg-hideout.mjs /tmp/pokefirered
//
// The checkout is never committed, and what ships is a cut: named pieces drawn
// out of the game's own metatiles and packed onto a new grid, exactly as
// `cut-frlg-ice.mjs` cuts Icefall Cave. `public/assets/ASSET_PROVENANCE.md`
// says where it comes from, and this script is the record of which metatile
// every piece is and which of its two layers are drawn.
//
// Two pairs of tilesets. The Rocket Hideout under the Game Corner, and Five
// Island's Rocket Warehouse, are drawn with `gTileset_Building` and
// `gTileset_SilphCo` - whose tiles and palettes are the Condominiums' own
// (`src/data/tilesets/headers.h`), so they are read from there. The Power
// Plant on Route 10 is `gTileset_Building` and `gTileset_PowerPlant`. Every
// piece is named by its metatile number in its pair, read off the rooms the
// game draws with it (`RocketHideout_B1F` to `_B4F`, `FiveIsland_RocketWarehouse`
// and `PowerPlant`); the hideout's own names for them are pret's
// (`include/constants/metatile_labels.h`) where pret has one.
//
// Colours are read back to the five bits a channel the Game Boy Advance shows
// and written `x << 3`, as every other `frlg-*.png` writes them.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { blank, readPalette, tilesetPair } from './gba.mjs';
import { writePng } from '../tools/tileset/tileSheet.mjs';

const PRET_COMMIT = '037335f4c725d7c9aecdac87066f2002b4bd7e14';
const TILE = 16;
const SHEET_COLUMNS = 16;

const pret = process.argv[2];
if (!pret) {
  console.error('usage: node scripts/cut-frlg-hideout.mjs <pokefirered checkout>');
  process.exit(2);
}
const head = execFileSync('git', ['-C', pret, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (head !== PRET_COMMIT) {
  console.error(`the checkout is at ${head}; this sheet is cut from ${PRET_COMMIT}`);
  process.exit(1);
}

/** A tileset pair as a room loads it: `tiles` names the secondary's art, `metatiles` its blocks. */
function pairOf(tiles, metatiles) {
  const primary = join(pret, 'data/tilesets/primary/building');
  const art = join(pret, 'data/tilesets/secondary', tiles);
  const blocks = join(pret, 'data/tilesets/secondary', metatiles);
  // FireRed's primary tilesets own palettes 0-6 and the secondary 7-12.
  const palettes = Array.from({ length: 13 }, (_, n) =>
    readPalette(join(n < 7 ? primary : art, 'palettes', `${String(n).padStart(2, '0')}.pal`)).map(
      (rgb) => rgb.map((value) => Math.round((value * 31) / 255) << 3),
    ),
  );
  return tilesetPair({
    primaryTiles: join(primary, 'tiles.png'),
    secondaryTiles: join(art, 'tiles.png'),
    primaryMetatiles: join(primary, 'metatiles.bin'),
    secondaryMetatiles: join(blocks, 'metatiles.bin'),
    palettes,
    split: { tiles: 640, metatiles: 640 },
  });
}

const PAIRS = {
  // The Rocket Hideout's, and the Rocket Warehouse's: Silph Co.'s blocks on
  // the Condominiums' tiles.
  hideout: pairOf('condominiums', 'silph_co'),
  power: pairOf('power_plant', 'power_plant'),
};

/**
 * Every piece: its pair, its metatiles row by row, and which layers are drawn
 * - `both` as FireRed draws the cell, `top` for what stands on a floor (the
 * bottom layer is the floor under it), `bottom` for the floor alone. `dark`
 * lifts FireRed's black, the dark beyond a room's walls, out of what is drawn,
 * so a border stands against whatever dark the game draws round it.
 */
const PIECES = [
  // === The Rocket Hideout ======================================================
  // --- its floor: plain, shaded under the back wall and down the west side,
  // and the room's foot, where FireRed draws the white rule of its border on
  // the last row of floor rather than in the dark below it.
  { name: 'hideout.floor', pair: 'hideout', metatiles: [[0x281]], layers: 'both' },
  { name: 'hideout.floorShade', pair: 'hideout', metatiles: [[0x282]], layers: 'both' },
  { name: 'hideout.foot', pair: 'hideout', metatiles: [[0x29a]], layers: 'both', dark: true },
  { name: 'hideout.footShade', pair: 'hideout', metatiles: [[0x299]], layers: 'both', dark: true },
  // The foot where a corridor leaves the room southward: the rule turns down
  // into the corridor's border on one side or the other.
  {
    name: 'hideout.footTurnsEast',
    pair: 'hideout',
    metatiles: [[0x2b4]],
    layers: 'both',
    dark: true,
  },
  {
    name: 'hideout.footTurnsWest',
    pair: 'hideout',
    metatiles: [[0x2b3]],
    layers: 'both',
    dark: true,
  },
  {
    name: 'hideout.footShadeTurnsEast',
    pair: 'hideout',
    metatiles: [[0x2e1]],
    layers: 'both',
    dark: true,
  },
  // --- its back wall, two rows: the panel under a white rule, and the skirting.
  { name: 'hideout.wallUpper', pair: 'hideout', metatiles: [[0x289]], layers: 'both' },
  { name: 'hideout.wallLower', pair: 'hideout', metatiles: [[0x291]], layers: 'both' },
  // The end of a run of wall against a corridor going north out of the room,
  // the corridor's border coming down into it: the east end of a run, with
  // the corridor beyond it, and the west end.
  {
    name: 'hideout.wallEndEast',
    pair: 'hideout',
    metatiles: [[0x2de], [0x2e6]],
    layers: 'both',
    dark: true,
  },
  {
    name: 'hideout.wallEndWest',
    pair: 'hideout',
    metatiles: [[0x2df], [0x2e7]],
    layers: 'both',
    dark: true,
  },
  // --- the border: FireRed draws a room's sides as a white rule on the dark
  // beside it, and turns its corners there.
  { name: 'hideout.borderNw', pair: 'hideout', metatiles: [[0x288]], layers: 'both', dark: true },
  { name: 'hideout.borderNe', pair: 'hideout', metatiles: [[0x28c]], layers: 'both', dark: true },
  { name: 'hideout.borderW', pair: 'hideout', metatiles: [[0x290]], layers: 'both', dark: true },
  { name: 'hideout.borderE', pair: 'hideout', metatiles: [[0x294]], layers: 'both', dark: true },
  { name: 'hideout.borderSw', pair: 'hideout', metatiles: [[0x298]], layers: 'both', dark: true },
  { name: 'hideout.borderSe', pair: 'hideout', metatiles: [[0x29c]], layers: 'both', dark: true },
  // --- the partitions of B2F's maze, seen from above: one block, the ends and
  // middles of a run either way, and the four corners an L turns.
  { name: 'hideout.partition', pair: 'hideout', metatiles: [[0x2e5]], layers: 'both' },
  { name: 'hideout.partitionCapW', pair: 'hideout', metatiles: [[0x2a5]], layers: 'both' },
  { name: 'hideout.partitionRunH', pair: 'hideout', metatiles: [[0x2a7]], layers: 'both' },
  { name: 'hideout.partitionCapE', pair: 'hideout', metatiles: [[0x29f]], layers: 'both' },
  { name: 'hideout.partitionCapN', pair: 'hideout', metatiles: [[0x29d]], layers: 'both' },
  { name: 'hideout.partitionRunV', pair: 'hideout', metatiles: [[0x29e]], layers: 'both' },
  { name: 'hideout.partitionCapS', pair: 'hideout', metatiles: [[0x2ae]], layers: 'both' },
  { name: 'hideout.partitionNw', pair: 'hideout', metatiles: [[0x28d]], layers: 'both' },
  { name: 'hideout.partitionNe', pair: 'hideout', metatiles: [[0x28e]], layers: 'both' },
  { name: 'hideout.partitionSw', pair: 'hideout', metatiles: [[0x295]], layers: 'both' },
  { name: 'hideout.partitionSe', pair: 'hideout', metatiles: [[0x296]], layers: 'both' },
  // A partition run up into the skirting of the back wall.
  { name: 'hideout.partitionWall', pair: 'hideout', metatiles: [[0x297]], layers: 'both' },
  // --- the spinner floor: METATILE_SilphCo_Arrow_*, whose behaviour spins a
  // player on (MB_SPIN_*), and the yellow plate that stops them
  // (MB_STOP_SPINNING).
  { name: 'hideout.spinUp', pair: 'hideout', metatiles: [[0x2a0]], layers: 'both' },
  { name: 'hideout.spinDown', pair: 'hideout', metatiles: [[0x2a8]], layers: 'both' },
  { name: 'hideout.spinLeft', pair: 'hideout', metatiles: [[0x2a1]], layers: 'both' },
  { name: 'hideout.spinRight', pair: 'hideout', metatiles: [[0x2a9]], layers: 'both' },
  { name: 'hideout.spinStop', pair: 'hideout', metatiles: [[0x28f]], layers: 'both' },
  // --- the ways between floors. The stairs up climb west from the step at
  // their east side, with the rail drawn into the wall above them; the stairs
  // down go down east from the step at their west side. The lift is
  // METATILE_SilphCo_HideoutElevatorDoor in its frame, let into the back wall.
  {
    name: 'hideout.stairsUp',
    pair: 'hideout',
    metatiles: [
      [0x26c, 0x289, 0x289],
      [0x252, 0x253, 0x254],
      [0x25a, 0x25b, 0x25c],
      [0x262, 0x263, 0x264],
    ],
    layers: 'both',
  },
  {
    name: 'hideout.stairsDown',
    pair: 'hideout',
    metatiles: [
      [0x255, 0x256, 0x257],
      [0x25d, 0x25e, 0x25f],
      [0x265, 0x266, 0x267],
    ],
    layers: 'both',
  },
  {
    name: 'hideout.lift',
    pair: 'hideout',
    metatiles: [
      [0x2a2, 0x2a3, 0x2a4],
      [0x2aa, 0x2ab, 0x2ac],
    ],
    layers: 'both',
  },
  // The stairs B4F climbs out by, standing free on the floor against the
  // east wall.
  {
    name: 'hideout.stairsOut',
    pair: 'hideout',
    metatiles: [
      [0x250, 0x251, 0x268],
      [0x258, 0x259, 0x270],
      [0x260, 0x261, 0x278],
    ],
    layers: 'both',
  },
  // --- METATILE_SilphCo_HideoutBarrier_*: the shutter B4F stands across its
  // corridor until it is opened, two tiles wide and two deep.
  {
    name: 'hideout.shutter',
    pair: 'hideout',
    metatiles: [
      [0x2ce, 0x2cf],
      [0x2d6, 0x2d7],
    ],
    layers: 'both',
  },
  // --- what stands in it ---------------------------------------------------------
  // The machine the Rocket Warehouse keeps against its back wall, its head in
  // the wall and its feet on the floor: the hideout's generator.
  {
    name: 'hideout.generator',
    pair: 'hideout',
    metatiles: [
      [0x2ad, 0x2af, 0x289],
      [0x2b5, 0x2b6, 0x2b7],
      [0x2bd, 0x2be, 0x2bf],
    ],
    layers: 'both',
  },
  // The vent and the telephone set into the back wall.
  { name: 'hideout.vent', pair: 'hideout', metatiles: [[0x28a], [0x292]], layers: 'both' },
  { name: 'hideout.phone', pair: 'hideout', metatiles: [[0x28b], [0x293]], layers: 'both' },
  // The desks, with a terminal and without, and the stools beside them.
  {
    name: 'hideout.desk',
    pair: 'hideout',
    metatiles: [
      [0x2b0, 0x2b1, 0x2b2],
      [0x2bb, 0x2b9, 0x2c4],
      [0x2c3, 0x2b9, 0x2ba],
      [0x2c0, 0x2c1, 0x2c2],
    ],
    layers: 'both',
  },
  {
    name: 'hideout.deskPlain',
    pair: 'hideout',
    metatiles: [
      [0x2b0, 0x2b1, 0x2b2],
      [0x2b8, 0x2b9, 0x2ba],
      [0x2b8, 0x2b9, 0x2ba],
      [0x2c0, 0x2c1, 0x2c2],
    ],
    layers: 'both',
  },
  { name: 'hideout.stool', pair: 'hideout', metatiles: [[0x2e3]], layers: 'both' },
  { name: 'hideout.stoolEast', pair: 'hideout', metatiles: [[0x2e4]], layers: 'both' },
  // The plants in pots down a corridor, and the long table with the plans on
  // it - the hideout's own, and the war room's.
  { name: 'hideout.plant', pair: 'hideout', metatiles: [[0x301], [0x309]], layers: 'both' },
  {
    name: 'hideout.planTable',
    pair: 'hideout',
    metatiles: [
      [0x313, 0x314, 0x315, 0x313, 0x314, 0x315],
      [0x31e, 0x31f, 0x31d, 0x31b, 0x316, 0x317],
      [0x323, 0x324, 0x325, 0x323, 0x324, 0x325],
      [0x32b, 0x32c, 0x32d, 0x3e8, 0x32c, 0x32d],
    ],
    layers: 'both',
  },
  // The cabinet against the wall, the sofa, the consoles, and the crates the
  // Rocket Warehouse is stacked with.
  {
    name: 'hideout.cabinet',
    pair: 'hideout',
    metatiles: [
      [0x310, 0x311],
      [0x310, 0x311],
      [0x318, 0x319],
    ],
    layers: 'both',
  },
  {
    name: 'hideout.sofa',
    pair: 'hideout',
    metatiles: [
      [0x320, 0x321, 0x322],
      [0x328, 0x329, 0x32a],
    ],
    layers: 'both',
  },
  { name: 'hideout.console', pair: 'hideout', metatiles: [[0x306], [0x30e]], layers: 'both' },
  {
    name: 'hideout.crate',
    pair: 'hideout',
    metatiles: [
      [0x3f0, 0x3f1],
      [0x3f8, 0x3f9],
    ],
    layers: 'both',
  },

  // === The Power Plant =========================================================
  // --- its floor, shaded under its machines and down the west side.
  { name: 'power.floor', pair: 'power', metatiles: [[0x29f]], layers: 'both' },
  { name: 'power.floorShade', pair: 'power', metatiles: [[0x29d]], layers: 'both' },
  { name: 'power.floorShadeWest', pair: 'power', metatiles: [[0x29b]], layers: 'both' },
  { name: 'power.floorShadeCorner', pair: 'power', metatiles: [[0x29c]], layers: 'both' },
  // --- its back wall, three rows: the top of the machinery seen from above,
  // the lamps along its face, and its foot.
  { name: 'power.wallTop', pair: 'power', metatiles: [[0x285]], layers: 'both', dark: true },
  { name: 'power.wallFace', pair: 'power', metatiles: [[0x28d]], layers: 'both' },
  { name: 'power.wallFoot', pair: 'power', metatiles: [[0x295]], layers: 'both' },
  { name: 'power.wallTopWest', pair: 'power', metatiles: [[0x284]], layers: 'both', dark: true },
  { name: 'power.wallFaceWest', pair: 'power', metatiles: [[0x28c]], layers: 'both' },
  { name: 'power.wallFootWest', pair: 'power', metatiles: [[0x294]], layers: 'both' },
  { name: 'power.wallTopEast', pair: 'power', metatiles: [[0x286]], layers: 'both', dark: true },
  { name: 'power.wallFaceEast', pair: 'power', metatiles: [[0x28e]], layers: 'both' },
  { name: 'power.wallFootEast', pair: 'power', metatiles: [[0x296]], layers: 'both' },
  // A wall of it standing out in the hall has floor behind it, not the dark:
  // its top is the cream plate FireRed draws along a machine wall's crown.
  { name: 'power.plateWest', pair: 'power', metatiles: [[0x2a1]], layers: 'both' },
  { name: 'power.plate', pair: 'power', metatiles: [[0x2a2]], layers: 'both' },
  { name: 'power.plateEast', pair: 'power', metatiles: [[0x2a3]], layers: 'both' },
  // The girders braced across the face of it, either end of a bay.
  {
    name: 'power.girderWest',
    pair: 'power',
    metatiles: [
      [0x2d6, 0x2e6],
      [0x2de, 0x295],
    ],
    layers: 'both',
  },
  {
    name: 'power.girderEast',
    pair: 'power',
    metatiles: [
      [0x2e7, 0x2d7],
      [0x295, 0x2df],
    ],
    layers: 'both',
  },
  // --- what stands in it: the generators, two to a bay, lit from the west
  // and from the east; the barrels; the rubble; the consoles and the
  // computer; and the mat at the door, on its grating.
  {
    name: 'power.generator',
    pair: 'power',
    metatiles: [
      [0x2e8, 0x2e9, 0x2ea],
      [0x2f0, 0x2f1, 0x2f2],
      [0x2f8, 0x2f9, 0x2fa],
      [0x300, 0x301, 0x302],
    ],
    layers: 'both',
  },
  {
    name: 'power.generatorEast',
    pair: 'power',
    metatiles: [
      [0x2eb, 0x2ec, 0x2ed],
      [0x2f3, 0x2f4, 0x2f5],
      [0x2fb, 0x2fc, 0x2fd],
      [0x303, 0x304, 0x305],
    ],
    layers: 'both',
  },
  { name: 'power.barrel', pair: 'power', metatiles: [[0x2d0], [0x2d8]], layers: 'both' },
  { name: 'power.rubble', pair: 'power', metatiles: [[0x2b5]], layers: 'both' },
  { name: 'power.rubbleLow', pair: 'power', metatiles: [[0x2b6]], layers: 'both' },
  { name: 'power.console', pair: 'power', metatiles: [[0x2ee], [0x2f6]], layers: 'both' },
  { name: 'power.consoleDials', pair: 'power', metatiles: [[0x2ef], [0x2f7]], layers: 'both' },
  { name: 'power.computer', pair: 'power', metatiles: [[0x308], [0x310], [0x318]], layers: 'both' },
  { name: 'power.grating', pair: 'power', metatiles: [[0x2cc]], layers: 'both' },
  { name: 'power.mat', pair: 'power', metatiles: [[0x2c1, 0x2c2, 0x2c3]], layers: 'both' },
];

/** One piece drawn, in the layers it asks for. */
function cutPiece(piece) {
  const pair = PAIRS[piece.pair];
  const rows = piece.metatiles;
  const image = blank(rows[0].length * TILE, rows.length * TILE);
  const keepLayer = { bottom: [0], top: [1], both: [0, 1] }[piece.layers];
  rows.forEach((row, y) =>
    row.forEach((metatile, x) => {
      for (const layer of keepLayer) {
        // `drawMetatile` names a metatile's eight tiles in order: the bottom
        // layer's four, then the top's.
        let seen = 0;
        pair.drawMetatile(image, metatile, x * TILE, y * TILE, () => {
          const keep = Math.floor(seen / 4) === layer;
          seen += 1;
          return keep;
        });
      }
    }),
  );
  if (piece.dark) {
    for (let i = 0; i < image.data.length; i += 4) {
      if (image.data[i] === 0 && image.data[i + 1] === 0 && image.data[i + 2] === 0)
        image.data[i + 3] = 0;
    }
  }
  return image;
}

const cut = PIECES.map((piece) => ({ name: piece.name, image: cutPiece(piece) }));
const names = new Set();
for (const piece of cut) {
  if (names.has(piece.name)) throw new Error(`two pieces are called ${piece.name}`);
  names.add(piece.name);
}

// Shelf packing: tallest first, left to right, a new shelf when a row is full.
const order = [...cut].sort(
  (a, b) => b.image.height - a.image.height || b.image.width - a.image.width,
);
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
writePng('public/assets/frlg-hideout.png', sheet);

mkdirSync('src/game/world/generated', { recursive: true });
const entries = cut
  .map((piece) => {
    const at = placed.get(piece.name);
    return `  '${piece.name}': { column: ${at.column}, row: ${at.row}, width: ${at.width}, height: ${at.height} },`;
  })
  .join('\n');
writeFileSync(
  'src/game/world/generated/hideoutPieces.ts',
  `// Generated by scripts/cut-frlg-hideout.mjs from pret/pokefirered at ${PRET_COMMIT}.
// Do not edit: re-run the script.

/** The sheet the Rocket Hideout and the Power Plant are drawn from. */
export const HIDEOUT_SHEET = {
  imagePath: 'assets/frlg-hideout.png',
  columns: ${SHEET_COLUMNS},
  rows: ${rows},
} as const;

/** Where each named piece sits on the sheet, in tiles. */
export const HIDEOUT_PIECES = {
${entries}
} as const;

export type HideoutPieceName = keyof typeof HIDEOUT_PIECES;
`,
);
console.log(`public/assets/frlg-hideout.png  ${SHEET_COLUMNS}x${rows} tiles, ${cut.length} pieces`);
