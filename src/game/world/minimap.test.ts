import { describe, expect, it } from 'vitest';
import { buildMinimap, HINT_BLOCK, LIT_RADIUS, MINIMAP_MAX_HEIGHT, MINIMAP_MAX_WIDTH, MINIMAP_PALETTE, tilesAround } from './minimap';
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
    // frame take 24 - so a picture may be 76 pixels tall, and wider than the
    // pane is the other way it would be clipped rather than scaled.
    // It is the *picture* that is held to the banner, not the map: a map too
    // big for it is drawn at two tiles to the pixel, which is what keeps a
    // 128-tile map inside the frame without making it the same size on screen
    // as a 32-tile one. Nothing is ever drawn at less than one pixel to the
    // tile - see `MINIMAP_TILE`.
    for (const id of Object.keys(WORLD_MAPS) as WorldMapId[]) {
      const picture = buildMinimap({ map: WORLD_MAPS[id] });
      expect(picture.width, id).toBeLessThanOrEqual(MINIMAP_MAX_WIDTH);
      expect(picture.height, id).toBeLessThanOrEqual(MINIMAP_MAX_HEIGHT);
      expect(picture.rows).toHaveLength(picture.height);
      expect(picture.width).toBe(Math.ceil(WORLD_MAPS[id].width / picture.tilesPerPixel));
    }
  });

  it('coarsens only the map that cannot fit, and draws the rest tile for tile', () => {
    // Four maps have grown and only one of them outgrew the banner: Route 1
    // and Viridian Forest at 64x72 still fit it, so their pictures are the
    // ground itself, and only the Floodplain at 128 square is halved.
    //
    // The price of that is stated rather than hidden: halved, the vast map
    // draws 64x64 against Route 1's 64x72, so the lobby's biggest map is not
    // its biggest picture. The alternative is scaling every map to fill the
    // box, which would make them all the same size and say nothing at all.
    const vast = buildMinimap({ map: WORLD_MAPS['floodplain-relay'] });
    expect(vast.tilesPerPixel).toBe(2);
    for (const id of Object.keys(WORLD_MAPS) as WorldMapId[]) {
      if (id === 'floodplain-relay') {
        continue;
      }
      expect(buildMinimap({ map: WORLD_MAPS[id] }).tilesPerPixel, id).toBe(1);
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
