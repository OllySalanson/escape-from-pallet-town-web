// Gives the FireRed sheet's rock clear corners, so it stands on any ground.
//
//   node scripts/cut-frlg-clear-rock.mjs [--check]
//
// `frlg-tiles.png` was cut from renders of FireRed's maps, so every object on
// it has the plain grass it was drawn over baked into its corners
// (`FRLG_TILES.GRASS`, the same green to the pixel). On grass that is
// invisible. On a beach it is not: Gull Strand's rocks were planted on sand
// and every one of them stood in a square of lawn (playtest of the vale's far
// places, B4) - its lot was sand, and the rock's own corners covered it.
//
// This copies the sheet's own rock (`FRLG_TILES.ROCK`) into the empty cell
// `FRLG_TILES.ROCK_CLEAR` names with every pixel of that grass green made
// transparent and nothing else changed: the outline, the stone and its grey
// shadow are FireRed's, and whatever ground the rock is planted on shows
// round it. Nothing else on the sheet is touched, and no source but the sheet
// itself is needed, so it can always be run again.
//
// Idempotent. `--check` fails if the clear rock differs from what the sheet's
// rock gives.
import { readPng, writePng } from '../tools/tileset/tileSheet.mjs';

const TARGET = 'public/assets/frlg-tiles.png';
const TILE = 16;

/** `FRLG_TILES.ROCK`, and `FRLG_TILES.ROCK_CLEAR`, which was empty. */
const ROCK = { column: 5, row: 30 };
const ROCK_CLEAR = { column: 15, row: 30 };

/** `FRLG_TILES.GRASS`'s green, which every object on the sheet has in its corners. */
const GRASS = [112, 200, 160];

const check = process.argv.includes('--check');
const sheet = readPng(TARGET);
const at = (cell, x, y) => ((cell.row * TILE + y) * sheet.width + cell.column * TILE + x) * 4;

let differs = 0;
let cleared = 0;
for (let y = 0; y < TILE; y += 1) {
  for (let x = 0; x < TILE; x += 1) {
    const from = at(ROCK, x, y);
    const colour = [...sheet.data.subarray(from, from + 4)];
    const grass = colour[3] === 255 && GRASS.every((value, channel) => colour[channel] === value);
    const pixel = grass ? [0, 0, 0, 0] : colour;
    if (grass) cleared += 1;
    const to = at(ROCK_CLEAR, x, y);
    for (let channel = 0; channel < 4; channel += 1) {
      if (sheet.data[to + channel] !== pixel[channel]) differs += 1;
      sheet.data[to + channel] = pixel[channel];
    }
  }
}

if (check) {
  if (differs > 0) {
    console.error(`${TARGET}'s clear rock differs from its rock; run without --check`);
    process.exit(1);
  }
  console.log(`${TARGET}'s clear rock matches its rock (${cleared} pixels of grass cleared).`);
} else if (differs === 0) {
  console.log(`${TARGET} already has its clear rock; nothing to do.`);
} else {
  writePng(TARGET, sheet);
  console.log(`Wrote the clear rock to ${TARGET}: ${cleared} pixels of grass cleared, ${differs} channels changed.`);
}
