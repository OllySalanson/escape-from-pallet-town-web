import { describe, expect, it } from 'vitest';
import { buildMinimap, HINT_BLOCK, LIT_RADIUS, MINIMAP_PALETTE, tilesAround } from './minimap';
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

  it('draws every shipped map inside the banner the lobby gives it', () => {
    // The drop-in screen's banner is a fixed 100 game pixels tall (the
    // `.dropin-layout` rows in style.css), of which the picture's own lid and
    // frame take 24. So a map may be 76 tiles tall at one pixel to the tile,
    // and Viridian Forest at 72 draws 96 pixels of banner inside that 100.
    // Wider than the pane is the other way it would be clipped rather than
    // scaled, and nothing is drawn at less than one pixel to the tile on
    // purpose - see `MINIMAP_TILE`.
    for (const id of Object.keys(WORLD_MAPS) as WorldMapId[]) {
      expect(WORLD_MAPS[id].width).toBeLessThanOrEqual(64);
      expect(WORLD_MAPS[id].height).toBeLessThanOrEqual(76);
    }
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
