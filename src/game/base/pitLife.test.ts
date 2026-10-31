import { describe, expect, it } from 'vitest';
import { podiumHole } from './arenaHall';
import { paintPodium, RING_ORIGIN, RING_WIDTH } from './arenaPit';
import {
  EYES_MS,
  EYES_WIDTH,
  EYE_LOOKS,
  SHADOW_HEIGHT,
  SHADOW_PASS_MS,
  SHADOW_WIDTH,
  chooseEyeGate,
  eyesAt,
  gateEyes,
  nextEyesInMs,
  nextShadowInMs,
  paintEyes,
  paintWingShadow,
  shadowAt,
  shadowPassFor,
} from './pitLife';

describe('what lives in the pit', () => {
  it('is rare enough to make somebody stop', () => {
    expect(nextShadowInMs(0, false)).toBeGreaterThanOrEqual(60000);
    expect(nextEyesInMs(0, false)).toBeGreaterThanOrEqual(45000);
    // But a visit of a minute or so has a fair chance of seeing something.
    expect(nextShadowInMs(0.5, true)).toBeLessThan(60000);
    expect(nextEyesInMs(0.5, true)).toBeLessThan(40000);
  });

  it('paints a shadow on a dither, with wings that beat', () => {
    const sheet = paintWingShadow();
    const inFrame = (frame: number): number => {
      let count = 0;
      for (let y = 0; y < SHADOW_HEIGHT; y += 1) {
        for (let x = 0; x < SHADOW_WIDTH; x += 1) {
          count += sheet.data[(y * sheet.width + frame * SHADOW_WIDTH + x) * 4 + 3] > 0 ? 1 : 0;
        }
      }
      return count;
    };
    expect(inFrame(0)).toBeGreaterThan(inFrame(1));
    expect(inFrame(1)).toBeGreaterThan(inFrame(2));
    // Nothing reaches the edge of its frame, so a flap never shows a cut.
    for (let frame = 0; frame < 3; frame += 1) {
      for (let y = 0; y < SHADOW_HEIGHT; y += 1) {
        expect(sheet.data[(y * sheet.width + frame * SHADOW_WIDTH) * 4 + 3]).toBe(0);
        expect(sheet.data[(y * sheet.width + frame * SHADOW_WIDTH + SHADOW_WIDTH - 1) * 4 + 3]).toBe(0);
      }
    }
  });

  it('crosses from one side of the hole to the other, whole pixels all the way, and is over', () => {
    const hole = podiumHole();
    const pass = shadowPassFor(hole.y, true);
    const first = shadowAt(pass, 0)!;
    const last = shadowAt(pass, SHADOW_PASS_MS - 1)!;
    expect(first.x + SHADOW_WIDTH / 2).toBeLessThan(hole.x - hole.rx);
    expect(last.x - SHADOW_WIDTH / 2).toBeGreaterThan(hole.x + hole.rx);
    expect(shadowAt(pass, SHADOW_PASS_MS)).toBeNull();
    expect(shadowAt(shadowPassFor(hole.y, false), 0)!.x).toBeGreaterThan(hole.x + hole.rx);
    // It takes long enough to be noticed and turned to look at.
    expect(SHADOW_PASS_MS).toBeGreaterThan(8000);
  });

  it('goes where somebody is looking, and never along the very edge of the hole', () => {
    const hole = podiumHole();
    expect(shadowPassFor(hole.y + 40, true).y).toBe(hole.y + 40);
    expect(shadowPassFor(hole.y + 9999, true).y).toBeLessThan(hole.y + hole.ry);
    expect(shadowPassFor(hole.y - 9999, true).y).toBeGreaterThan(hole.y - hole.ry);
  });

  it('looks out from between the bars of a real gate, with a bar between its eyes', () => {
    const podium = paintPodium();
    const pixel = (x: number, y: number): readonly number[] => {
      const at = ((y - RING_ORIGIN.y) * RING_WIDTH + (x - RING_ORIGIN.x)) * 4;
      return [podium.data[at], podium.data[at + 1], podium.data[at + 2]];
    };
    const dark = [4, 4, 12];
    for (let gate = 4; gate <= 13; gate += 1) {
      const { x, y } = gateEyes(gate);
      for (const row of [y, y + 1]) {
        // Black behind both eyes; somewhere in the seven columns is the bar.
        const columns = [-2, -1, 1, 2].map((dx) => pixel(x + dx, row));
        expect(columns.filter((ink) => ink.join() === dark.join()).length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('only looks out of a gate that can be seen', () => {
    expect(chooseEyeGate(0.5, () => false)).toBeNull();
    const onlyOne = gateEyes(7);
    expect(chooseEyeGate(0.99, (point) => point.x === onlyOne.x)).toBe(7);
  });

  it('opens, stares, blinks, stares and is gone', () => {
    expect(eyesAt(0)?.look).toBe('slit');
    expect(eyesAt(800)?.look).toBe('open');
    expect(eyesAt(1550)?.look).toBe('shut');
    expect(eyesAt(2500)).toEqual({ look: 'open', shift: -1 });
    expect(eyesAt(EYES_MS)).toBeNull();
    expect(paintEyes().width).toBe(EYES_WIDTH * EYE_LOOKS.length);
  });
});
