// One picture per case of `makerCollisions.mjs`, before and after: the map as
// the build from before the rules left it, then - from the build with them -
// the ghost before the click and the map after it, each with the line the foot
// of the screen said. Crops of the shots, never scaled, so the pixels are the
// game's.
//
//   node tools/playtest/makerCollisionSheets.mjs <before shots> <after shots> <out dir>
//
// A case the before build was never shot for is drawn with its after half alone.
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readPng, writePng } from '../tileset/tileSheet.mjs';
import { blit, box, canvas, label } from '../tileset/draw.mjs';

const [beforeDir, afterDir, outDir] = process.argv.slice(2);
if (!beforeDir || !afterDir || !outDir) {
  throw new Error('usage: makerCollisionSheets.mjs <before shots> <after shots> <out dir>');
}
mkdirSync(outDir, { recursive: true });

/** How much of the map window each panel shows, around the tile the case is about. */
const PANEL = { width: 640, height: 320 };
/** How much of the foot of the screen is kept: one line, as wide as the longest one said. */
const STATUS = { width: 800, height: 28 };
const WIDTH = STATUS.width;
const INK = [248, 247, 221];
const BACK = [11, 18, 32];
const CAPTION = 18;

function crop(image, x, y, width, height) {
  const out = canvas(width, height, BACK);
  blit(out, image, Math.max(0, Math.round(x)), Math.max(0, Math.round(y)), width, height, 0, 0);
  return out;
}

/** A shot's map window, centred where the case looked, and its status line. */
function panels(dir, name) {
  const png = join(dir, `${name}.png`);
  const json = join(dir, `${name}.json`);
  if (!existsSync(png) || !existsSync(json)) {
    return undefined;
  }
  const image = readPng(png);
  const { rects, status: said } = JSON.parse(readFileSync(json, 'utf8'));
  const view = rects.viewport;
  const map = crop(
    image,
    view.x + (view.width - PANEL.width) / 2,
    view.y + (view.height - PANEL.height) / 2,
    PANEL.width,
    PANEL.height,
  );
  const help = rects.help;
  // A step that said nothing shows the help text under the pointer, which is not what it said.
  const status = said ? crop(image, help.x, help.y + 2, STATUS.width, STATUS.height) : undefined;
  return { map, status };
}

const cases = readdirSync(afterDir)
  .filter((file) => file.endsWith('-1-hover.json'))
  .map((file) => file.slice(0, -'-1-hover.json'.length))
  .sort();

for (const name of cases) {
  const rows = [
    ['BEFORE - AFTER THE CLICK', panels(beforeDir, `${name}-2-done`)],
    ['NOW - BEFORE THE CLICK, THE GHOST', panels(afterDir, `${name}-1-hover`)],
    ['NOW - AFTER THE CLICK', panels(afterDir, `${name}-2-done`)],
  ].filter(([, shot]) => shot !== undefined);
  const rowHeight = CAPTION + PANEL.height + STATUS.height + 8;
  const sheet = canvas(WIDTH, 28 + rows.length * rowHeight, BACK);
  label(sheet, name.replace(/-/g, ' '), 8, 8, 3, INK);
  rows.forEach(([caption, shot], index) => {
    const top = 28 + index * rowHeight;
    label(sheet, caption, 8, top + 5, 2, [255, 214, 92]);
    const mapLeft = (WIDTH - PANEL.width) / 2;
    box(sheet, mapLeft - 1, top + CAPTION - 1, PANEL.width + 2, PANEL.height + 2, [70, 80, 100]);
    blit(sheet, shot.map, 0, 0, PANEL.width, PANEL.height, mapLeft, top + CAPTION);
    if (shot.status) {
      blit(sheet, shot.status, 0, 0, STATUS.width, STATUS.height, 0, top + CAPTION + PANEL.height + 4);
    } else {
      label(sheet, 'NOTHING SAID', 16, top + CAPTION + PANEL.height + 12, 2, [140, 150, 170]);
    }
  });
  writePng(join(outDir, `${name}.png`), sheet);
  console.log(`${name}.png  ${sheet.width}x${sheet.height}`);
}
