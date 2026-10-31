// Cuts FireRed's plank decking - the jetties of the Sevii Islands and the Safari
// Zone, out of the general tileset - from pret's FireRed disassembly, onto
// `public/assets/frlg-boards.png`: what a boardwalk is drawn with
// (`src/game/world/tileset/boardsSheet.ts`, the `boards` material).
//
//   git clone --filter=blob:none --no-checkout https://github.com/pret/pokefirered.git /tmp/pokefirered
//   git -C /tmp/pokefirered sparse-checkout set --no-cone 'data/tilesets/primary/'
//   git -C /tmp/pokefirered checkout 037335f4c725d7c9aecdac87066f2002b4bd7e14
//   node scripts/cut-frlg-boards.mjs /tmp/pokefirered
//
// FireRed lays a deck in three rows of three: metatiles 445-447 along its north
// edge, 453-455 for the body, and under it 461-463, which are not deck at all but
// the water below with the deck's shadow on their top five rows. So a deck in
// FireRed is drawn into the tile below it, which can only ever be water. A
// boardwalk here crosses reeds and grass as well, so its south edge is cut as one
// tile: eleven rows of the body and the five rows of rim from the tile below,
// which stands on anything and leaves the water beneath it free to move.
//
// The checkout is never committed, and what ships is this cut. Colours are read
// back to the five bits a channel the Game Boy Advance shows and written `x << 3`,
// as every other `frlg-*.png` writes them.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { blank, readPalette, tilesetPair } from './gba.mjs';
import { writePng } from '../tools/tileset/tileSheet.mjs';

const PRET_COMMIT = '037335f4c725d7c9aecdac87066f2002b4bd7e14';
const TILE = 16;
const RIM_ROWS = 5;

const pret = process.argv[2];
if (!pret) {
  console.error('usage: node scripts/cut-frlg-boards.mjs <pokefirered checkout>');
  process.exit(2);
}
const head = execFileSync('git', ['-C', pret, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (head !== PRET_COMMIT) {
  console.error(`the checkout is at ${head}; this sheet is cut from ${PRET_COMMIT}`);
  process.exit(1);
}

const general = join(pret, 'data/tilesets/primary/general');
const palettes = Array.from({ length: 7 }, (_, n) =>
  readPalette(join(general, 'palettes', `${String(n).padStart(2, '0')}.pal`)).map((rgb) =>
    rgb.map((value) => Math.round((value * 31) / 255) << 3),
  ),
);
// The deck is all in the primary tileset, so it stands in for the secondary half.
const pair = tilesetPair({
  primaryTiles: join(general, 'tiles.png'),
  secondaryTiles: join(general, 'tiles.png'),
  primaryMetatiles: join(general, 'metatiles.bin'),
  secondaryMetatiles: join(general, 'metatiles.bin'),
  palettes,
  split: { tiles: 640, metatiles: 640 },
});

/** The sheet, in the order `boardsSheet.ts` reads it: `[deck metatile, rim metatile]` a cell. */
const CELLS = [
  [[445], [446], [447]],
  [[453], [454], [455]],
  [[453, 461], [454, 462], [455, 463]],
];

const sheet = blank(CELLS[0].length * TILE, CELLS.length * TILE);
CELLS.forEach((row, y) =>
  row.forEach(([deck, rim], x) => {
    const left = x * TILE;
    const top = y * TILE;
    pair.drawMetatile(sheet, deck, left, top);
    if (rim === undefined) return;
    // The rim's own rows, over the bottom of the deck, and nothing of the water below them.
    const under = blank(TILE, TILE);
    pair.drawMetatile(under, rim, 0, 0);
    for (let rimRow = 0; rimRow < RIM_ROWS; rimRow += 1) {
      under.data.copy(
        sheet.data,
        ((top + TILE - RIM_ROWS + rimRow) * sheet.width + left) * 4,
        rimRow * TILE * 4,
        (rimRow + 1) * TILE * 4,
      );
    }
  }),
);
mkdirSync('public/assets', { recursive: true });
writePng('public/assets/frlg-boards.png', sheet);
writeFileSync(
  'src/game/world/generated/boardPieces.ts',
  `// Written by scripts/cut-frlg-boards.mjs. Do not edit.
export const BOARDS_SHEET = {
  imagePath: 'assets/frlg-boards.png',
  columns: ${CELLS[0].length},
  rows: ${CELLS.length},
} as const;
`,
);
