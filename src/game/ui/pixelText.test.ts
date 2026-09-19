import { describe, expect, it } from 'vitest';
import { fontSizeOf, greyness, inkMask, inkThreshold, letterGap, pixelAdvance, snapOffset } from './pixelText';

describe('pixel text', () => {
  it('reads the size out of a canvas font shorthand', () => {
    expect(fontSizeOf("bold 16px 'Orange Kid'")).toBe(16);
    expect(fontSizeOf('10.5px monospace')).toBe(10.5);
    expect(fontSizeOf('1em serif')).toBeNull();
  });

  it('asks for half coverage where a stem fills a pixel, and less where it cannot', () => {
    expect(inkThreshold(16)).toBe(128);
    expect(inkThreshold(8)).toBeLessThan(128);
    expect(inkThreshold(8)).toBeGreaterThan(0);
  });

  it('nudges ink onto the nearest pixel column', () => {
    expect(snapOffset(1.3)).toBeCloseTo(-0.3);
    expect(snapOffset(1.6)).toBeCloseTo(0.4);
    expect(snapOffset(2)).toBe(0);
  });

  it('never lets two letters touch, at any size a scene asks for', () => {
    for (const size of [8, 10, 11, 13, 14, 16, 22]) {
      expect(letterGap(size)).toBeGreaterThanOrEqual(1);
    }
    expect(letterGap(16)).toBe(2);
  });

  it('sets an inked glyph tight and leaves a space the width the face gives it', () => {
    // The same letter advances the same distance whatever fraction it measured at.
    expect(pixelAdvance(7.4, 5, 2)).toBe(7);
    expect(pixelAdvance(6.6, 5, 2)).toBe(7);
    expect(pixelAdvance(4.4, null, 2)).toBe(4);
    expect(pixelAdvance(0.2, null, 2)).toBe(1);
  });

  it('calls a pixel grey by how far it is from being ink or paper', () => {
    expect(greyness(0)).toBe(0);
    expect(greyness(255)).toBe(0);
    expect(greyness(128)).toBe(127);
  });

  describe('which pixels of a glyph are ink', () => {
    const mask = (rows: number[][], threshold = 128): number[][] => {
      const width = rows[0].length;
      const flat = inkMask(Uint8Array.from(rows.flat()), width, rows.length, threshold);
      return rows.map((_, y) => [...flat.slice(y * width, (y + 1) * width)]);
    };

    it('keeps a crossbar that fell evenly across two rows, one pixel thick', () => {
      // The bar that closes a P: under the bar in both rows, so it used to vanish.
      expect(
        mask([
          [255, 0, 0, 0, 255],
          [255, 120, 120, 120, 255],
          [255, 110, 110, 110, 255],
          [255, 0, 0, 0, 255],
        ]),
      ).toEqual([
        [1, 0, 0, 0, 1],
        [1, 1, 1, 1, 1],
        [1, 0, 0, 0, 1],
        [1, 0, 0, 0, 1],
      ]);
    });

    it('does not thicken a stroke that is already ink with its own soft edge', () => {
      expect(
        mask([
          [0, 0, 0],
          [100, 100, 100],
          [255, 255, 255],
          [0, 0, 0],
        ]),
      ).toEqual([
        [0, 0, 0],
        [0, 0, 0],
        [1, 1, 1],
        [0, 0, 0],
      ]);
    });

    it('leaves a lone grey pixel as paper: a crest has to be part of a stroke', () => {
      expect(
        mask([
          [0, 0, 0],
          [0, 120, 0],
          [0, 0, 0],
        ]),
      ).toEqual([
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ]);
    });
  });
});
