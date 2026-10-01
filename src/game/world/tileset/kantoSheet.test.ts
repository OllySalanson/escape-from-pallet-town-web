import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodePng } from '../../testing/pngPixels';
import { KANTO_PIECES, KANTO_SHEET, type KantoPieceName } from '../generated/kantoPieces';

const TILE = 16;
const sheet = decodePng(readFileSync(new URL(`../../../../public/${KANTO_SHEET.imagePath}`, import.meta.url)));
const pieces = Object.entries(KANTO_PIECES) as [KantoPieceName, (typeof KANTO_PIECES)[KantoPieceName]][];

/** Every pixel of one tile of the sheet. */
function cellPixels(column: number, row: number): (readonly [number, number, number, number])[] {
  const pixels: (readonly [number, number, number, number])[] = [];
  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      pixels.push(sheet.at(column * TILE + x, row * TILE + y));
    }
  }
  return pixels;
}

function cellsOf(name: KantoPieceName): { column: number; row: number }[] {
  const at = KANTO_PIECES[name];
  return Array.from({ length: at.width * at.height }, (_cell, index) => ({
    column: at.column + (index % at.width),
    row: at.row + Math.floor(index / at.width),
  }));
}

/**
 * `kantoPieces.ts` is written by `scripts/cut-frlg-kanto.mjs` beside the image,
 * so the two can only disagree if one of them is regenerated without the other.
 * This reads every piece back out of the PNG, the way `frlgSheet.test.ts` does
 * for the ground sheet: a piece that lands on empty sheet or on another piece
 * fails here rather than as a blank or doubled tile on a map.
 */
describe('the Kanto sheet', () => {
  it('is the size its generated table says', () => {
    expect([sheet.width, sheet.height]).toEqual([KANTO_SHEET.columns * TILE, KANTO_SHEET.rows * TILE]);
  });

  it('holds every piece inside it, drawn, and on a cell of its own', () => {
    const owner = new Map<string, KantoPieceName>();
    const faults: string[] = [];
    for (const [name] of pieces) {
      for (const { column, row } of cellsOf(name)) {
        if (column >= KANTO_SHEET.columns || row >= KANTO_SHEET.rows) {
          faults.push(`${name} runs off the sheet at ${column},${row}`);
          continue;
        }
        const key = `${column},${row}`;
        const other = owner.get(key);
        if (other) {
          faults.push(`${name} and ${other} share ${key}`);
        }
        owner.set(key, name);
        if (cellPixels(column, row).every(([, , , alpha]) => alpha === 0)) {
          faults.push(`${name} is empty at ${key}`);
        }
      }
    }
    expect(faults).toEqual([]);
  });

  /**
   * The renders these were cut from scale a five-bit colour channel to eight
   * bits, and `frlg-tiles.png` shifts it, so the same FireRed grass came out two
   * greens a pixel apart. The cut puts every colour back on the ground sheet's
   * footing; a pixel off it is a seam where the two sheets meet.
   */
  it('writes every colour the way the ground sheet does, and every pixel whole or clear', () => {
    const offFooting = new Set<string>();
    for (let y = 0; y < sheet.height; y += 1) {
      for (let x = 0; x < sheet.width; x += 1) {
        const [red, green, blue, alpha] = sheet.at(x, y);
        if (alpha !== 0 && alpha !== 255) {
          offFooting.add(`alpha ${alpha}`);
        }
        if (alpha === 255 && (red % 8 !== 0 || green % 8 !== 0 || blue % 8 !== 0)) {
          offFooting.add(`${red},${green},${blue}`);
        }
      }
    }
    expect([...offFooting]).toEqual([]);
  });

  /**
   * A render is a picture, so a fence post comes with the grass it stood on.
   * The fence and the Gym have no green of their own, and the grass the ground
   * match missed - specks down Route 22's east rail, a tuft by the Gym door - is
   * what showed as green crumbs on paving.
   */
  it('leaves no grass in the pieces that have no green of their own', () => {
    const grey: KantoPieceName[] = [
      'fence.run',
      'fence.west',
      'fence.east',
      'fence.nw',
      'fence.ne',
      'fence.sw',
      'fence.se',
      'gym',
    ];
    const green = grey.flatMap((name) =>
      cellsOf(name).flatMap(({ column, row }) =>
        cellPixels(column, row)
          .filter(([red, g, blue, alpha]) => alpha === 255 && g > red + 16 && g > blue + 16)
          .map(() => name),
      ),
    );
    expect(green).toEqual([]);
  });
});
