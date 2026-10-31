import type Phaser from 'phaser';
import type { GridPosition } from '../movement/gridMovement';

/**
 * The hall's rings and stands are pictures the size of the hall that are mostly
 * nothing: a ring of steps round a hole, a band of seats behind a wall. Drawn as
 * one image, every empty pixel of them is still blended into every frame, and
 * eight of them lie over wherever the player stands. A graphics card shrugs at
 * that; a machine drawing without one spent half its frame rate on it. So each is
 * drawn as the squares of it that have anything in them, on one Blitter that moves
 * as one picture.
 */
export const SPARSE_CELL = 32;

/** The top-left corner of every cell of a picture with any ink in it, row by row. */
export function inkedCells(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  cell: number = SPARSE_CELL,
): readonly GridPosition[] {
  const cells: GridPosition[] = [];
  for (let top = 0; top < height; top += cell) {
    for (let left = 0; left < width; left += cell) {
      if (hasInk(data, width, left, top, Math.min(left + cell, width), Math.min(top + cell, height))) {
        cells.push({ x: left, y: top });
      }
    }
  }
  return cells;
}

function hasInk(data: Uint8ClampedArray, width: number, left: number, top: number, right: number, bottom: number): boolean {
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      if (data[(y * width + x) * 4 + 3] !== 0) {
        return true;
      }
    }
  }
  return false;
}

/** Each texture is read once: a restarted scene stands the same squares up again. */
const cellsOfTexture = new WeakMap<Phaser.Textures.Texture, readonly GridPosition[]>();

function cellsOf(texture: Phaser.Textures.Texture): readonly GridPosition[] {
  const known = cellsOfTexture.get(texture);
  if (known) {
    return known;
  }
  const canvas = texture.getSourceImage() as HTMLCanvasElement;
  const { width, height } = canvas;
  const ink = canvas.getContext('2d')?.getImageData(0, 0, width, height).data;
  const cells = ink ? inkedCells(ink, width, height) : [];
  for (const { x, y } of cells) {
    texture.add(frameName({ x, y }), 0, x, y, Math.min(SPARSE_CELL, width - x), Math.min(SPARSE_CELL, height - y));
  }
  cellsOfTexture.set(texture, cells);
  return cells;
}

const frameName = (cell: GridPosition): string => `sparse:${cell.x},${cell.y}`;

/** A painted canvas texture, drawn at its top-left corner as only the squares of it that hold anything. */
export function addSparsePicture(
  scene: Phaser.Scene,
  texture: string,
  x: number,
  y: number,
  depth: number,
): Phaser.GameObjects.Blitter {
  const blitter = scene.add.blitter(x, y, texture).setDepth(depth);
  for (const cell of cellsOf(scene.textures.get(texture))) {
    blitter.create(cell.x, cell.y, frameName(cell));
  }
  return blitter;
}
