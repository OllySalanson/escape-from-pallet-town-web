import { describe, expect, it } from 'vitest';
import { LEAF_STRIPS, PAGE_TURN_MS, leafPose, leafSides, leafStrip } from './pageTurn';

const PAGE = { width: 150, height: 190 };
const SPINE = 200;

function strips(elapsed: number, side: 'left' | 'right') {
  const pose = leafPose(elapsed);
  return Array.from({ length: LEAF_STRIPS }, (_strip, index) => leafStrip(pose, side, index, SPINE, PAGE.width, PAGE.height));
}

describe('a page turning over', () => {
  it('lies flat as it is lifted and flat again once it is over', () => {
    const start = leafPose(0);
    expect(start).toMatchObject({ progress: 0, onStartSide: true, width: 1, lift: 0 });
    const end = leafPose(PAGE_TURN_MS);
    expect(end.onStartSide).toBe(false);
    expect(end.width).toBeCloseTo(1);
    expect(end.lift).toBeCloseTo(0);
  });

  it('stands on its edge, lifted highest and darkest, halfway over', () => {
    const middle = leafPose(PAGE_TURN_MS / 2);
    expect(middle.width).toBeCloseTo(0);
    expect(middle.lift).toBeCloseTo(1);
    expect(middle.shade).toBeGreaterThan(leafPose(PAGE_TURN_MS / 4).shade);
  });

  it('goes over from the right going on, and from the left going back', () => {
    expect(leafSides('forward')).toEqual({ start: 'right', end: 'left' });
    expect(leafSides('back')).toEqual({ start: 'left', end: 'right' });
  });

  it('is drawn in strips that meet edge to edge, whole page, no pixel twice', () => {
    for (const side of ['left', 'right'] as const) {
      const flat = strips(0, side);
      expect(flat.reduce((sum, strip) => sum + strip.sourceWidth, 0)).toBe(PAGE.width);
      expect(flat.reduce((sum, strip) => sum + strip.width, 0)).toBe(PAGE.width);
      const ordered = [...flat].sort((a, b) => a.x - b.x);
      for (let index = 1; index < ordered.length; index += 1) {
        expect(ordered[index].x).toBe(ordered[index - 1].x + ordered[index - 1].width);
      }
      // Lying flat it is the page exactly where it lies.
      expect(ordered[0].x).toBe(side === 'right' ? SPINE : SPINE - PAGE.width);
    }
  });

  it('keeps its spine edge on the spine as it narrows, and lifts its outer edge most', () => {
    const rising = strips(PAGE_TURN_MS * 0.3, 'right');
    expect(rising[0].x).toBe(SPINE);
    expect(rising[LEAF_STRIPS - 1].rise).toBeGreaterThan(rising[0].rise);
    const falling = strips(PAGE_TURN_MS * 0.7, 'left');
    expect(falling[0].x + falling[0].width).toBe(SPINE);
    // A page on the left is read from its right, where the spine is.
    expect(falling[0].sourceX + falling[0].sourceWidth).toBe(PAGE.width);
  });
});
