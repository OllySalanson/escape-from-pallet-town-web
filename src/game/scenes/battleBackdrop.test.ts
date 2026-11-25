import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodePng } from '../testing/pngPixels';
import { BASE_STAGE_HEIGHT, BASE_STAGE_WIDTH, MAX_STAGE_HEIGHT, MAX_STAGE_WIDTH } from '../display/stage';
import {
  DOUBLE_PLAYER_PLATFORM,
  FOE_PLATFORM,
  PLAYER_GROUND,
  doubleBattleBackdrop,
  widenedBackdrop,
  BACKDROP_SIDE,
  BACKDROP_SKY,
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

describe('the backdrop carried to the edges of the screen (the box in a box, 25 Nov 2026)', () => {
  const source = art();

  it('reaches past the widest and tallest screen the battle can be on', () => {
    expect((BACKDROP_SIDE * BASE_STAGE_WIDTH) / source.width).toBeGreaterThanOrEqual((MAX_STAGE_WIDTH - BASE_STAGE_WIDTH) / 2);
    // The field is drawn 180 tall from the art's 143 rows.
    expect((BACKDROP_SKY * 180) / source.height).toBeGreaterThanOrEqual((MAX_STAGE_HEIGHT - BASE_STAGE_HEIGHT) / 2);
  });

  for (const [name, art, mirrorGround] of [
    ['single', source, true],
    ['double', doubleBattleBackdrop(source), false],
  ] as const) {
    describe(`a ${name} battle`, () => {
      const wide = widenedBackdrop(art, { mirrorGround });

      it('keeps the art itself exactly where it was', () => {
        for (let y = 0; y < art.height; y += 1) {
          for (let x = 0; x < art.width; x += 1) {
            expect(pixel(wide, x + BACKDROP_SIDE, y + BACKDROP_SKY)).toBe(pixel(art, x, y));
          }
        }
      });

      it('puts one blue over the art, the top row\'s at its right edge, so no seam runs up the sky', () => {
        const blue = pixel(art, art.width - 1, 0);
        for (let y = 0; y < BACKDROP_SKY; y += 1) {
          for (let x = 0; x < wide.width; x += 1) {
            expect(pixel(wide, x, y)).toBe(blue);
          }
        }
      });

      it('draws no rim to the edge of the screen: the foe platform stops at its tip', () => {
        for (let y = 0; y < wide.height; y += 1) {
          for (let x = BACKDROP_SIDE + art.width; x < wide.width; x += 1) {
            expect(pixel(wide, x, y)).not.toBe(RIM);
          }
        }
      });

      it('carries every row of field above the ground on as its own band', () => {
        for (let y = 0; y < PLAYER_GROUND.top; y += 1) {
          const band = pixel(wide, 0, y + BACKDROP_SKY);
          expect(band).not.toBe(RIM);
          for (let x = 0; x < BACKDROP_SIDE; x += 1) {
            expect(pixel(wide, x, y + BACKDROP_SKY)).toBe(band);
          }
        }
      });
    });
  }

  it("carries the player's ground off the left edge in mirror, grass and rim, as FireRed's runs off its screen", () => {
    const wide = widenedBackdrop(source, { mirrorGround: true });
    let rim = 0;
    for (let y = PLAYER_GROUND.top; y < source.height; y += 1) {
      for (let x = 0; x < BACKDROP_SIDE; x += 1) {
        const mirrored = pixel(source, BACKDROP_SIDE - 1 - x, y);
        expect(pixel(wide, x, y + BACKDROP_SKY)).toBe(mirrored);
        rim += mirrored === RIM ? 1 : 0;
      }
    }
    expect(rim).toBeGreaterThan(0);
  });
});
