// Draws THE DAY-CARE's stage: the pen in the yard, exactly as the game draws
// it, cut out on its own for the Day-Care screen (`hub/dayCareView.ts`), where
// the Pokémon left with him stands big inside the fence:
//
//   node scripts/draw-day-care-stage.mjs
//
// The yard is drawn by the game's own base renderer (`tools/base/renderBase.mts`)
// at one pixel a pixel, nothing built, and the pen's box is cut from it - the
// fence, the flowers, the sign and the lawn round it. Edit this script, never
// the PNG; `public/assets/ASSET_PROVENANCE.md` credits the tiles it is made of.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPng, writePng } from '../tools/tileset/tileSheet.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const TILE = 16;
/** The pen's box in the yard, in tiles: `DAY_CARE_PEN` (`base/dayCarePen.ts`) with the lawn round it. */
const LEFT = 39;
const TOP = 2;
const WIDTH = 20;
const HEIGHT = 14;

const scratch = mkdtempSync(join(tmpdir(), 'day-care-stage-'));
try {
  const yard = join(scratch, 'yard.png');
  execFileSync('npx', ['vite-node', 'tools/base/renderBase.mts', '--', yard, '1'], { cwd: root, stdio: 'inherit' });
  const source = readPng(yard);
  const width = WIDTH * TILE;
  const height = HEIGHT * TILE;
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const from = ((TOP * TILE + y) * source.width + LEFT * TILE) * 4;
    source.data.copy(data, y * width * 4, from, from + width * 4);
  }
  writePng(join(root, 'public', 'assets', 'day-care-pen.png'), { width, height, data });
  console.log(`day-care-pen.png ${width}x${height}`);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
