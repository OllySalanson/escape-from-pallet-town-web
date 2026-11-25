/**
 * Draws the gym honours (`src/game/look/gymHonours.ts`) on bodies and looks,
 * big enough to criticise, on grass: a row a body, and in each row one block a
 * combination of things worn, each block the four facings (down, right, up,
 * left) standing and mid-step.
 *
 *   npx vite-node tools/look/gymHonours.mts -- out.png [--zoom=6]
 *     [--bodies=classic,rider,starter,<whole look id>,...]
 *     [--worn=none,cascade,soul,cascade+soul,cascade+soul+raid-pack,...]
 *
 * An honour is drawn as `lookTexture.ts` draws it: after the pack.
 */
import { readPng, writePng } from '../tileset/tileSheet.mjs';
import { canvas, upscale } from '../tileset/draw.mjs';
import { composeLook, PIECE_HEIGHT, PIECE_WIDTH } from '../../src/game/look/composeLook';
import { honourArts, isHonourId } from '../../src/game/look/gymHonours';
import { STARTER_LOOK } from '../../src/game/look/look';
import { wholeLookById } from '../../src/game/look/wardrobe';
import { dressIn, packArt, type FigurePixels, type WornPackBody } from '../../src/game/look/wornPack';
import { isPackId } from '../../src/game/items/packs';

const args = process.argv.slice(2);
const out = args.find((arg) => !arg.startsWith('--') && arg !== '--') ?? 'gym-honours.png';
const option = (name: string): string | undefined => args.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1];
const zoom = Number(option('zoom') ?? 6);
const bodies = (option('bodies') ?? 'classic,rider,starter,champion-red,gym-misty,champion-leaf,rival-blue').split(',');
const combos = (option('worn') ?? 'none,cascade,soul,cascade+soul,cascade+soul+raid-pack').split(',');
const assets = new URL('../../public/assets/', import.meta.url).pathname;
const atlas = readPng(`${assets}wearables.png`);

function cropped(name: string, width: number, height: number): Uint8ClampedArray {
  const sheet = readPng(`${assets}${name}`);
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    pixels.set(sheet.data.subarray(y * sheet.width * 4, (y * sheet.width + width) * 4), y * width * 4);
  }
  return pixels;
}

interface Sheet {
  readonly body: WornPackBody;
  readonly figure: FigurePixels;
  readonly frame: number;
}

function sheetFor(name: string): Sheet {
  if (name === 'classic') return { body: 'classic', frame: 16, figure: { width: PIECE_WIDTH, under: cropped('character.png', PIECE_WIDTH, PIECE_HEIGHT) } };
  if (name === 'rider') return { body: 'rider', frame: 32, figure: { width: 128, under: cropped('player-bike.png', 128, 128) } };
  const look = name === 'starter' ? STARTER_LOOK : wholeLookById(name)?.look;
  if (!look) throw new Error(`gymHonours: no body or whole look called ${name}`);
  const { under, head } = composeLook(atlas, look, 'layers');
  return { body: 'firered', frame: 16, figure: { width: PIECE_WIDTH, under, head } };
}

const GRASS: [number, number, number] = [116, 172, 120];
const sheets = bodies.map(sheetFor);
const gap = 6;
const blockWidth = Math.max(...sheets.map(({ frame }) => frame)) * 8 + gap;
const image = canvas(blockWidth * combos.length, sheets.length * 30, GRASS);

sheets.forEach(({ body, figure, frame }, at) => {
  combos.forEach((combo, block) => {
    const ids = combo === 'none' ? [] : combo.split('+');
    const pack = ids.find(isPackId);
    const worn = [...(pack ? [packArt(pack)] : []), ...honourArts(ids.filter(isHonourId))];
    const pixels = dressIn(figure, body, worn);
    for (let row = 0; row < 4; row += 1) {
      for (let column = 0; column < 2; column += 1) {
        for (let y = 4; y < 32; y += 1) {
          for (let x = 0; x < frame; x += 1) {
            const from = ((row * 32 + y) * figure.width + column * frame + x) * 4;
            const alpha = pixels[from + 3] / 255;
            if (alpha === 0) continue;
            const to = ((at * 30 + y - 4) * image.width + block * blockWidth + (row * 2 + column) * frame + x) * 4;
            for (let c = 0; c < 3; c += 1) image.data[to + c] = Math.round(pixels[from + c] * alpha + image.data[to + c] * (1 - alpha));
          }
        }
      }
    }
  });
});
writePng(out, upscale(image, zoom));
