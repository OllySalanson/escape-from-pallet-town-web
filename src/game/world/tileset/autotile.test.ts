import { describe, expect, it } from 'vitest';
import { roleFor } from './autotile';

const at = (north: boolean, south: boolean, east: boolean, west: boolean) =>
  roleFor({ north, south, east, west });

describe('autotiling', () => {
  it('is fill when every neighbour matches', () => {
    expect(at(true, true, true, true)).toBe('fill');
  });

  it('names the edge after the side that does not match', () => {
    expect(at(false, true, true, true)).toBe('edge-n');
    expect(at(true, false, true, true)).toBe('edge-s');
    expect(at(true, true, false, true)).toBe('edge-e');
    expect(at(true, true, true, false)).toBe('edge-w');
  });

  it('names a corner after the outside of the bend', () => {
    // Neighbours below and to the right: this is the top-left of the mass.
    expect(at(false, true, true, false)).toBe('corner-nw');
    expect(at(false, true, false, true)).toBe('corner-ne');
    expect(at(true, false, true, false)).toBe('corner-sw');
    expect(at(true, false, false, true)).toBe('corner-se');
  });

  it('knows a one-tile run from a corner', () => {
    expect(at(true, true, false, false)).toBe('run-v');
    expect(at(false, false, true, true)).toBe('run-h');
  });

  it('caps a run at the end it stops', () => {
    expect(at(true, false, false, false)).toBe('cap-s');
    expect(at(false, true, false, false)).toBe('cap-n');
    expect(at(false, false, true, false)).toBe('cap-w');
    expect(at(false, false, false, true)).toBe('cap-e');
  });

  it('is a single tile when nothing around it matches', () => {
    expect(at(false, false, false, false)).toBe('single');
  });
});

describe('inside corners', () => {
  const surrounded = { north: true, south: true, east: true, west: true };

  it('is solid fill only when the diagonals match too', () => {
    expect(
      roleFor({
        ...surrounded,
        northWest: true,
        northEast: true,
        southWest: true,
        southEast: true,
      }),
    ).toBe('fill');
  });

  it('turns the corner around a notch cut out of a diagonal', () => {
    const notch = (corner: 'northWest' | 'northEast' | 'southWest' | 'southEast') =>
      roleFor({
        ...surrounded,
        northWest: true,
        northEast: true,
        southWest: true,
        southEast: true,
        [corner]: false,
      });
    expect(notch('northWest')).toBe('inner-nw');
    expect(notch('northEast')).toBe('inner-ne');
    expect(notch('southWest')).toBe('inner-sw');
    expect(notch('southEast')).toBe('inner-se');
  });

  /**
   * A sheet drawn in the thirteen-piece Pokemon shape has one tile per inside
   * corner and none for two at once, so the first is taken. This is pinned
   * rather than left to chance: it is the rule a map author has to know.
   */
  it('takes the first corner when a tile is missing more than one diagonal', () => {
    expect(
      roleFor({
        ...surrounded,
        northWest: false,
        northEast: true,
        southWest: false,
        southEast: true,
      }),
    ).toBe('inner-nw');
  });

  it('is solid fill when a sheet does not report diagonals at all', () => {
    expect(roleFor(surrounded)).toBe('fill');
  });
});
