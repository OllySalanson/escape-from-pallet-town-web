// Cuts the battle's own backdrop into the two pieces YOUR TEAM's stage is made
// of, where each Pokémon stands on a platform as it does in a fight:
//
// - `platform.png`, the foe's grass platform alone;
// - `field-bands.png`, one column of the sky and grass behind it, top to the
//   row above the player's platform, which the stage stretches across its width.
//
//   node scripts/cut-battle-platform.mjs
//
// The platform is read off `public/assets/battle/background-grass.png` by its
// own ten colours (the grass, its rim and its shade), so the sky behind it is
// left clear and the stage can stand it on any band. Edit this script, never
// the PNG; `public/assets/ASSET_PROVENANCE.md` credits the origin.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPng, writePng } from '../tools/tileset/tileSheet.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const battle = join(here, '..', 'public', 'assets', 'battle');
const source = readPng(join(battle, 'background-grass.png'));

/** The foe's platform's box on the backdrop. */
const LEFT = 124;
const RIGHT = 255;
const TOP = 64;
const BOTTOM = 106;
/** The platform's own colours: every other pixel in its box is sky. */
const PLATFORM = new Set([
  '88,72,32', '96,208,128', '136,224,168', '72,184,104', '144,120,48',
  '32,160,64', '224,192,96', '192,160,72', '160,208,80', '120,216,152',
]);

const width = RIGHT - LEFT;
const height = BOTTOM - TOP;
const data = Buffer.alloc(width * height * 4);
for (let y = TOP; y < BOTTOM; y += 1) {
  for (let x = LEFT; x < RIGHT; x += 1) {
    const from = (y * source.width + x) * 4;
    if (PLATFORM.has(`${source.data[from]},${source.data[from + 1]},${source.data[from + 2]}`)) {
      source.data.copy(data, ((y - TOP) * width + (x - LEFT)) * 4, from, from + 4);
    }
  }
}
writePng(join(battle, 'platform.png'), { width, height, data });
console.log(`platform.png ${width}x${height}`);

/** The backdrop's left column, from under its one-pixel black frame to the row above the player's platform's rim. */
const BAND_COLUMN = 2;
const BAND_TOP = 1;
const BAND_BOTTOM = 130;
const bands = Buffer.alloc((BAND_BOTTOM - BAND_TOP) * 4);
for (let y = BAND_TOP; y < BAND_BOTTOM; y += 1) {
  source.data.copy(bands, (y - BAND_TOP) * 4, (y * source.width + BAND_COLUMN) * 4, (y * source.width + BAND_COLUMN) * 4 + 4);
}
writePng(join(battle, 'field-bands.png'), { width: 1, height: BAND_BOTTOM - BAND_TOP, data: bands });
console.log(`field-bands.png 1x${BAND_BOTTOM - BAND_TOP}`);
