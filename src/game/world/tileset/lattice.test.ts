import { describe, expect, it } from 'vitest';
import type { LatticeTiles } from './catalogue';
import { latticeTile, latticeTip } from './lattice';

/**
 * The cells are numbered so a failure reads as the cell FireRed would have
 * drawn: 1x is the west half and 2x the east, and the tens say which part of a
 * tree the tile is.
 */
const TILES: LatticeTiles = {
  tip: [11, 12],
  body: [21, 22],
  bodyEdge: [31, 32],
  overlap: [41, 42],
  overlapEdge: [51, 52],
  base: [61, 62],
  baseEdge: [71, 72],
  stray: 99,
};

/** A wood drawn as character art, `T` for wood, the way a map draws one. */
function wood(rows: readonly string[]) {
  const isTree = (x: number, y: number): boolean => rows[y]?.[x] === 'T';
  return {
    tile: (x: number, y: number) => latticeTile(TILES, isTree, x, y),
    tip: (x: number, y: number) => latticeTip(TILES, isTree, x, y),
  };
}

describe('the conifer lattice', () => {
  it('draws a lone tree as a tip over the ground, a body and a base, open on both sides', () => {
    // Bodies on even rows and trees on even columns: this one's body is row 2
    // and its base row 3, in columns 2 and 3.
    const lone = wood(['....', '....', '..TT', '..TT', '....']);
    expect([lone.tile(2, 2), lone.tile(3, 2)]).toEqual([31, 32]);
    expect([lone.tile(2, 3), lone.tile(3, 3)]).toEqual([71, 72]);
    expect([lone.tip(2, 1), lone.tip(3, 1)]).toEqual([11, 12]);
    // Ground beside a tree, or above its tip, carries nothing.
    expect(lone.tip(1, 1)).toBe(-1);
    expect(lone.tip(2, 0)).toBe(-1);
  });

  it('joins the shadows of two trees side by side at their bases, and not at their bodies', () => {
    const pair = wood(['TTTT', 'TTTT', '....']);
    // First row of a wood: nothing above, so the bodies stay open-cornered.
    expect([0, 1, 2, 3].map((x) => pair.tile(x, 0))).toEqual([31, 32, 31, 32]);
    // The bases meet in the middle and are open at the ends.
    expect([0, 1, 2, 3].map((x) => pair.tile(x, 1))).toEqual([71, 62, 61, 72]);
  });

  it('stacks trees on a two-row period, the base of one holding the tip of the next', () => {
    const stack = wood(['TTTT', 'TTTT', 'TTTT', 'TTTT', '....']);
    // Rows: 0 body, 1 base with a tree below, 2 body with a tree above, 3 base.
    expect([0, 1, 2, 3].map((x) => stack.tile(x, 1))).toEqual([51, 42, 41, 52]);
    expect([0, 1, 2, 3].map((x) => stack.tile(x, 2))).toEqual([31, 22, 21, 32]);
    expect([0, 1, 2, 3].map((x) => stack.tile(x, 3))).toEqual([71, 62, 61, 72]);
  });

  it('draws a tile of wood no whole tree covers as a bush, never as half a tree', () => {
    // Column 1 to 2 is off the lattice: the west half of no tree.
    const off = wood(['.TT.', '.TT.']);
    expect([off.tile(1, 0), off.tile(2, 0), off.tile(1, 1), off.tile(2, 1)]).toEqual([99, 99, 99, 99]);
    // A body row with no base under it is no tree either.
    const flat = wood(['TT', '..']);
    expect([flat.tile(0, 0), flat.tile(1, 0)]).toEqual([99, 99]);
  });

  it('only ever hangs a tip on the row above a body, which is an odd row', () => {
    const tree = wood(['..', 'TT', 'TT']);
    // Row 0 is even: FireRed's bodies are on even rows, so a tip is never there.
    expect([tree.tip(0, 0), tree.tip(1, 0)]).toEqual([-1, -1]);
    const lower = wood(['..', '..', 'TT', 'TT']);
    expect([lower.tip(0, 1), lower.tip(1, 1)]).toEqual([11, 12]);
  });
});
