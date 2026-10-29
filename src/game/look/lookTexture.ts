/**
 * A look made into something Phaser can draw: one sprite sheet per look,
 * composed the first time it is asked for (`composeLook`) and kept for the
 * page, laid out exactly as `character.png` is - seventeen frames wide - so
 * every frame index the player is drawn with means the same frame on either.
 * Its walk cycle is registered beside it under `getWalkAnimationKey`.
 *
 * The classic look is `character.png` itself and is never composed. So is any
 * look asked for where nothing can be composed - no wearables sheet loaded, or
 * no canvas (a scene under test) - because a figure in the classic clothes is
 * always better than no figure.
 */
import type Phaser from 'phaser';
import {
  CHARACTER_FRAME_HEIGHT,
  CHARACTER_FRAME_WIDTH,
  CHARACTER_SHEET_COLUMNS,
  getWalkAnimationKey,
  getWalkFrames,
} from '../playerFrames';
import type { Direction } from '../movement/gridMovement';
import { SHARED_CHARACTER_TEXTURE } from '../world/characterPresentation';
import { composeLook, PIECE_HEIGHT, PIECE_WIDTH, type Pixels } from './composeLook';
import { lookKey, type PlayerLook } from './look';

export const WEARABLES_TEXTURE = 'wearables';
export const WEARABLES_ASSET_PATH = 'assets/wearables.png';

const DIRECTIONS: readonly Direction[] = ['down', 'right', 'up', 'left'];
const WALK_FRAME_RATE = 10;

/** The texture a look is drawn from, composing it the first time. */
export function lookTexture(scene: Phaser.Scene, look: PlayerLook): string {
  if (!look) {
    return SHARED_CHARACTER_TEXTURE;
  }
  const key = `look:${lookKey(look)}`;
  const textures = scene.textures as Phaser.Textures.TextureManager | undefined;
  if (!textures || typeof textures.exists !== 'function') {
    return SHARED_CHARACTER_TEXTURE;
  }
  if (textures.exists(key)) {
    return key;
  }
  const atlas = wearablesAtlas(textures);
  if (!atlas || typeof document === 'undefined') {
    return SHARED_CHARACTER_TEXTURE;
  }
  const canvas = document.createElement('canvas');
  canvas.width = CHARACTER_FRAME_WIDTH * CHARACTER_SHEET_COLUMNS;
  canvas.height = PIECE_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) {
    return SHARED_CHARACTER_TEXTURE;
  }
  const image = context.createImageData(PIECE_WIDTH, PIECE_HEIGHT);
  image.data.set(composeLook(atlas, look));
  context.putImageData(image, 0, 0);
  textures.addSpriteSheet(key, canvas as unknown as HTMLImageElement, {
    frameWidth: CHARACTER_FRAME_WIDTH,
    frameHeight: CHARACTER_FRAME_HEIGHT,
  });
  registerWalk(scene, key);
  return key;
}

/** The walk cycle's key for a figure drawn from `texture`, the classic one included. */
export function lookWalkKey(texture: string, direction: Direction): string {
  return texture === SHARED_CHARACTER_TEXTURE
    ? getWalkAnimationKey(direction)
    : getWalkAnimationKey(direction, texture);
}

function registerWalk(scene: Phaser.Scene, key: string): void {
  const anims = scene.anims as Phaser.Animations.AnimationManager | undefined;
  if (!anims || typeof anims.create !== 'function') {
    return;
  }
  for (const direction of DIRECTIONS) {
    const walk = getWalkAnimationKey(direction, key);
    if (anims.exists(walk)) continue;
    anims.create({
      key: walk,
      frames: anims.generateFrameNumbers(key, { frames: getWalkFrames(direction) }),
      frameRate: WALK_FRAME_RATE,
      repeat: -1,
    });
  }
}

let atlasCache: Pixels | null = null;

/** The wearables sheet's pixels, read once from the loaded texture. */
export function wearablesAtlas(textures: Phaser.Textures.TextureManager): Pixels | null {
  if (atlasCache) {
    return atlasCache;
  }
  if (!textures.exists(WEARABLES_TEXTURE)) {
    return null;
  }
  const source = textures.get(WEARABLES_TEXTURE).getSourceImage() as
    HTMLImageElement | HTMLCanvasElement;
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext('2d');
  if (!context) {
    return null;
  }
  context.drawImage(source, 0, 0);
  const { data } = context.getImageData(0, 0, source.width, source.height);
  atlasCache = { width: source.width, height: source.height, data };
  return atlasCache;
}
