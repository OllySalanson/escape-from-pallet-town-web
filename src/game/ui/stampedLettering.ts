import type Phaser from 'phaser';
import { GAME_FONT } from './gameFont';

/**
 * Big words made out of the game's own face, as the title's logo is: a word is
 * set in Orange Kid by `pixelText.ts` (so every pixel is whole), cut out as a
 * mask, and then stamped again in other colours round and under itself for
 * the edge, the rim and the depth. Nothing is scaled, so a forty-pixel word is
 * as crisp as a twelve-pixel one. The title (`TitleScene`) and THE RAID
 * ARENA's trailer (`ArenaIntroScene`) both letter with it.
 */

/**
 * One word set by the game itself, as a mask: every inked pixel opaque and
 * every other clear, cropped to its ink.
 */
export function letteringMask(scene: Phaser.Scene, text: string, fontSize: string): HTMLCanvasElement {
  const words = scene.make.text({ x: 0, y: 0, text, style: { fontFamily: GAME_FONT, fontSize, color: '#ffffff' } }, false);
  words.updateText();
  const source = words.canvas;
  const context = source.getContext('2d', { willReadFrequently: true })!;
  const data = context.getImageData(0, 0, source.width, source.height);
  let top = source.height;
  let bottom = -1;
  let left = source.width;
  let right = -1;
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const at = (y * source.width + x) * 4 + 3;
      const on = data.data[at] >= 128;
      data.data[at] = on ? 255 : 0;
      if (on) {
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
        left = Math.min(left, x);
        right = Math.max(right, x);
      }
    }
  }
  const mask = document.createElement('canvas');
  mask.width = Math.max(1, right - left + 1);
  mask.height = Math.max(1, bottom - top + 1);
  mask.getContext('2d')!.putImageData(data, -left, -top);
  words.destroy();
  return mask;
}

/** The mask in one colour. */
export function tintedMask(mask: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const tinted = document.createElement('canvas');
  tinted.width = mask.width;
  tinted.height = mask.height;
  const context = tinted.getContext('2d')!;
  context.drawImage(mask, 0, 0);
  context.globalCompositeOperation = 'source-in';
  context.fillStyle = color;
  context.fillRect(0, 0, mask.width, mask.height);
  return tinted;
}

/**
 * Stamps `mask` at every offset within `reach` (a rounded square, its
 * corners left off) and `drop` further down - which is how a one-colour
 * outline and the depth under it are drawn out of the letters themselves.
 */
export function stampMask(
  context: CanvasRenderingContext2D,
  mask: HTMLCanvasElement,
  color: string,
  x: number,
  y: number,
  reach: number,
  drop: number,
): void {
  const ink = tintedMask(mask, color);
  for (let dy = -reach; dy <= reach + drop; dy += 1) {
    for (let dx = -reach; dx <= reach; dx += 1) {
      const cornerY = dy < -reach + 1 ? -reach : dy > reach + drop - 1 ? reach : 0;
      if (reach > 0 && Math.abs(dx) === reach && Math.abs(cornerY) === reach) {
        continue;
      }
      context.drawImage(ink, x + dx, y + dy);
    }
  }
}

export interface StampedWordStyle {
  readonly fontSize: string;
  /** The fill, top to bottom, in equal bands. */
  readonly fill: readonly string[];
  readonly rim: string;
  readonly depth: string;
  readonly edge: string;
  /** How many pixels the word stands up off what is under it. */
  readonly depthPx: number;
}

/**
 * A whole stamped word as a texture, under `key`: an edge round everything,
 * the rim inside it, the depth below, and the banded fill. Hands back its
 * size; made again if the key is already taken, so a name can change.
 */
export function stampedWord(
  scene: Phaser.Scene,
  key: string,
  text: string,
  style: StampedWordStyle,
): { readonly width: number; readonly height: number } {
  const word = letteringMask(scene, text, style.fontSize);
  const pad = 3;
  const width = word.width + pad * 2;
  const height = word.height + style.depthPx + pad * 2;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d')!;
  stampMask(context, word, style.edge, pad, pad, 2, style.depthPx);
  stampMask(context, word, style.depth, pad, pad, 1, style.depthPx - 1);
  stampMask(context, word, style.rim, pad, pad, 1, 0);
  const fill = document.createElement('canvas');
  fill.width = word.width;
  fill.height = word.height;
  const fillContext = fill.getContext('2d')!;
  style.fill.forEach((color, index) => {
    const from = Math.round((word.height * index) / style.fill.length);
    const to = Math.round((word.height * (index + 1)) / style.fill.length);
    fillContext.fillStyle = color;
    fillContext.fillRect(0, from, word.width, to - from);
  });
  fillContext.globalCompositeOperation = 'destination-in';
  fillContext.drawImage(word, 0, 0);
  context.drawImage(fill, pad, pad);
  if (scene.textures.exists(key)) {
    scene.textures.remove(key);
  }
  scene.textures.addCanvas(key, canvas);
  return { width, height };
}
