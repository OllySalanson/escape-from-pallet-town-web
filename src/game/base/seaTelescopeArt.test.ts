import { describe, expect, it } from 'vitest';
import type { PaintedPicture } from '../world/minimap';
import { PANORAMA } from './seaTelescope';
import { TELESCOPE_BACK, TELESCOPE_EYE, TELESCOPE_INKS, capsOnRow, isWaveRow, opaqueBox, paintGrid, paintSeaView, shrinkPicture } from './seaTelescopeArt';

const pixelAt = (picture: PaintedPicture, x: number, y: number): string => {
  const at = (y * picture.width + x) * 4;
  return [...picture.data.slice(at, at + 4)].join(',');
};

describe("the sea THE POINT's coin telescope looks over", () => {
  it('paints exactly the view asked for, every pixel of it opaque, at any hour and zoom', () => {
    for (const light of ['day', 'dusk', 'night'] as const) {
      for (const zoom of [1, 2, 4, 2.5]) {
        const picture = paintSeaView(light, 0, { left: 300, top: 40, zoom, width: 123, height: 77 });
        expect(picture.width).toBe(123);
        expect(picture.height).toBe(77);
        for (let index = 3; index < picture.data.length; index += 4) {
          expect(picture.data[index]).toBe(255);
        }
      }
    }
  });

  it('paints the same sea at the same place whenever it is asked', () => {
    const view = { left: 500, top: 80, zoom: 2, width: 64, height: 64 };
    expect(paintSeaView('day', 1, view).data).toEqual(paintSeaView('day', 1, view).data);
  });

  it('moves the swell between its two frames', () => {
    const view = { left: 500, top: 100, zoom: 1, width: 200, height: 100 };
    expect(paintSeaView('day', 0, view).data).not.toEqual(paintSeaView('day', 1, view).data);
  });

  it('magnified, draws its caps longer rather than fatter: a cap at 4x is no more than two pixels of the screen deep', () => {
    const zoom = 4;
    const row = PANORAMA.horizon + 60;
    const capRow = [...Array(20).keys()].map((index) => row + index).find((candidate) => isWaveRow(candidate))!;
    const [from] = capsOnRow(capRow, 0, 0, PANORAMA.width).filter(([start]) => start > 10);
    const view = { left: from[0] - 2, top: capRow - 2, zoom, width: 40, height: 24 };
    const picture = paintSeaView('day', 0, view);
    const column = (from[0] - view.left) * zoom + 1;
    const white = [...Array(picture.height).keys()].filter((y) => pixelAt(picture, column, y) === '248,248,248,255');
    expect(white.length).toBeGreaterThan(0);
    expect(white.length).toBeLessThanOrEqual(zoom / 2);
  });

  it('keeps the caps closer together out by the horizon than near in', () => {
    const far = capsOnRow(PANORAMA.horizon + 4, 0, 0, PANORAMA.width).length;
    const near = capsOnRow(PANORAMA.height - 4, 0, 0, PANORAMA.width).length;
    expect(far).toBeGreaterThan(near);
  });
});

describe("the coin telescope from behind", () => {
  it('is a whole grid, every ink named, with the eye between its two eyepieces', () => {
    const width = TELESCOPE_BACK[0].length;
    for (const row of TELESCOPE_BACK) {
      expect(row).toHaveLength(width);
      for (const cell of row) expect(cell === '.' || cell in TELESCOPE_INKS, cell).toBe(true);
    }
    expect(TELESCOPE_EYE.x).toBe(width / 2);
    const picture = paintGrid(TELESCOPE_BACK, TELESCOPE_INKS);
    expect(picture.width).toBe(width);
    expect(picture.height).toBe(TELESCOPE_BACK.length);
  });
});

describe('a Pokémon drawn small', () => {
  const square: PaintedPicture = (() => {
    const data = new Uint8ClampedArray(8 * 8 * 4);
    // An opaque 4x4 block, red, at (2, 2).
    for (let y = 2; y < 6; y += 1) for (let x = 2; x < 6; x += 1) data.set([200, 10, 10, 255], (y * 8 + x) * 4);
    return { width: 8, height: 8, data };
  })();

  it('finds the square its body takes up', () => {
    expect(opaqueBox(square)).toEqual({ left: 2, top: 2, right: 5, bottom: 5 });
  });

  it('shrinks it a whole number of times, each pixel there or not, never half seen', () => {
    const half = shrinkPicture(square, 2);
    expect(half.width).toBe(4);
    expect(opaqueBox(half)).toEqual({ left: 1, top: 1, right: 2, bottom: 2 });
    for (let index = 3; index < half.data.length; index += 4) expect([0, 255]).toContain(half.data[index]);
    expect(pixelAt(half, 1, 1)).toBe('200,10,10,255');
  });
});
