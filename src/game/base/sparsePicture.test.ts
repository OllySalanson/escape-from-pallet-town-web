import { describe, expect, it } from 'vitest';
import { inkedCells } from './sparsePicture';

/** An RGBA picture with one opaque pixel at each of `inked`. */
function picture(width: number, height: number, inked: readonly (readonly [number, number])[]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (const [x, y] of inked) {
    data[(y * width + x) * 4 + 3] = 255;
  }
  return data;
}

describe('the squares of a mostly empty picture', () => {
  it('finds nothing in nothing', () => {
    expect(inkedCells(picture(64, 64, []), 64, 64, 32)).toEqual([]);
  });

  it('keeps the square of every inked pixel, and no other', () => {
    expect(inkedCells(picture(64, 64, [[0, 0], [63, 63]]), 64, 64, 32)).toEqual([
      { x: 0, y: 0 },
      { x: 32, y: 32 },
    ]);
  });

  it('counts a faint pixel as ink, because it is drawn', () => {
    const data = picture(32, 32, []);
    data[3] = 1;
    expect(inkedCells(data, 32, 32, 32)).toEqual([{ x: 0, y: 0 }]);
  });

  it('reaches the last, short squares of a picture that does not divide evenly', () => {
    expect(inkedCells(picture(40, 40, [[39, 39]]), 40, 40, 32)).toEqual([{ x: 32, y: 32 }]);
  });
});
