import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodePng } from '../testing/pngPixels';
import {
  DOUBLE_PLAYER_PLATFORM,
  FOE_PLATFORM,
  PLAYER_GROUND,
  doubleBattleBackdrop,
  type RgbaImage,
} from './battleBackdrop';

/** The art as the scene crops it: the file without its top row, 255 wide. */
const art = (): RgbaImage => {
  const png = decodePng(readFileSync('public/assets/battle/background-grass.png'));
  const width = 255;
  const height = 143;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      data.set(png.at(x, y + 1), (y * width + x) * 4);
    }
  }
  return { width, height, data };
};

const pixel = (image: RgbaImage, x: number, y: number): string =>
  Array.from(image.data.slice((y * image.width + x) * 4, (y * image.width + x) * 4 + 3)).join(',');

const RIM = '88,72,32';

describe("the double battle's backdrop (playtest section 3, item 3)", () => {
  const source = art();
  const double = doubleBattleBackdrop(source);

  it('stands a copy of the foe platform under the player pair, rim and all', () => {
    const dx = DOUBLE_PLAYER_PLATFORM.left - FOE_PLATFORM.left;
    const dy = DOUBLE_PLAYER_PLATFORM.top - FOE_PLATFORM.top;
    let rim = 0;
    for (let y = FOE_PLATFORM.rimTop; y <= FOE_PLATFORM.bottom; y += 1) {
      for (let x = FOE_PLATFORM.left; x <= FOE_PLATFORM.right; x += 1) {
        if (pixel(source, x, y) === RIM) {
          rim += 1;
          expect(pixel(double, x + dx, y + dy)).toBe(RIM);
        }
      }
    }
    expect(rim).toBeGreaterThan(150);
  });

  it('never lets the copy touch the foe platform it was cut from', () => {
    const copyRight = DOUBLE_PLAYER_PLATFORM.left + (FOE_PLATFORM.right - FOE_PLATFORM.left);
    expect(copyRight).toBeLessThan(FOE_PLATFORM.left);
    for (let y = FOE_PLATFORM.top; y <= FOE_PLATFORM.bottom; y += 1) {
      for (let x = FOE_PLATFORM.left; x <= FOE_PLATFORM.right; x += 1) {
        expect(pixel(double, x, y)).toBe(pixel(source, x, y));
      }
    }
  });

  it('paints out the player ground the plates hide, so no fringe shows beside them', () => {
    let left = 0;
    for (let y = PLAYER_GROUND.top; y < source.height; y += 1) {
      for (let x = 0; x <= PLAYER_GROUND.right; x += 1) {
        expect(pixel(double, x, y)).not.toBe(RIM);
        left += pixel(source, x, y) === RIM ? 1 : 0;
      }
    }
    // It was there to paint out.
    expect(left).toBeGreaterThan(20);
  });
});
