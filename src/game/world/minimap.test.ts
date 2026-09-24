import { describe, expect, it } from 'vitest';
import {
  buildMinimap,
  fitPicture,
  fittedSize,
  HINT_BLOCK,
  LIT_RADIUS,
  MARK_RING,
  MINIMAP_PALETTE,
  paintMinimap,
  tilesAround,
} from './minimap';
import { WORLD_MAPS, type WorldMapId } from '../worldMap';
import { RUN_INSERTIONS } from '../run/runGeneration';
import type { Material } from './tileset/materials';

/** A little map drawn the way the real ones are: one character a tile. */
function sketch(rows: readonly string[]): {
  width: number;
  height: number;
  terrain: Material[][];
  collision: boolean[][];
} {
  const of: Readonly<Record<string, Material>> = {
    '.': 'grass',
    g: 'tall-grass',
    ',': 'earth',
    T: 'tree',
    W: 'water',
    P: 'paving',
  };
  const terrain = rows.map((row) => [...row].map((char) => of[char]));
  return {
    width: rows[0].length,
    height: rows.length,
    terrain,
    collision: terrain.map((row) => row.map((material) => material === 'tree' || material === 'water')),
  };
}

describe('the bird\'s-eye picture of a map', () => {
  const map = sketch([
    '..,,..TTTTTT',
    '..,,..TTTTTT',
    'WWWW..TTTTTT',
    'WWWW..TTTTTT',
    '..gg..TTTTTT',
    '..gg..TTTTTT',
    'PPPP..TTTTTT',
    'PPPP..TTTTTT',
  ]);

  it('draws only what has been walked, in the map\'s own characters', () => {
    const picture = buildMinimap({ map, surveyed: new Set([0, 1, 2, 3]) });

    // The walked row reads back as itself; everything under it is still dark.
    expect(picture.rows[0].slice(0, 4)).toBe('..,,');
    expect(picture.rows[7]).not.toContain('P');
  });

  it('leaves a tile nobody has walked as a shade of its block, never as its ground', () => {
    const picture = buildMinimap({ map });
    const inks = new Set(picture.rows.join(''));

    expect([...inks].every((char) => '01234+'.includes(char))).toBe(true);
  });

  it('shades the dark by what is mostly in the block, so water reads as water', () => {
    const picture = buildMinimap({ map });
    // Rows 2-3 are half water; rows 0-1 of the same blocks are not, and a block
    // is HINT_BLOCK tiles tall, so the top-left block carries the river's ink.
    expect(HINT_BLOCK).toBe(4);
    expect(picture.rows[0][0]).toBe('4');
    // The block that is nothing but wood is the darkest ink there is; the one
    // beside it is half lane and half wood, and reads as broken ground.
    expect(picture.rows[0][8]).toBe('2');
    expect(picture.rows[0][7]).toBe('1');
  });

  it('lights the ground round a landing without it having been walked', () => {
    const picture = buildMinimap({ map, lit: [{ x: 1, y: 1 }] });

    expect(picture.rows[1][1]).toBe('.');
    expect(picture.knownWalkable).toBeGreaterThan(0);
    // And no further than the light reaches.
    expect(picture.rows[7][11]).toBe('2');
  });

  it('gives what is known a shore, so the dark has an edge rather than a cut', () => {
    const picture = buildMinimap({ map, surveyed: new Set([0]) });

    expect(picture.rows[0][1]).toBe('+');
    expect(picture.rows[1][0]).toBe('+');
  });

  it('stands a mark on walked ground, and a front door on ground nobody has walked', () => {
    const picture = buildMinimap({
      map,
      surveyed: new Set([0]),
      marks: [
        { position: { x: 0, y: 0 }, char: 'i', always: true },
        { position: { x: 11, y: 7 }, char: 'I', always: true },
        { position: { x: 5, y: 5 }, char: 'X' },
      ],
    });

    expect(picture.rows[0][0]).toBe('i');
    expect(picture.rows[7][11]).toBe('I');
    // An exit nobody has walked to is not drawn: the dark is the whole point.
    expect(picture.rows[5][5]).not.toBe('X');
  });

  it('counts what is known against what there is to know', () => {
    const picture = buildMinimap({ map, surveyed: new Set([0, 1]) });

    // Eight rows of twelve, less the eight tiles of river and the forty-eight of wood.
    expect(picture.walkable).toBe(8 * 12 - 8 - 48);
    expect(picture.knownWalkable).toBe(2);
  });

  it('has an ink for every character it can draw', () => {
    const drawn = new Set(
      [
        ...buildMinimap({ map, surveyed: new Set([0, 1, 2, 3, 20, 21, 36, 50, 51]) }).rows.join(''),
        ...'iIXOH',
      ],
    );

    expect([...drawn].filter((char) => !(char in MINIMAP_PALETTE))).toEqual([]);
  });

  it('draws a map tile for tile unless it is told to condense', () => {
    for (const id of Object.keys(WORLD_MAPS) as WorldMapId[]) {
      const picture = buildMinimap({ map: WORLD_MAPS[id] });
      expect([picture.width, picture.height, picture.tilesPerPixel], id).toEqual([
        WORLD_MAPS[id].width,
        WORLD_MAPS[id].height,
        1,
      ]);
      expect(picture.rows).toHaveLength(picture.height);
    }
    const halved = buildMinimap({ map: WORLD_MAPS['floodplain-relay'], step: 2 });
    expect([halved.width, halved.height, halved.tilesPerPixel]).toEqual([64, 64, 2]);
  });

  it('keeps a way in or out when several tiles share a pixel', () => {
    // A mark is one tile, and condensed four to a pixel it is still there:
    // what a player most needs to read off a small picture is never lost to
    // the ground beside it.
    const picture = buildMinimap({
      map,
      surveyed: new Set([0, 1, 2, 3]),
      marks: [{ position: { x: 3, y: 1 }, char: 'X', always: true }],
      step: 4,
    });
    expect(picture.rows[0][0]).toBe('X');
  });
  it('opens every map on something lit, so a fresh save is an invitation', () => {
    for (const id of Object.keys(WORLD_MAPS) as WorldMapId[]) {
      const front = Object.values(RUN_INSERTIONS).find((entry) => entry.mapId === id)!;
      const picture = buildMinimap({ map: WORLD_MAPS[id], lit: [front.position] });

      expect(picture.knownWalkable).toBeGreaterThan(8);
      expect(picture.knownWalkable).toBeLessThan(picture.walkable / 4);
    }
  });

  it('reaches the same tiles from a landing however the map is shaped', () => {
    expect(tilesAround({ x: 0, y: 0 }, LIT_RADIUS, 3, 3)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    // A radius of one is the eight tiles round you and your own: the disc is
    // generous by a tile at the diagonal, so a walk leaves a rounded track
    // rather than a cross.
    expect(tilesAround({ x: 5, y: 5 }, 1, 11, 11)).toEqual([48, 49, 50, 59, 60, 61, 70, 71, 72]);
  });
});

describe('how big a picture of a map is drawn', () => {
  it('takes the largest whole number of pixels to the tile that fits', () => {
    // A pixel that is not whole is a blurred one, so 250 pixels of room draws
    // a 128-tile map at one to the tile, not at 1.95.
    expect(fitPicture({ width: 128, height: 128 }, { width: 400, height: 250 })).toEqual({ step: 1, zoom: 1 });
    expect(fitPicture({ width: 128, height: 128 }, { width: 400, height: 256 })).toEqual({ step: 1, zoom: 2 });
    expect(fitPicture({ width: 64, height: 72 }, { width: 400, height: 256 })).toEqual({ step: 1, zoom: 3 });
  });

  it('condenses only a picture with less room than the map has tiles, and by the least it can', () => {
    expect(fitPicture({ width: 128, height: 128 }, { width: 124, height: 124 })).toEqual({ step: 2, zoom: 1 });
    expect(fitPicture({ width: 128, height: 128 }, { width: 40, height: 400 })).toEqual({ step: 4, zoom: 1 });
    // And a room of nothing still answers with a picture rather than a loop.
    expect(fitPicture({ width: 128, height: 128 }, { width: 0, height: 0 }).zoom).toBe(1);
  });

  it('says how big the fitted picture comes out', () => {
    expect(fittedSize({ width: 64, height: 76 }, { step: 1, zoom: 3 })).toEqual({ width: 192, height: 228 });
    expect(fittedSize({ width: 128, height: 128 }, { step: 3, zoom: 1 })).toEqual({ width: 43, height: 43 });
  });
});

describe('the picture as pixels', () => {
  const tiny = buildMinimap({
    map: {
      width: 4,
      height: 3,
      terrain: [
        ['grass', 'grass', 'grass', 'grass'],
        ['grass', 'grass', 'grass', 'grass'],
        ['grass', 'grass', 'grass', 'grass'],
      ],
      collision: [
        [false, false, false, false],
        [false, false, false, false],
        [false, false, false, false],
      ],
    },
    surveyed: new Set(Array.from({ length: 12 }, (_tile, index) => index)),
    marks: [{ position: { x: 1, y: 1 }, char: 'X' }],
  });
  const ink = (painted: ReturnType<typeof paintMinimap>, x: number, y: number): string => {
    const at = (y * painted.width + x) * 4;
    return `#${[0, 1, 2].map((offset) => painted.data[at + offset].toString(16).padStart(2, '0')).join('')}`;
  };

  it('draws every tile as a block of its own ink at the zoom it is given', () => {
    const painted = paintMinimap(tiny, 3);
    expect([painted.width, painted.height]).toEqual([12, 9]);
    expect(ink(painted, 11, 8)).toBe(MINIMAP_PALETTE['.']);
    expect(ink(painted, 4, 4)).toBe(MINIMAP_PALETTE.X);
  });

  it('rings a mark once a tile is big enough to ring, and not before', () => {
    // At one pixel to the tile a mark is its own ink and nothing else, because
    // a ring would be the tiles beside it.
    const flat = paintMinimap(tiny, 1);
    expect(ink(flat, 0, 1)).toBe(MINIMAP_PALETTE['.']);
    // Drawn bigger, a pixel of ring stands outside the mark's own tile, so an
    // exit on green ground reads as a pin rather than a dot.
    const big = paintMinimap(tiny, 3);
    expect(ink(big, 2, 3)).toBe(MARK_RING);
    expect(ink(big, 6, 6)).toBe(MARK_RING);
    expect(ink(big, 3, 3)).toBe(MINIMAP_PALETTE.X);
  });
});
