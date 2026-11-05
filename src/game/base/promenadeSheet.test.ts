import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { PROMENADE_PIECES, PROMENADE_SHEET } from './promenadeSheet';
import { GAME_CORNER_PIECES, GAME_CORNER_SHEET } from './generated/gameCornerPieces';

/** A PNG's size and RGBA pixels: both sheets are written 8-bit RGBA by `tools/tileset/tileSheet.mjs`. */
function readPng(path: string): { width: number; height: number; alpha: (x: number, y: number) => number } {
  const file = readFileSync(new URL(`../../../public/${path}`, import.meta.url));
  const width = file.readUInt32BE(16);
  const height = file.readUInt32BE(20);
  const chunks: Buffer[] = [];
  for (let at = 8; at < file.length; ) {
    const length = file.readUInt32BE(at);
    if (file.toString('ascii', at + 4, at + 8) === 'IDAT') chunks.push(file.subarray(at + 8, at + 8 + length));
    at += length + 12;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  const stride = width * 4;
  const pixels = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    for (let i = 0; i < stride; i += 1) {
      const byte = raw[y * (stride + 1) + 1 + i];
      const left = i >= 4 ? pixels[y * stride + i - 4] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + i] : 0;
      const corner = y > 0 && i >= 4 ? pixels[(y - 1) * stride + i - 4] : 0;
      const p = left + up - corner;
      const paeth = Math.abs(p - left) <= Math.abs(p - up) && Math.abs(p - left) <= Math.abs(p - corner) ? left : Math.abs(p - up) <= Math.abs(p - corner) ? up : corner;
      const predicted = [0, left, up, (left + up) >> 1, paeth][filter];
      pixels[y * stride + i] = (byte + predicted) & 255;
    }
  }
  return { width, height, alpha: (x, y) => pixels[y * stride + x * 4 + 3] };
}

describe.each([
  ['THE PROMENADE', PROMENADE_SHEET, PROMENADE_PIECES as Record<string, { column: number; row: number; width: number; height: number }>],
  ['THE GAME CORNER', GAME_CORNER_SHEET, GAME_CORNER_PIECES as Record<string, { column: number; row: number; width: number; height: number }>],
])("%s's sheet", (_name, sheet, pieces) => {
  const png = readPng(sheet.imagePath);

  it('is the size its module says', () => {
    expect([png.width, png.height]).toEqual([sheet.columns * 16, sheet.rows * 16]);
  });

  it('draws every piece where its module says, on the sheet and in no other piece', () => {
    const taken = new Map<string, string>();
    for (const [name, place] of Object.entries(pieces)) {
      expect([name, place.column + place.width <= sheet.columns && place.row + place.height <= sheet.rows]).toEqual([name, true]);
      let inked = 0;
      for (let y = place.row * 16; y < (place.row + place.height) * 16; y += 1) {
        for (let x = place.column * 16; x < (place.column + place.width) * 16; x += 1) {
          if (png.alpha(x, y) > 0) inked += 1;
        }
      }
      expect([name, inked > 0]).toEqual([name, true]);
      for (let y = place.row; y < place.row + place.height; y += 1) {
        for (let x = place.column; x < place.column + place.width; x += 1) {
          expect([name, taken.get(`${x},${y}`)]).toEqual([name, undefined]);
          taken.set(`${x},${y}`, name);
        }
      }
    }
  });
});
