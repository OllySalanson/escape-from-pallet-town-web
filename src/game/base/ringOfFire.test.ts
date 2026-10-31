import { describe, expect, it } from 'vitest';
import { FLARE_FRAMES, FLARE_HEIGHT, FLARE_WIDTH, RING_OF_FIRE_MS, WAVE_MS, flareAt } from './ringOfFire';

describe('the ring of fire', () => {
  it('starts where they went over, and has not reached the far side until the end of the wave', () => {
    expect(flareAt(0, 1, 1)).toBe(3);
    expect(flareAt(0, 1 + Math.PI, 1)).toBe(0);
    expect(flareAt(WAVE_MS - 1, 1 + Math.PI, 1)).toBe(0);
    expect(flareAt(WAVE_MS + 1, 1 + Math.PI, 1)).toBe(3);
  });

  it('runs both ways round alike', () => {
    for (let ms = 0; ms < RING_OF_FIRE_MS; ms += 50) {
      expect(flareAt(ms, 1 + 0.8, 1)).toBe(flareAt(ms, 1 - 0.8, 1));
    }
    // Across the place the angle wraps, too.
    expect(flareAt(100, Math.PI * 2 - 0.1, 0.1)).toBe(flareAt(100, 0.3, 0.1));
  });

  it('settles back to the everyday flame, and stays there', () => {
    expect(flareAt(RING_OF_FIRE_MS, 1 + Math.PI, 1)).toBe(0);
    expect(flareAt(0 + 500, 1, 1)).toBeLessThan(flareAt(100, 1, 1));
    expect(flareAt(10000, 1, 1)).toBe(0);
  });

  it('draws its flames to the size they say', () => {
    for (const frame of FLARE_FRAMES) {
      expect(frame).toHaveLength(FLARE_HEIGHT);
      for (const row of frame) {
        expect(row).toHaveLength(FLARE_WIDTH);
      }
    }
  });
});
