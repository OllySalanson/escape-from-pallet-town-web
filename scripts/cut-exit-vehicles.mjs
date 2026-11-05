// Cuts the rides a raid leaves by onto one sheet, `public/assets/exit-vehicles.png`:
// the boat, the bicycle and the minecart that stand on a way out
// (`src/game/world/exitVehicles.ts` decides which one stands where).
//
//   E=https://raw.githubusercontent.com/pret/pokeemerald/731ad5bfd6e6f265508d0efcca0ba42f9dcf5881
//   F=https://raw.githubusercontent.com/pret/pokefirered/037335f4c725d7c9aecdac87066f2002b4bd7e14
//   D=/tmp/exit-vehicles; mkdir -p $D
//   curl -sSL -o $D/mr_brineys_boat.png $E/graphics/object_events/pics/misc/mr_brineys_boat.png
//   curl -sSL -o $D/npc_3.pal $E/graphics/object_events/palettes/npc_3.pal
//   for d in data/tilesets/primary/building data/tilesets/secondary/bike_shop; do
//     mkdir -p $D/$d/palettes
//     for f in tiles.png metatiles.bin; do curl -sSL -o $D/$d/$f $F/$d/$f; done
//     for p in 00 01 02 03 04 05 06 07 08 09 10 11 12 13 14 15; do
//       curl -sSL -o $D/$d/palettes/$p.pal $F/$d/palettes/$p.pal; done; done
//   node scripts/cut-exit-vehicles.mjs $D
//
// Three sources, one per ride, and why each:
//
// - The boat is Mr. Briney's, from Pokemon Emerald (pret/pokeemerald, pinned as
//   the berry trees and the house's furniture are): FireRed has no small boat -
//   its Seagallop and the S.S. Anne are ships - and Briney's is the one a
//   generation III player is ferried in. `graphics/object_events/pics/misc/
//   mr_brineys_boat.png` is three 32x32 frames, facing down, up and left
//   (`sPicTable_MrBrineysBoat`), drawn in `OBJ_EVENT_PAL_TAG_NPC_3`, which is
//   `graphics/object_events/palettes/npc_3.pal`
//   (`gObjectEventGraphicsInfo_MrBrineysBoat`). The right facing is the left one
//   mirrored, as the game draws it.
// - The bicycle is FireRed's own, from the Cerulean Bike Shop's floor
//   (pret/pokefirered, `data/tilesets/secondary/bike_shop`, metatiles 643 and
//   644, the red one on its stand): its top layer only, so it stands on any ground rather
//   than on the shop's tiles. It is drawn side on, facing left.
// - The minecart is drawn here, on the grid below: no generation III game has
//   one. Its colours are the GBA's (every channel a multiple of eight) and its
//   ink is the cave's and the rails' greys and browns.
//
// Nothing from pret is committed: what ships is the frames, on a new strip of
// 32x32 cells in the order of `CELLS` below, and `public/assets/ASSET_PROVENANCE.md`
// credits each origin. Pidgeot, the ride on high ground, is HeartGold's walking
// art and is cut with the partners by `scripts/cut-hgss-followers.mjs`.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { blank, crop, drawPicture, paste, readPalette, setPixel, tilesetPair } from './gba.mjs';
import { writePng } from '../tools/tileset/tileSheet.mjs';

const CELL = 32;
/** The sheet's cells, left to right. `src/game/world/exitVehicles.ts` names them in the same order. */
const CELLS = ['boat-down', 'boat-up', 'boat-left', 'bike-left', 'minecart-left'];

const [source] = process.argv.slice(2);
if (!source) {
  console.error('usage: node scripts/cut-exit-vehicles.mjs <dir> (see the top of this script)');
  process.exit(1);
}

const sheet = blank(CELL * CELLS.length, CELL);
const cellOf = (name) => {
  const index = CELLS.indexOf(name);
  if (index < 0) throw new Error(`no cell ${name}`);
  return index * CELL;
};

// -- the boat ----------------------------------------------------------------
const boat = drawPicture(join(source, 'mr_brineys_boat.png'), readPalette(join(source, 'npc_3.pal')));
if (boat.width !== CELL * 3 || boat.height !== CELL) throw new Error('Briney\'s boat is not three 32x32 frames');
['boat-down', 'boat-up', 'boat-left'].forEach((name, frame) =>
  paste(sheet, crop(boat, frame * CELL, 0, CELL, CELL), cellOf(name), 0),
);

// -- the bicycle -------------------------------------------------------------
const PRIMARY = join(source, 'data/tilesets/primary/building');
const SECONDARY = join(source, 'data/tilesets/secondary/bike_shop');
// FireRed loads the primary tileset's palettes into the first seven slots and
// the secondary's into the rest, from the same slot of its own file.
const palettes = Array.from({ length: 16 }, (_slot, slot) =>
  readPalette(join(slot < 7 ? PRIMARY : SECONDARY, 'palettes', `${String(slot).padStart(2, '0')}.pal`)),
);
const shop = tilesetPair({
  primaryTiles: join(PRIMARY, 'tiles.png'),
  secondaryTiles: join(SECONDARY, 'tiles.png'),
  primaryMetatiles: join(PRIMARY, 'metatiles.bin'),
  secondaryMetatiles: join(SECONDARY, 'metatiles.bin'),
  palettes,
  split: { tiles: 640, metatiles: 640 },
});
// The shop's floor is the bottom layer and the bicycle the top.
const bike = blank(CELL, 16);
const BIKE_METATILES = [643, 644];
BIKE_METATILES.forEach((id, column) => shop.drawMetatile(bike, id, column * 16, 0, (_tile, _palette, layer) => layer === 1));
// Stood on the cell's last row, as a figure's feet are.
paste(sheet, bike, cellOf('bike-left'), CELL - 16);

// -- the minecart --------------------------------------------------------------
const INK = {
  K: [40, 40, 48], // outline
  D: [88, 88, 104], // iron in shade
  M: [136, 136, 160], // iron
  L: [184, 184, 200], // iron in light
  H: [224, 224, 232], // the rim's catch-light
  O: [112, 80, 48], // ore
  o: [160, 120, 72], // ore in light
  W: [56, 56, 64], // wheel
  w: [144, 144, 160], // hub
  R: [168, 168, 176], // rail
  r: [96, 96, 104], // rail in shade
  T: [120, 80, 48], // sleeper
  t: [160, 112, 64], // sleeper in light
};
const MINECART = [
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '............KK...KKK............',
  '..........KKooK.KoooKK.KK.......',
  '........KKoOooOKooOooOKooK......',
  '....KKKKKKKKKKKKKKKKKKKKKKKK....',
  '....KHHHHHHHHHHHHHHHHHHHHHHK....',
  '....KLLLLLLLLLLLLLLLLLLLLLLK....',
  '.....KMMMMMMMMMMMMMMMMMMMMK.....',
  '.....KMDMMMMMMMMMMMMMMMMDMK.....',
  '.....KMMMMMMMMMMMMMMMMMMMMK.....',
  '......KMMMMMMMMMMMMMMMMMMK......',
  '......KDMMMMMMMMMMMMMMMMDK......',
  '......KDDDDDDDDDDDDDDDDDDK......',
  '.......KKWWWKKKKKKKKWWWKK.......',
  '........WwwwW......WwwwW........',
  '........KWWWK......KWWWK........',
  'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR',
  'rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr',
  '.TTtT.....TTtT.....TTtT.....TTtT',
  '.TTTT.....TTTT.....TTTT.....TTTT',
  '................................',
  '................................',
];
if (MINECART.length !== CELL || MINECART.some((row) => row.length !== CELL)) {
  throw new Error('the minecart is not drawn on a 32x32 grid');
}
const left = cellOf('minecart-left');
MINECART.forEach((row, y) =>
  [...row].forEach((ink, x) => {
    if (ink === '.') return;
    if (!INK[ink]) throw new Error(`no ink ${ink}`);
    setPixel(sheet, left + x, y, INK[ink]);
  }),
);

writePng(new URL('../public/assets/exit-vehicles.png', import.meta.url), sheet);

// Where each cell's art is, read off the pixels: a ride is stood on its tile
// by its art, not by its cell, and a caption is seated round the art.
const bounds = CELLS.map((name) => {
  const left0 = cellOf(name);
  let box;
  for (let y = 0; y < CELL; y += 1) {
    for (let x = 0; x < CELL; x += 1) {
      if (sheet.data[(y * sheet.width + left0 + x) * 4 + 3] === 0) continue;
      box = box
        ? { left: Math.min(box.left, x), top: Math.min(box.top, y), right: Math.max(box.right, x), bottom: Math.max(box.bottom, y) }
        : { left: x, top: y, right: x, bottom: y };
    }
  }
  return `  '${name}': { left: ${box.left}, top: ${box.top}, right: ${box.right}, bottom: ${box.bottom} },`;
});
writeFileSync(
  new URL('../src/game/world/generated/exitVehicleArt.ts', import.meta.url),
  `// Generated by scripts/cut-exit-vehicles.mjs. Do not edit by hand: run the script again.

/** Where each cell of \`exit-vehicles.png\` has art, in pixels of its 32x32 cell, inclusive. */
export const EXIT_VEHICLE_ART = {
${bounds.join('\n')}
} as const;
`,
);
console.log(`exit-vehicles.png ${sheet.width}x${sheet.height}: ${CELLS.join(', ')}`);
