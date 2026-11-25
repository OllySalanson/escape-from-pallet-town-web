/**
 * Draws pieces worn on the starter look (or whole looks, as `look:<id>`) in all
 * sixteen frames - front, right, back, left, each stand-step-stand-step - from
 * two wearables sheets one above the other, with every see-through pixel
 * closed in by the figure painted magenta: the gaps `wearables.test.ts` counts.
 *
 *   git show <commit>:public/assets/wearables.png > before.png
 *   npx vite-node tools/look/lookGaps.mts -- out.png --before=before.png --ids=mewtwo-robe,look:mon-mewtwo [--zoom=4]
 */
import { readPng, writePng } from '../tileset/tileSheet.mjs';
import { box, canvas, label, plot, upscale } from '../tileset/draw.mjs';
import { composeLook, PIECE_WIDTH } from '../../src/game/look/composeLook';
import { STARTER_LOOK, type DressedLook } from '../../src/game/look/look';
import { slotOf, wearableById } from '../../src/game/look/wearables';
import { wholeLookById } from '../../src/game/look/wardrobe';

const args = process.argv.slice(2);
const out = args.find((arg) => !arg.startsWith('--')) ?? 'look-gaps.png';
const option = (name: string): string | undefined =>
  args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const zoom = Number(option('zoom') ?? 4);
const ids = (option('ids') ?? '').split(',').filter(Boolean);
const beforePath = option('before');
const afterPath = new URL('../../public/assets/wearables.png', import.meta.url).pathname;

const sheets: [string, string][] = beforePath ? [['before', beforePath], ['after', afterPath]] : [['now', afterPath]];
const atlases = sheets.map(([name, path]) => [name, readPng(path)] as const);

function lookOf(id: string): DressedLook {
  if (id.startsWith('look:')) {
    const whole = wholeLookById(id.slice('look:'.length));
    if (!whole) throw new Error(`no whole look ${id}`);
    return whole.look;
  }
  const piece = wearableById(id);
  if (!piece) throw new Error(`no piece ${id}`);
  return { ...STARTER_LOOK, [slotOf(piece)]: piece.id };
}

const LEFT = 40;
const GAP = 3;
const TITLE = 9;
const ROW = 32 + GAP;
const width = LEFT + 4 * 64 + 3 * GAP + GAP;
const blockHeight = TITLE + atlases.length * ROW + GAP;
const image = canvas(width, ids.length * blockHeight + GAP, [236, 236, 236]);
const MAGENTA = [255, 0, 255];

ids.forEach((id, k) => {
  const top = GAP + k * blockHeight;
  label(image, id.replace('look:', 'look '), LEFT, top, 1, [40, 40, 40]);
  atlases.forEach(([name, atlas], a) => {
    const rowTop = top + TITLE + a * ROW;
    label(image, name, 2, rowTop + 12, 1, [90, 90, 90]);
    const pixels = composeLook(atlas, lookOf(id));
    for (let frame = 0; frame < 16; frame += 1) {
      const sx = (frame % 4) * 16;
      const sy = Math.floor(frame / 4) * 32;
      const ox = LEFT + Math.floor(frame / 4) * (64 + GAP) + (frame % 4) * 16;
      const drawn = (x: number, y: number) => pixels[((sy + y) * PIECE_WIDTH + sx + x) * 4 + 3] !== 0;
      box(image, ox, rowTop, 16, 32, [190, 218, 200]);
      for (let y = 0; y < 32; y += 1) {
        for (let x = 0; x < 16; x += 1) {
          if (drawn(x, y)) {
            const i = ((sy + y) * PIECE_WIDTH + sx + x) * 4;
            plot(image, ox + x, rowTop + y, [pixels[i], pixels[i + 1], pixels[i + 2]]);
            continue;
          }
          let west = false;
          let east = false;
          let north = false;
          let south = false;
          for (let i = 0; i < x; i += 1) west ||= drawn(i, y);
          for (let i = x + 1; i < 16; i += 1) east ||= drawn(i, y);
          for (let j = 0; j < y; j += 1) north ||= drawn(x, j);
          for (let j = y + 1; j < 32; j += 1) south ||= drawn(x, j);
          if (west && east && north && south) plot(image, ox + x, rowTop + y, MAGENTA);
        }
      }
    }
  });
});

writePng(out, upscale(image, zoom));
console.log(`drew ${out}`);
