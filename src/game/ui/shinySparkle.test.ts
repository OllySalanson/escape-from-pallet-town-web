import { describe, expect, it } from 'vitest';
import {
  SPARKLE_LENGTH_FRAMES,
  SPARKLE_SOUND_FRAME,
  SPARKLE_WAIT_FRAMES,
  sparkleAt,
} from './shinySparkle';

/** Every star that is ever drawn, by id, with the frames it is drawn on. */
function lives(): Map<string, { frame: string; positions: { dx: number; dy: number }[] }> {
  const seen = new Map<string, { frame: string; positions: { dx: number; dy: number }[] }>();
  for (let frame = 0; frame < SPARKLE_LENGTH_FRAMES + 10; frame += 1) {
    for (const mote of sparkleAt(frame)) {
      const life = seen.get(mote.id) ?? { frame: mote.frame, positions: [] };
      life.positions.push({ dx: mote.dx, dy: mote.dy });
      seen.set(mote.id, life);
    }
  }
  return seen;
}

describe('the shiny sparkle (FireRed AnimTask_ShinySparkles)', () => {
  it('waits sixty frames, then sounds SE_SHINY with the first star', () => {
    for (let frame = 0; frame < SPARKLE_WAIT_FRAMES; frame += 1) {
      expect(sparkleAt(frame)).toEqual([]);
    }
    expect(SPARKLE_SOUND_FRAME).toBe(60);
    // The circling task's first star starts straight below the Pokemon,
    // `Sin(0, 24)` across and `Cos(0, 24)` down.
    expect(sparkleAt(60)).toEqual([{ id: 'circle-0', frame: 'star', dx: 0, dy: 24 }]);
  });

  it('puts out five stars a task, one every fourth frame: the wish star, three twinkles, the glint', () => {
    const all = lives();
    for (const task of ['circle', 'cross']) {
      expect([0, 1, 2, 3, 4].map((index) => all.get(`${task}-${index}`)?.frame)).toEqual([
        'star',
        'twinkle',
        'twinkle',
        'twinkle',
        'glint',
      ]);
    }
    expect(sparkleAt(64).map(({ id }) => id)).toContain('circle-1');
    expect(sparkleAt(63).map(({ id }) => id)).not.toContain('circle-1');
  });

  it('circles the Pokemon at a radius of 24, round from below to the right', () => {
    const circle = lives().get('circle-0')!.positions;
    expect(circle).toHaveLength(21);
    expect(circle[0]).toEqual({ dx: 0, dy: 24 });
    // A quarter turn is 64 of the GBA's 256, which at 12 a frame lands between frames 5 and 6.
    expect(circle[5].dx).toBeGreaterThan(20);
    // `Sin` shifts right, which floors a negative, so the left and upper half
    // of the ring sits a pixel further out than the rest - as on a GBA.
    for (const { dx, dy } of circle) {
      expect(Math.hypot(dx, dy)).toBeGreaterThan(22);
      expect(Math.hypot(dx, dy)).toBeLessThan(26);
    }
  });

  it('crosses the Pokemon from the lower left to the upper right, five pixels a frame, after four hidden', () => {
    const cross = lives().get('cross-0')!.positions;
    expect(cross[0]).toEqual({ dx: -27, dy: 27 });
    expect(cross.at(-1)).toEqual({ dx: 28, dy: -28 });
    expect(cross).toHaveLength(12);
    expect(sparkleAt(63).map(({ id }) => id)).not.toContain('cross-0');
    expect(sparkleAt(64).map(({ id }) => id)).toContain('cross-0');
  });

  it('is over once its last star is gone', () => {
    expect(sparkleAt(SPARKLE_LENGTH_FRAMES - 1).length).toBeGreaterThan(0);
    expect(sparkleAt(SPARKLE_LENGTH_FRAMES)).toEqual([]);
  });
});
