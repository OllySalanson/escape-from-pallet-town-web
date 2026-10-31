/**
 * Draws every pack on every body in every facing and every frame of the walk,
 * big enough to criticise, on grass.
 *
 *   npx vite-node tools/look/wornPacks.mts -- out.png [--body=classic|firered|rider|<look-head>] [--zoom=6]
 */
import { readPng, writePng } from '../tileset/tileSheet.mjs';
import { canvas, plot, upscale } from '../tileset/draw.mjs';
import { composeLook, PIECE_HEIGHT, PIECE_WIDTH } from '../../src/game/look/composeLook';
import { dressInPack, type FigurePixels, type WornPackBody } from '../../src/game/look/wornPack';
import { STARTER_LOOK, type PlayerLook } from '../../src/game/look/look';
import { PACK_IDS } from '../../src/game/items/packs';
import type { PackItemId } from '../../src/game/items/items';

const args = process.argv.slice(2);
const out = args.find((arg) => !arg.startsWith('--') && arg !== '--') ?? 'worn-packs.png';
const option = (name: string): string | undefined =>
  args.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1];
const zoom = Number(option('zoom') ?? 6);
const assets = new URL('../../public/assets/', import.meta.url).pathname;

const atlas = readPng(`${assets}wearables.png`);
const classic = readPng(`${assets}character.png`);
const bike = readPng(`${assets}player-bike.png`);

function cropped(sheet: { width: number; data: Uint8Array }, width: number, height: number): Uint8ClampedArray {
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

function sheetFor(body: string): Sheet {
  if (body === 'classic') {
    return { body: 'classic', frame: 16, figure: { width: PIECE_WIDTH, under: cropped(classic, PIECE_WIDTH, PIECE_HEIGHT) } };
  }
  if (body === 'rider') {
    return { body: 'rider', frame: 32, figure: { width: 128, under: cropped(bike, 128, 128) } };
  }
  const look: PlayerLook = body === 'firered' ? STARTER_LOOK : JSON.parse(body);
  const { under, head } = composeLook(atlas, look, 'layers');
  return { body: 'firered', frame: 16, figure: { width: PIECE_WIDTH, under, head } };
}

const GRASS: [number, number, number] = [116, 172, 120];
const bodies = (option('body') ?? 'classic,firered,rider').split(',');
const blocks = bodies.map(sheetFor);
const packs: (PackItemId | null)[] = [null, ...PACK_IDS];
const gap = 4;
const blockWidth = Math.max(...blocks.map(({ frame }) => frame * 4)) + gap;
const image = canvas(blockWidth * packs.length, blocks.reduce((sum, { figure }) => sum + figure.under.length / 4 / figure.width + gap, 0), GRASS);

let top = 0;
for (const block of blocks) {
  const height = block.figure.under.length / 4 / block.figure.width;
  packs.forEach((pack, index) => {
    const pixels = pack
      ? dressInPack(block.figure, block.body, pack)
      : mergeFigure(block.figure);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < block.frame * 4; x += 1) {
        const at = (y * block.figure.width + x) * 4;
        if (pixels[at + 3]) {
          plot(image, index * blockWidth + x, top + y, [pixels[at], pixels[at + 1], pixels[at + 2]], pixels[at + 3]);
        }
      }
    }
  });
  top += height + gap;
}

function mergeFigure(figure: FigurePixels): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(figure.under);
  if (figure.head) {
    for (let at = 0; at < pixels.length; at += 4) {
      if (figure.head[at + 3]) pixels.set(figure.head.subarray(at, at + 4), at);
    }
  }
  return pixels;
}

writePng(out, upscale(image, zoom));
