import { describe, expect, it } from 'vitest';
import { fontSizeOf, inkThreshold, letterGap, pixelAdvance, snapOffset } from './pixelText';

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
});
