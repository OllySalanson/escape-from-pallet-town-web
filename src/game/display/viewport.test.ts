import { describe, expect, it } from 'vitest';
import { computeTouchLayout } from './touchLayout';
import { viewportSize } from './viewport';

const host = (inner: [number, number], client: [number, number] | null) => ({
  innerWidth: inner[0],
  innerHeight: inner[1],
  document: { documentElement: client ? { clientWidth: client[0], clientHeight: client[1] } : null },
});

describe('viewportSize', () => {
  it('reads the window, not a layout viewport the page has overflowed', () => {
    // Measured on a 412x915 phone turned upright from its side: the landscape
    // layout still on the page widened the layout viewport to 641x1424 when the
    // resize arrived, while the root's client box was the screen itself.
    const turnedUpright = host([641, 1424], [412, 915]);

    expect(viewportSize(turnedUpright)).toEqual({ width: 412, height: 915 });
    // Laid out for the window, the game fits the phone and the pad is on it.
    const layout = computeTouchLayout(412, 915, 2.625);
    expect(layout.canvas.x + layout.canvas.width).toBeLessThanOrEqual(412);
    expect(layout.dpad.y + layout.dpad.height).toBeLessThanOrEqual(915);
    // For the overflowed one it fitted neither.
    const wrong = computeTouchLayout(641, 1424, 2.625);
    expect(wrong.canvas.width).toBeGreaterThan(412);
    expect(wrong.dpad.y).toBeGreaterThan(915);
  });

  it('is the inner size where the root has no box yet', () => {
    expect(viewportSize(host([1280, 800], [0, 0]))).toEqual({ width: 1280, height: 800 });
    expect(viewportSize(host([1280, 800], null))).toEqual({ width: 1280, height: 800 });
  });

  it('is the same as the inner size on a window nothing overflows', () => {
    expect(viewportSize(host([1920, 1080], [1920, 1080]))).toEqual({ width: 1920, height: 1080 });
  });
});
