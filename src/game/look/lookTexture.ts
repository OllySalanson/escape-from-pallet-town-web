/**
 * A look made into something Phaser can draw: one sprite sheet per look,
 * composed the first time it is asked for (`composeLook`) and kept for the
 * page, laid out exactly as `character.png` is - seventeen frames wide - so
 * every frame index the player is drawn with means the same frame on either.
 * Its walk cycle is registered beside it under `getWalkAnimationKey`. A pack on
 * the figure's back (`wornPack.ts`) is part of the sheet, so it is one more
 * texture for each look and pack that is ever worn and costs a frame nothing.
 *
 * The classic look with no pack is `character.png` itself and is never composed. So is any
 * look asked for where nothing can be composed - no wearables sheet loaded, or
 * no canvas (a scene under test) - because a figure in the classic clothes is
 * always better than no figure.
 */
import type Phaser from 'phaser';
import {
  CHARACTER_FRAME_HEIGHT,
  CHARACTER_FRAME_WIDTH,
  CHARACTER_HEAD_PIXEL_Y,
  CHARACTER_SHEET_COLUMNS,
  getWalkAnimationKey,
  getWalkFrames,
} from '../playerFrames';
import type { Direction } from '../movement/gridMovement';
import type { PackItemId } from '../items/items';
import { isPackId } from '../items/packs';
import { BIKE_FRAME_RATE, BIKE_FRAME_SIZE, BIKE_SHEET_COLUMNS, BIKE_TEXTURE } from '../world/bicycle';
import { SHARED_CHARACTER_TEXTURE } from '../world/characterPresentation';
import { composeLook, PIECE_HEIGHT, PIECE_WIDTH, type Pixels } from './composeLook';
import { lookKey, type PlayerLook } from './look';
import { dressInPack } from './wornPack';

export const WEARABLES_TEXTURE = 'wearables';
export const WEARABLES_ASSET_PATH = 'assets/wearables.png';

const DIRECTIONS: readonly Direction[] = ['down', 'right', 'up', 'left'];
const WALK_FRAME_RATE = 10;

/**
 * The texture a look is drawn from, with `pack` on its back if it is one, composing
 * it the first time. A figure that cannot be composed is drawn in the classic
 * clothes with nothing on its back, which is always better than no figure.
 */
export function lookTexture(scene: Phaser.Scene, look: PlayerLook, pack?: string | null): string {
  const worn = isPackId(pack) ? pack : null;
  if (!look && !worn) {
    return SHARED_CHARACTER_TEXTURE;
  }
  const key = `look:${lookKey(look)}${worn ? `#${worn}` : ''}`;
  const textures = scene.textures as Phaser.Textures.TextureManager | undefined;
  if (!textures || typeof textures.exists !== 'function') {
    return SHARED_CHARACTER_TEXTURE;
  }
  if (textures.exists(key)) {
    return key;
  }
  const pixels = look
    ? dressedPixels(textures, look, worn, key)
    : classicPixels(textures, worn!);
  if (!pixels || !addSheet(textures, key, pixels, PIECE_WIDTH, CHARACTER_FRAME_WIDTH * CHARACTER_SHEET_COLUMNS, PIECE_HEIGHT, CHARACTER_FRAME_WIDTH, CHARACTER_FRAME_HEIGHT)) {
    return SHARED_CHARACTER_TEXTURE;
  }
  registerWalk(scene, key, getWalkFrames, WALK_FRAME_RATE);
  return key;
}

/**
 * The Bicycle's rider, with `pack` on their back if it is one: on the Bicycle the
 * figure is FireRed's own, but what they carry is still theirs. Its pedalling is
 * under `getWalkAnimationKey(direction, texture)`, as on the rider with no pack.
 */
export function bikeTexture(scene: Phaser.Scene, pack?: string | null): string {
  if (!isPackId(pack)) {
    return BIKE_TEXTURE;
  }
  const key = `${BIKE_TEXTURE}#${pack}`;
  const textures = scene.textures as Phaser.Textures.TextureManager | undefined;
  if (!textures || typeof textures.exists !== 'function') {
    return BIKE_TEXTURE;
  }
  if (textures.exists(key)) {
    return key;
  }
  const sheet = sheetPixels(textures, BIKE_TEXTURE);
  const side = BIKE_FRAME_SIZE * BIKE_SHEET_COLUMNS;
  if (!sheet || sheet.width !== side) {
    return BIKE_TEXTURE;
  }
  const pixels = dressInPack({ width: side, under: sheet.data }, 'rider', pack);
  if (!addSheet(textures, key, pixels, side, side, side, BIKE_FRAME_SIZE, BIKE_FRAME_SIZE)) {
    return BIKE_TEXTURE;
  }
  registerWalk(scene, key, (direction) => getWalkFrames(direction, BIKE_SHEET_COLUMNS), BIKE_FRAME_RATE);
  return key;
}

function dressedPixels(
  textures: Phaser.Textures.TextureManager,
  look: NonNullable<PlayerLook>,
  pack: PackItemId | null,
  key: string,
): Uint8ClampedArray | null {
  const atlas = wearablesAtlas(textures);
  if (!atlas) {
    return null;
  }
  const { under, head } = composeLook(atlas, look, 'layers');
  headRows.set(key, firstDrawnRow(head));
  if (pack) {
    return dressInPack({ width: PIECE_WIDTH, under, head }, 'firered', pack);
  }
  for (let at = 0; at < under.length; at += 4) {
    if (head[at + 3]) {
      under.set(head.subarray(at, at + 4), at);
    }
  }
  return under;
}

/** The classic figure's walking frames with a pack on: the first four columns of `character.png`. */
function classicPixels(textures: Phaser.Textures.TextureManager, pack: PackItemId): Uint8ClampedArray | null {
  const sheet = sheetPixels(textures, SHARED_CHARACTER_TEXTURE);
  if (!sheet) {
    return null;
  }
  const under = new Uint8ClampedArray(PIECE_WIDTH * PIECE_HEIGHT * 4);
  for (let y = 0; y < PIECE_HEIGHT; y += 1) {
    under.set(sheet.data.subarray(y * sheet.width * 4, (y * sheet.width + PIECE_WIDTH) * 4), y * PIECE_WIDTH * 4);
  }
  return dressInPack({ width: PIECE_WIDTH, under }, 'classic', pack);
}

/** Puts pixels on a canvas of `canvasWidth` by `height` and hands it to Phaser as a sprite sheet. */
function addSheet(
  textures: Phaser.Textures.TextureManager,
  key: string,
  pixels: Uint8ClampedArray,
  width: number,
  canvasWidth: number,
  height: number,
  frameWidth: number,
  frameHeight: number,
): boolean {
  if (typeof document === 'undefined') {
    return false;
  }
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    return false;
  }
  const image = context.createImageData(width, height);
  image.data.set(pixels);
  context.putImageData(image, 0, 0);
  textures.addSpriteSheet(key, canvas as unknown as HTMLImageElement, { frameWidth, frameHeight });
  return true;
}

/** Where each composed look's head starts, by texture: a cap stands taller than a crop. */
const headRows = new Map<string, number>();

/** The first row the standing frame facing down draws anything on. */
function firstDrawnRow(pixels: Uint8ClampedArray): number {
  for (let y = 0; y < CHARACTER_FRAME_HEIGHT; y += 1) {
    for (let x = 0; x < CHARACTER_FRAME_WIDTH; x += 1) {
      if (pixels[(y * PIECE_WIDTH + x) * 4 + 3]) return y;
    }
  }
  return CHARACTER_HEAD_PIXEL_Y;
}

/**
 * How many pixels lower than the classic figure's a look's head starts: what
 * anything placed over the player's head - the chevron that marks them, a
 * name plate, a wave - is lowered by, so it sits on this head and not on air
 * where a taller one would be. Nought for the classic figure.
 */
export function lookHeadDrop(texture: string): number {
  return (headRows.get(texture) ?? CHARACTER_HEAD_PIXEL_Y) - CHARACTER_HEAD_PIXEL_Y;
}

/** The walk cycle's key for a figure drawn from `texture`, the classic one included. */
export function lookWalkKey(texture: string, direction: Direction): string {
  return texture === SHARED_CHARACTER_TEXTURE
    ? getWalkAnimationKey(direction)
    : getWalkAnimationKey(direction, texture);
}

function registerWalk(
  scene: Phaser.Scene,
  key: string,
  framesFor: (direction: Direction) => number[],
  frameRate: number,
): void {
  const anims = scene.anims as Phaser.Animations.AnimationManager | undefined;
  if (!anims || typeof anims.create !== 'function') {
    return;
  }
  for (const direction of DIRECTIONS) {
    const walk = getWalkAnimationKey(direction, key);
    if (anims.exists(walk)) continue;
    anims.create({
      key: walk,
      frames: anims.generateFrameNumbers(key, { frames: framesFor(direction) }),
      frameRate,
      repeat: -1,
    });
  }
}

/** A loaded sheet's pixels, read once: a canvas read is the one dear thing here, and sheets do not change. */
const sheetCache = new Map<string, Pixels>();

function sheetPixels(textures: Phaser.Textures.TextureManager, key: string): Pixels | null {
  const held = sheetCache.get(key);
  if (held) {
    return held;
  }
  if (!textures.exists(key) || typeof textures.get !== 'function' || typeof document === 'undefined') {
    return null;
  }
  const source = textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext('2d');
  if (!context) {
    return null;
  }
  context.drawImage(source, 0, 0);
  const { data } = context.getImageData(0, 0, source.width, source.height);
  const pixels = { width: source.width, height: source.height, data };
  sheetCache.set(key, pixels);
  return pixels;
}

/** The wearables sheet's pixels, read once from the loaded texture. */
export function wearablesAtlas(textures: Phaser.Textures.TextureManager): Pixels | null {
  return sheetPixels(textures, WEARABLES_TEXTURE);
}
