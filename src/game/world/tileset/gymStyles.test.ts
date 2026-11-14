import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodePng } from '../../testing/pngPixels';
import { GYM_LAYOUTS, GYM_PIECES, GYM_SHEET, type GymPieceName } from '../generated/gymPieces';
import { MapSketch } from '../mapGrid';
import { buildMapLayers } from '../tiles';
import { gymTile } from './gymSheet';
import { INSIDE_TILESETS } from './insideTileset';
import { TILE_SOURCES } from './sheets';

const sheet = decodePng(readFileSync(new URL(`../../../../public/${GYM_SHEET.imagePath}`, import.meta.url)));

/** A room's ground drawn in a style, as the tile at every cell. */
function drawn(style: 'cerulean-gym' | 'fuchsia-gym', ground: readonly string[]): number[][] {
  const map = new MapSketch({ width: ground[0].length, height: ground.length, fill: 'P' });
  map.draw(0, 0, ground);
  return buildMapLayers(map, INSIDE_TILESETS[style]).ground.tiles;
}

/** Every cell where a style draws something other than the piece FireRed draws there. */
function unlikeFireRed(style: 'cerulean-gym' | 'fuchsia-gym', gym: 'cerulean' | 'fuchsia'): string[] {
  const { ground, pieces } = GYM_LAYOUTS[gym];
  const tiles = drawn(style, ground);
  const byTile = new Map(Object.keys(GYM_PIECES).map((name) => [gymTile(name as GymPieceName), name]));
  const unlike: string[] = [];
  pieces.forEach((row, y) =>
    row.forEach((piece, x) => {
      if (piece && tiles[y][x] !== gymTile(piece)) {
        unlike.push(`${x},${y}: ${byTile.get(tiles[y][x]) ?? tiles[y][x]}, FireRed draws ${piece}`);
      }
    }),
  );
  return unlike;
}

describe('the sheet the two gyms are drawn from', () => {
  it('is the size its generated table says, loaded with every other sheet, and holds every piece drawn', () => {
    expect(sheet.width).toBe(GYM_SHEET.columns * 16);
    expect(sheet.height).toBe(GYM_SHEET.rows * 16);
    expect(TILE_SOURCES.some((source) => source.imagePath === GYM_SHEET.imagePath)).toBe(true);
    for (const [name, piece] of Object.entries(GYM_PIECES)) {
      let opaque = 0;
      for (let y = 0; y < piece.height * 16; y += 1) {
        for (let x = 0; x < piece.width * 16; x += 1) {
          opaque += sheet.at(piece.column * 16 + x, piece.row * 16 + y)[3] > 0 ? 1 : 0;
        }
      }
      expect(opaque, name).toBeGreaterThan(0);
    }
  });
});

describe('Cerulean Gym, drawn as FireRed draws its pool', () => {
  it("lays FireRed's own pool cell for cell: the rim, every walkway's corners and ends, the shadows and the posts", () => {
    expect(unlikeFireRed('cerulean-gym', 'cerulean')).toEqual([]);
  });

  it('is water you cannot walk on, crossed by walkways you can', () => {
    const map = new MapSketch({ width: 5, height: 5, fill: 'P' });
    map.draw(0, 0, ['BBBBB', 'PPPPP', 'PWWWP', 'P___P', 'PPPPP']);
    const layers = buildMapLayers(map, INSIDE_TILESETS['cerulean-gym']);
    expect(layers.collision[2].slice(1, 4)).toEqual([true, true, true]);
    expect(layers.collision[3].slice(1, 4)).toEqual([false, false, false]);
  });
});

describe('Fuchsia Gym, drawn as FireRed draws it with its walls shown', () => {
  it("lays FireRed's own floor and back wall cell for cell", () => {
    expect(unlikeFireRed('fuchsia-gym', 'fuchsia')).toEqual([]);
  });

  it("draws FireRed's invisible walls as partitions you can see and cannot walk through", () => {
    const map = new MapSketch({ width: 5, height: 4, fill: 'P' });
    map.draw(0, 0, ['BBBBB', 'BBBBB', 'PFFFP', 'PPPPP']);
    const layers = buildMapLayers(map, INSIDE_TILESETS['fuchsia-gym']);
    expect(layers.collision[2]).toEqual([false, true, true, true, false]);
    expect(layers.ground.tiles[2].slice(1, 4)).toEqual([
      gymTile('maze.partitionCapW'),
      gymTile('maze.partitionRunH'),
      gymTile('maze.partitionCapE'),
    ]);
  });
});
