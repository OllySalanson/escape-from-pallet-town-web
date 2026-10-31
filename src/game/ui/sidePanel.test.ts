import { describe, expect, it } from 'vitest';
import { PanelLean, sidePanelCover, type LeaningCamera } from './sidePanel';

/** A camera that remembers what it was last told. */
function camera(width = 1000): LeaningCamera & { bounds: { x: number; y: number; width: number; height: number }; offsetX: number } {
  return {
    bounds: { x: 0, y: 0, width, height: 500 },
    offsetX: 0,
    getBounds() {
      return this.bounds;
    },
    setBounds(x, y, boundsWidth, height) {
      this.bounds = { x, y, width: boundsWidth, height };
    },
    setFollowOffset(x) {
      this.offsetX = x;
    },
  };
}

describe('how much of the canvas a side panel covers', () => {
  const canvas = { left: 40, right: 1240 };

  it('is measured from the right, in game pixels', () => {
    // 3x: 464 CSS pixels of panel is 155 game pixels, rounded up so a chip beside it is clear of it.
    expect(sidePanelCover(776, canvas, 400)).toBe(155);
  });

  it('is nothing when the panel stands wholly past the canvas', () => {
    expect(sidePanelCover(1300, canvas, 400)).toBe(0);
  });

  it('is nothing when the panel leaves none of the canvas to be beside', () => {
    expect(sidePanelCover(10, canvas, 400)).toBe(0);
  });
});

describe('the camera moving over for a side panel', () => {
  it('looks half the panel further east, so the player stands in the middle of what is left', () => {
    const view = camera();
    const lean = new PanelLean(() => view);
    lean.setCover(156);
    lean.settle(16, true);
    expect(view.offsetX).toBe(-78);
  });

  it('grows the bounds by the panel, so the east edge of a map comes to rest beside it rather than under it', () => {
    const view = camera();
    const lean = new PanelLean(() => view);
    lean.setCover(156);
    lean.settle(16, true);
    expect(view.bounds.width).toBe(1000 + 156);
  });

  it('puts everything back when the panel goes', () => {
    const view = camera();
    const lean = new PanelLean(() => view);
    lean.setCover(156);
    lean.settle(16, true);
    lean.setCover(0);
    lean.settle(16, true);
    expect(view.offsetX === 0).toBe(true);
    expect(view.bounds.width).toBe(1000);
  });

  it('eases there a frame at a time, on whole pixels, and says when it has come to rest', () => {
    const view = camera();
    const lean = new PanelLean(() => view);
    lean.setCover(156);
    const rests: boolean[] = [];
    for (let frame = 0; frame < 20; frame += 1) {
      rests.push(lean.settle(16, false));
      expect(Number.isInteger(view.offsetX)).toBe(true);
    }
    expect(rests.filter(Boolean)).toHaveLength(1);
    expect(rests[0]).toBe(false);
    expect(view.offsetX).toBe(-78);
    expect(view.bounds.width).toBe(1156);
  });

  it('holds no widening of bounds set afresh by a door walked through', () => {
    const view = camera();
    const lean = new PanelLean(() => view);
    lean.setCover(156);
    lean.settle(16, true);
    view.bounds = { x: 0, y: 0, width: 400, height: 256 };
    lean.boundsWereSet();
    lean.setCover(0);
    lean.settle(16, true);
    expect(view.bounds.width).toBe(400);
  });

  it('touches nothing with no panel, so a scene with no camera is never asked for one', () => {
    const lean = new PanelLean(() => {
      throw new Error('asked for a camera');
    });
    expect(lean.settle(16)).toBe(false);
  });
});
