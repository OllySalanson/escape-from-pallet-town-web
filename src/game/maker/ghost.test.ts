import { describe, expect, it } from 'vitest';
import { ghostBounds } from './ghost';
import { planPiece } from './placement';
import { blankMap } from './draft';

describe("a placement's ghost", () => {
  it('makes room for everything the thing will be: where it stands, hangs, clears and is refused', () => {
    // A broadleaf's crown is its top row, and the top of its crown is drawn in the row above that.
    const plan = planPiece(blankMap(), 'tree', { x: 10, y: 10 });
    const bounds = ghostBounds({
      footprint: plan.footprint,
      overhang: plan.overhang,
      drawn: plan.brim,
      doorsteps: plan.doorsteps,
      clears: plan.clears,
      blocked: plan.blocked,
      ok: plan.ok,
    });
    expect(bounds).toEqual({ x: 10, y: 9, width: 3, height: 4 });
  });

  it('covers nothing when nothing is shown', () => {
    expect(
      ghostBounds({ footprint: [], doorsteps: [], clears: [], blocked: [], ok: true }),
    ).toBeUndefined();
  });
});
