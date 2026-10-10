import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodePng } from '../../testing/pngPixels';
import { TOWN_PIECES, TOWN_SHEET, type TownPieceName } from '../generated/townPieces';
import { TOWN_PROPS } from './townSheet';

const TILE = 16;
const sheet = decodePng(
  readFileSync(new URL(`../../../../public/${TOWN_SHEET.imagePath}`, import.meta.url)),
);
const pieces = Object.entries(TOWN_PIECES) as [
  TownPieceName,
  (typeof TOWN_PIECES)[TownPieceName],
][];

function inkIn(column: number, row: number): number {
  let ink = 0;
  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      if (sheet.at(column * TILE + x, row * TILE + y)[3] > 0) {
        ink += 1;
      }
    }
  }
  return ink;
}

/**
 * `townPieces.ts` is written by `scripts/cut-frlg-towns.mjs` beside the image,
 * so the two can only disagree if one was edited by hand: this reads every
 * piece back out of the PNG.
 */
describe('the town sheet', () => {
  it('is the size its table says', () => {
    expect([sheet.width, sheet.height]).toEqual([
      TOWN_SHEET.columns * TILE,
      TOWN_SHEET.rows * TILE,
    ]);
  });

  it.each(pieces)(
    '%s is drawn exactly where its table says, and nowhere it says is empty',
    (_name, piece) => {
      for (let y = 0; y < piece.height; y += 1) {
        for (let x = 0; x < piece.width; x += 1) {
          const ink = inkIn(piece.column + x, piece.row + y);
          expect(ink > 0, `cell ${x},${y}`).toBe(piece.cells[y][x] === '#');
        }
      }
    },
  );

  it('packs no two pieces onto the same cell', () => {
    const taken = new Set<string>();
    for (const [, piece] of pieces) {
      for (let y = 0; y < piece.height; y += 1) {
        for (let x = 0; x < piece.width; x += 1) {
          const key = `${piece.column + x},${piece.row + y}`;
          expect(taken.has(key)).toBe(false);
          taken.add(key);
        }
      }
    }
  });

  it('makes a wall of every drawn cell but the pier boards, and nothing of an empty one', () => {
    for (const [name, piece] of pieces) {
      TOWN_PROPS[name].cells.forEach((cell, index) => {
        const drawn = piece.cells[Math.floor(index / piece.width)][index % piece.width] === '#';
        expect(cell.tile >= 0).toBe(drawn);
        if (!drawn) {
          expect(cell.solid).toBe(false);
        }
      });
    }
    expect(TOWN_PROPS.pier.cells.some((cell) => cell.tile >= 0 && !cell.solid)).toBe(true);
    expect(TOWN_PROPS.silphCo.cells.every((cell) => cell.tile < 0 || cell.solid)).toBe(true);
  });
});
