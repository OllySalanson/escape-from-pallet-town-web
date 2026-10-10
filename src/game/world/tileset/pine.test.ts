import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodePng } from '../../testing/pngPixels';
import type { PropDefinition, TilesetCatalogue } from './catalogue';
import { FLOOD_TOWN_TILESET } from './floodTownTileset';
import { KANTO_CONIFER, KANTO_TILESET } from './kantoTileset';
import { PLAYER_MAP_TILESET } from './playerMapTileset';

const TILE = 16;
const decoded = new Map<string, ReturnType<typeof decodePng>>();

/** How many of a tile's pixels are drawn at all, read off the sheet it comes from. */
function inkIn(catalogue: TilesetCatalogue<string>, tile: number): number {
  const source = catalogue.sources.find(
    (candidate) =>
      tile >= candidate.firstIndex &&
      tile < candidate.firstIndex + candidate.columns * candidate.rows,
  );
  if (!source) {
    throw new Error(`tile ${tile} is on none of the catalogue's sheets`);
  }
  let sheet = decoded.get(source.imagePath);
  if (!sheet) {
    sheet = decodePng(
      readFileSync(new URL(`../../../../public/${source.imagePath}`, import.meta.url)),
    );
    decoded.set(source.imagePath, sheet);
  }
  const index = tile - source.firstIndex;
  const left = (index % source.columns) * TILE;
  const top = Math.floor(index / source.columns) * TILE;
  let ink = 0;
  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      if (sheet.at(left + x, top + y)[3] > 0) {
        ink += 1;
      }
    }
  }
  return ink;
}

function rowsWithInk(catalogue: TilesetCatalogue<string>, prop: PropDefinition): boolean[] {
  return Array.from({ length: prop.height }, (_row, y) =>
    prop.cells
      .slice(y * prop.width, (y + 1) * prop.width)
      .some((cell) => cell.tile >= 0 && inkIn(catalogue, cell.tile) > 0),
  );
}

/**
 * The FireRed sheet's pine was cut without its trunk: the tree's art sat in the
 * lower two rows of a three-row footprint and stopped at its last branches, so
 * every pine on Viridian Forest, Route 1 and the Floodplain ended in a flat
 * line (the captain, on the palette board, 2026-10-10: "bottom of tre is cut
 * off"). A tree is drawn into every row of the ground it stands on.
 */
describe('the pine', () => {
  it.each([
    ['the Floodplain catalogue', FLOOD_TOWN_TILESET],
    ['the Kanto catalogue', KANTO_TILESET],
    ['the player map catalogue', PLAYER_MAP_TILESET],
  ] as const)('is the whole Kanto conifer in %s, tip to trunk', (_name, catalogue) => {
    const props = catalogue.props as Record<string, PropDefinition>;
    for (const name of ['pine', 'pineAlt']) {
      expect(props[name]).toBe(KANTO_CONIFER);
      expect(rowsWithInk(catalogue, props[name])).toEqual([true, true, true]);
    }
  });

  it('keeps the old pine footprint, so no map walks differently for the new art', () => {
    expect([KANTO_CONIFER.width, KANTO_CONIFER.height]).toEqual([2, 3]);
    expect(KANTO_CONIFER.cells.every((cell) => cell.solid)).toBe(true);
    expect(KANTO_CONIFER.cells.map((cell) => cell.canopy === true)).toEqual([
      true,
      true,
      false,
      false,
      false,
      false,
    ]);
  });
});
