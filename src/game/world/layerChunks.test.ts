import { describe, expect, it } from 'vitest';
import { getWorldMap } from '../worldMap';
import { chunkKey, chunkTiles, occupiedChunks } from './layerChunks';
import type { TileLayer } from './tiles';

describe('a tile layer cut into chunks', () => {
  const grid = (width: number, height: number, filled: readonly (readonly [number, number])[]): number[][] =>
    Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => (filled.some(([fx, fy]) => fx === x && fy === y) ? 7 : -1)));

  it('makes only the chunks that hold a tile, cut short at the map edge', () => {
    const tiles = grid(10, 7, [[1, 1], [9, 6]]);
    expect(occupiedChunks(tiles, 4)).toEqual([
      { x: 0, y: 0, width: 4, height: 4 },
      { x: 8, y: 4, width: 2, height: 3 },
    ]);
  });

  it('makes nothing of an empty layer', () => {
    expect(occupiedChunks(grid(10, 7, []), 4)).toEqual([]);
  });

  it('copies a chunk out with its own corner at 0,0', () => {
    const tiles = grid(10, 7, [[9, 6]]);
    const [chunk] = occupiedChunks(tiles, 4);
    expect(chunkTiles(tiles, chunk)).toEqual([
      [-1, -1],
      [-1, -1],
      [-1, 7],
    ]);
    expect(chunkKey(9, 6, 4)).toBe('2,1');
  });

  // The measure the chunks were made for: Greystone Vale's seven layers were
  // 1.47 million Phaser tiles, about 175MB of a raid's heap (22 Nov 2026).
  it('keeps every Greystone Vale tile in well under half the cells of whole layers', () => {
    const { layers } = getWorldMap('greystone-vale');
    let whole = 0;
    let chunked = 0;
    for (const layer of [layers.ground, layers.overlay, layers.detail, layers.canopy, layers.brim, layers.roofGround, layers.roof] as readonly TileLayer[]) {
      whole += layer.tiles.length * (layer.tiles[0]?.length ?? 0);
      const drawn = layer.tiles.flat().filter((tile) => tile >= 0).length;
      let kept = 0;
      for (const chunk of occupiedChunks(layer.tiles)) {
        chunked += chunk.width * chunk.height;
        kept += chunkTiles(layer.tiles, chunk).flat().filter((tile) => tile >= 0).length;
      }
      expect(kept).toBe(drawn);
    }
    expect(chunked).toBeLessThan(whole / 2);
  });
});
