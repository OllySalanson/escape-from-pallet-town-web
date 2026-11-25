import { describe, expect, it } from 'vitest';
import { linkTable } from '../movement/gridMovement';
import { CHART_CELLS, chartLight, chartTileOf, fogChart, foggedChart, paintChart, tileCells, type ChartSheet } from './chart';
import type { MapLayers, TileLayer } from './tiles';

/** A sheet of two 16x16 tiles: tile 0 red on its left half and clear on its right, tile 1 solid blue. */
function sheet(): ChartSheet {
  const width = 32;
  const data = new Uint8ClampedArray(width * 16 * 4);
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 32; x += 1) {
      const at = (y * width + x) * 4;
      if (x < 8) {
        data.set([255, 0, 0, 255], at);
      } else if (x >= 16) {
        data.set([0, 0, 200, 255], at);
      }
    }
  }
  return { firstIndex: 100, columns: 2, rows: 1, width, data };
}

function layer(tiles: number[][], flips?: boolean[][]): TileLayer {
  return {
    tiles,
    tints: tiles.map((row) => row.map(() => -1)),
    flips: flips ?? tiles.map((row) => row.map(() => false)),
  };
}

const empty = (width: number, height: number): number[][] => Array.from({ length: height }, () => Array<number>(width).fill(-1));

describe('THE MAP is the map shrunk from its own tiles', () => {
  it('draws each tile as cells, each the mean of the sheet pixels it covers', () => {
    const cells = tileCells([sheet()]);
    const red = cells(100, false)!;
    // The left half of the tile is red: the cells there are red and covered,
    // the cells of the clear right half are not covered at all.
    expect(Array.from(red.slice(0, 4))).toEqual([255, 0, 0, 1]);
    const right = (CHART_CELLS - 1) * 4;
    expect(Array.from(red.slice(right, right + 4))).toEqual([0, 0, 0, 0]);
    // Flipped, the red is on the right.
    const flipped = cells(100, true)!;
    expect(Array.from(flipped.slice(right, right + 4))).toEqual([255, 0, 0, 1]);
    expect(cells(5, false)).toBeNull();
  });

  it('lays a layer over the one under it, as the scene does', () => {
    const map = {
      layers: {
        ground: layer([[101]]),
        overlay: layer([[100]]),
        detail: layer(empty(1, 1)),
        canopy: layer(empty(1, 1)),
        brim: layer(empty(1, 1)),
      } as unknown as MapLayers,
    };
    const picture = paintChart(map, { x: 0, y: 0, width: 1, height: 1 }, tileCells([sheet()]));
    expect(picture.width).toBe(CHART_CELLS);
    // Red over blue on the left, the blue ground showing through on the right.
    expect(Array.from(picture.data.slice(0, 4))).toEqual([255, 0, 0, 255]);
    const right = (CHART_CELLS - 1) * 4;
    expect(Array.from(picture.data.slice(right, right + 4))).toEqual([0, 0, 200, 255]);
  });

  it('lights only the tiles stood on, with a shore of one tile round them', () => {
    const rect = { x: 0, y: 0, width: 5, height: 1 };
    const light = chartLight(rect, (tile) => tile.x === 2);
    expect(light).toEqual(['fog', 'shore', 'known', 'shore', 'fog']);
  });

  it('leaves known ground in colour and greys the fog, keeping the shape of the land in it', () => {
    const rect = { x: 0, y: 0, width: 3, height: 1 };
    const data = new Uint8ClampedArray(rect.width * CHART_CELLS * CHART_CELLS * 4);
    for (let at = 0; at < data.length; at += 4) {
      data.set([40, 200, 60, 255], at);
    }
    const picture = { width: rect.width * CHART_CELLS, height: CHART_CELLS, data };
    const seen = fogChart(picture, foggedChart(picture, rect), rect, ['known', 'shore', 'fog']);
    const cell = (tile: number) => Array.from(seen.data.slice(tile * CHART_CELLS * 4, tile * CHART_CELLS * 4 + 3));
    expect(cell(0)).toEqual([40, 200, 60]);
    const [red, green, blue] = cell(2);
    // Fog is grey: no channel far from the others, and darker than the grass under it.
    expect(Math.max(red, green, blue) - Math.min(red, green, blue)).toBeLessThan(12);
    expect(green).toBeLessThan(200);
    // The shore is halfway between.
    expect(cell(1)[1]).toBeGreaterThan(green);
    expect(cell(1)[1]).toBeLessThan(200);
    // The picture it was made from is left alone.
    expect(Array.from(picture.data.slice(2 * CHART_CELLS * 4, 2 * CHART_CELLS * 4 + 3))).toEqual([40, 200, 60]);
  });
});

describe('where the player is on THE MAP', () => {
  const width = 30;
  const areas = [
    { rect: { x: 0, y: 0, width: 20, height: 20 } },
    { rect: { x: 21, y: 0, width: 4, height: 4 } },
    { rect: { x: 21, y: 5, width: 4, height: 4 } },
  ];
  // The hall (second place) opens on (5, 6) outdoors; the cellar (third) only on the hall.
  const links = linkTable(
    [
      { from: { x: 22, y: 3 }, toward: 'down', to: { x: 5, y: 6 } },
      { from: { x: 5, y: 5 }, toward: 'up', to: { x: 22, y: 3 } },
      { from: { x: 22, y: 5 }, toward: 'up', to: { x: 22, y: 2 } },
    ],
    width,
  );
  const map = { width, areas, links } as never;

  it('is where they stand out of doors', () => {
    expect(chartTileOf(map, { x: 7, y: 8 })).toEqual({ x: 7, y: 8 });
  });

  it('is the door out of the building they are in, however deep inside', () => {
    expect(chartTileOf(map, { x: 23, y: 1 })).toEqual({ x: 5, y: 6 });
    expect(chartTileOf(map, { x: 23, y: 7 })).toEqual({ x: 5, y: 6 });
  });

  it('is where they stand on a map of one place', () => {
    expect(chartTileOf({ width: 10 }, { x: 3, y: 4 })).toEqual({ x: 3, y: 4 });
  });
});
