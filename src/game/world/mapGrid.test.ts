import { describe, expect, it } from 'vitest';
import { MapSketch } from './mapGrid';

/**
 * A stamp is a letter of a map's own that stands a landmark where it is drawn.
 * It exists so that a wood is part of the picture: a tree named by a coordinate
 * in a list under the drawing stays where it was when the river beside it moves.
 */
describe('stamping landmarks into a drawing', () => {
  const stamps = {
    t: { prop: 'tree', anchor: [1, 2], ground: '.' },
    m: { prop: 'mooringPost', anchor: [0, 0], ground: 'W' },
  } as const;

  const sketch = (): MapSketch<'tree' | 'mooringPost'> =>
    new MapSketch({ width: 8, height: 6, fill: '.', stamps });

  it('plants the prop so that the letter marks its anchor, not its corner', () => {
    const map = sketch().draw(2, 1, ['...', '...', '.t.']);
    // The letter is at (3, 3) and marks the trunk, one across and two down.
    expect(map.props()).toEqual([{ name: 'tree', x: 2, y: 1 }]);
  });

  it('lays the ground the stamp names under its own letter', () => {
    const map = sketch().draw(0, 0, ['WmW', '.t.']);
    expect(map.terrainAt(1, 0)).toBe('W');
    expect(map.terrainAt(1, 1)).toBe('.');
  });

  /**
   * Blocks are meant to be drawn over each other. A tree left behind by the
   * block underneath would be standing in whatever was painted on top of it.
   */
  it('takes a stamped landmark away when ground is drawn over its letter', () => {
    const map = sketch().draw(0, 3, ['.t.']);
    expect(map.props()).toHaveLength(1);
    map.draw(0, 3, ['WWW']);
    expect(map.props()).toEqual([]);
  });

  it('leaves a landmark alone when a later block keeps that tile', () => {
    const map = sketch().draw(0, 3, ['.t.']).draw(0, 3, ['W W']);
    expect(map.props()).toEqual([{ name: 'tree', x: 0, y: 1 }]);
  });

  /**
   * A district is cut out of a forest, and the forest's trees stand on a
   * lattice that knows nothing about the cut. One left at the edge with its
   * trunk over the lane narrows a road nobody drew narrow.
   */
  describe('cutting ground under a landmark', () => {
    const woods = (): MapSketch<'tree'> =>
      new MapSketch({
        width: 7,
        height: 5,
        fill: 'T',
        stamps: {
          t: { prop: 'tree', anchor: [1, 2], ground: '.', blocks: [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0]] },
        },
      }).draw(0, 0, ['TTTTTTT', 'TTTTTTT', 'TTTtTTT', 'TTTTTTT', 'TTTTTTT']);

    it('takes the landmark away when a lane is cut under a tile it blocks', () => {
      const map = woods();
      expect(map.props()).toHaveLength(1);
      map.draw(4, 0, [',', ',', ',', ',', ',']);
      expect(map.props()).toEqual([]);
    });

    /**
     * The first version of this rule drew a block in reading order, so a tree
     * was cut down by the grass to its right in its own drawing - and an
     * orchard came out as striped lawn.
     */
    it('never lets a drawing cut down its own trees with the grass beside them', () => {
      const map = new MapSketch<'tree'>({
        width: 7,
        height: 4,
        fill: 'T',
        stamps: {
          t: { prop: 'tree', anchor: [1, 2], ground: '.', blocks: [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0]] },
        },
      }).draw(0, 0, ['.......', '.......', '.t...t.', '.......']);
      expect(map.props()).toHaveLength(2);
    });

    it('leaves it standing when the lane passes clear of it', () => {
      const map = woods().draw(5, 0, [',', ',', ',', ',', ',']);
      expect(map.props()).toHaveLength(1);
    });

    it('leaves it standing when the lane runs under its crown, which blocks nothing', () => {
      const map = woods().draw(2, 0, [',,,']);
      expect(map.props()).toHaveLength(1);
    });

    it('leaves it standing when what is drawn beside it is another wall', () => {
      const map = woods().draw(4, 0, ['W', 'W', 'W', 'W', 'W']);
      expect(map.props()).toHaveLength(1);
    });
  });

  it('keeps landmarks planted by coordinate, which nothing drawn can remove', () => {
    const map = sketch().plant(4, 4, 'tree').draw(4, 4, ['W']);
    expect(map.props()).toEqual([{ name: 'tree', x: 4, y: 4 }]);
  });

  it('refuses a stamp that would shadow a material or a content mark', () => {
    for (const taken of ['W', '.', 'g', 'X', '*', ' ']) {
      expect(
        () =>
          new MapSketch({
            width: 2,
            height: 2,
            fill: '.',
            stamps: { [taken]: { prop: 'tree', anchor: [0, 0], ground: '.' } },
          }),
      ).toThrow(/cannot be a stamp/);
    }
  });

  it('refuses a stamp whose ground is not a material', () => {
    expect(
      () =>
        new MapSketch({
          width: 2,
          height: 2,
          fill: '.',
          stamps: { t: { prop: 'tree', anchor: [0, 0], ground: '?' } },
        }),
    ).toThrow(/unknown terrain character/);
  });
});

describe('drawing a block', () => {
  it('refuses a ragged block rather than silently shifting a bank', () => {
    const map = new MapSketch({ width: 4, height: 4, fill: '.' });
    expect(() => map.draw(0, 0, ['WWW', 'WW'])).toThrow(/ragged/);
  });
});
