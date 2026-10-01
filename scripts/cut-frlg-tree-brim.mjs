// Gives the broadleaf tree back the top of its crown.
//
//   curl -sSL -A "Mozilla/5.0" -o /tmp/3863.png \
//     "https://www.spriters-resource.com/media/assets/4/3863.png"
//   node scripts/cut-frlg-tree-brim.mjs /tmp/3863.png
//
// FireRed draws its broadleaf as a 3x3 block with the trunk on the bottom row,
// and the crown is a little taller than the block: its top five pixels - the
// dark outline and the first rounded rows of leaf - are drawn in the bottom of
// the tile *above* the block, over the grass. `frlg-tiles.png` was cut 3x3, so
// every tree on every map stood with the top of its crown sliced off in a
// straight line, which is what a playtest kept seeing as "the tops of the
// trees are cut off".
//
// This lifts that one strip off the source - the three tiles over the first
// tree of the sheet's tree column, fabnt's "Tileset 2" (asset 3863, see
// `public/assets/ASSET_PROVENANCE.md`) - keeps the crown's own four colours and
// makes everything else in it transparent, the grass and its tufts included,
// so the brim lies over whatever is behind the tree: thicket, another tree's
// trunk, a roof, a lane. It is written to the cells `FRLG_OBJECTS.TREE_BRIM`
// names, which were empty, and nothing else on the sheet is touched.
//
// Idempotent. `--check` fails if the sheet's strip differs from what the
// source gives, and needs the source too.
import { readPng, writePng } from '../tools/tileset/tileSheet.mjs';

const TARGET = 'public/assets/frlg-tiles.png';
const TILE = 16;

/** The tree column's first tree on the source: cells on a 17px pitch, its crown's row at y=18. */
const SOURCE_CELLS_X = [239, 256, 273];
const SOURCE_ROW_Y = 1;

/** Where the strip goes on `frlg-tiles.png`: `FRLG_OBJECTS.TREE_BRIM`. */
const TARGET_COLUMN = 0;
const TARGET_ROW = 12;

/** The crown's colours: its outline, its two leaf greens and its shade. */
const CROWN = [
  [0x38, 0x58, 0x58],
  [0x88, 0xd0, 0x50],
  [0xb0, 0xe8, 0x50],
  [0x58, 0xa0, 0x30],
];

const [sourcePath] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const check = process.argv.includes('--check');
if (!sourcePath) {
  console.error('usage: node scripts/cut-frlg-tree-brim.mjs <path to 3863.png> [--check]');
  process.exit(1);
}

const source = readPng(sourcePath);
const sheet = readPng(TARGET);

const at = (image, x, y) => (y * image.width + x) * 4;
let differs = 0;
let inked = 0;
SOURCE_CELLS_X.forEach((sourceX, cell) => {
  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      const from = at(source, sourceX + x, SOURCE_ROW_Y + y);
      const colour = [source.data[from], source.data[from + 1], source.data[from + 2]];
      const keep = CROWN.some((crown) => crown.every((value, index) => value === colour[index]));
      const pixel = keep ? [...colour, 255] : [0, 0, 0, 0];
      const to = at(sheet, (TARGET_COLUMN + cell) * TILE + x, TARGET_ROW * TILE + y);
      if (keep) inked += 1;
      for (let channel = 0; channel < 4; channel += 1) {
        if (sheet.data[to + channel] !== pixel[channel]) differs += 1;
        sheet.data[to + channel] = pixel[channel];
      }
    }
  }
});

if (check) {
  if (differs > 0) {
    console.error(`${TARGET}'s tree brim differs from the source; run without --check`);
    process.exit(1);
  }
  console.log(`${TARGET}'s tree brim matches the source (${inked} pixels of crown)`);
  process.exit(0);
}
if (differs === 0) {
  console.log(`${TARGET} already has its tree brim; nothing to do`);
  process.exit(0);
}
writePng(TARGET, sheet);
console.log(`${TARGET}: tree brim written, ${inked} pixels of crown`);
