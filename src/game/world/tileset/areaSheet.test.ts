import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodePng } from '../../testing/pngPixels';
import { AREA_PIECES, AREA_SHEET, type AreaPieceName } from '../generated/areaPieces';
import { INSIDE_PROPS, INSIDE_STYLES, INSIDE_TILESETS } from './insideTileset';
import { TILE_SOURCES } from './sheets';

const TILE = 16;
const sheet = decodePng(readFileSync(new URL(`../../../../public/${AREA_SHEET.imagePath}`, import.meta.url)));
const pieces = Object.keys(AREA_PIECES) as AreaPieceName[];

function cellsOf(name: AreaPieceName): { column: number; row: number }[] {
  const at = AREA_PIECES[name];
  return Array.from({ length: at.width * at.height }, (_cell, index) => ({
    column: at.column + (index % at.width),
    row: at.row + Math.floor(index / at.width),
  }));
}

function pixelsOf(name: AreaPieceName): (readonly [number, number, number, number])[] {
  return cellsOf(name).flatMap(({ column, row }) =>
    Array.from({ length: TILE * TILE }, (_, index) =>
      sheet.at(column * TILE + (index % TILE), row * TILE + Math.floor(index / TILE)),
    ),
  );
}

/**
 * `areaPieces.ts` is written by `scripts/cut-frlg-areas.mjs` beside the image,
 * so the two can only disagree if one is regenerated without the other. This
 * reads every piece back out of the PNG, as `kantoSheet.test.ts` does.
 */
describe("the sheet a building's inside is drawn from", () => {
  it('is the size its generated table says, and loaded with every other sheet', () => {
    expect([sheet.width, sheet.height]).toEqual([AREA_SHEET.columns * TILE, AREA_SHEET.rows * TILE]);
    expect(TILE_SOURCES.map((source) => source.imagePath)).toContain(AREA_SHEET.imagePath);
  });

  it('holds every piece inside it, drawn, and on cells of its own', () => {
    const owner = new Map<string, AreaPieceName>();
    const faults: string[] = [];
    for (const name of pieces) {
      for (const { column, row } of cellsOf(name)) {
        const key = `${column},${row}`;
        if (column >= AREA_SHEET.columns || row >= AREA_SHEET.rows) {
          faults.push(`${name} runs off the sheet at ${key}`);
        }
        const other = owner.get(key);
        if (other) {
          faults.push(`${name} and ${other} share ${key}`);
        }
        owner.set(key, name);
      }
      if (pixelsOf(name).every(([, , , alpha]) => alpha === 0)) {
        faults.push(`${name} is empty`);
      }
    }
    expect(faults).toEqual([]);
  });

  /** Colours are the GBA's own five bits a channel, written as `frlg-tiles.png` writes them. */
  it('writes every colour the way the ground sheet does, and every pixel whole or clear', () => {
    const offFooting = new Set<string>();
    for (let y = 0; y < sheet.height; y += 1) {
      for (let x = 0; x < sheet.width; x += 1) {
        const [red, green, blue, alpha] = sheet.at(x, y);
        if (alpha !== 0 && alpha !== 255) {
          offFooting.add(`alpha ${alpha}`);
        }
        if (alpha === 255 && (red % 8 !== 0 || green % 8 !== 0 || blue % 8 !== 0)) {
          offFooting.add(`${red},${green},${blue}`);
        }
      }
    }
    expect([...offFooting]).toEqual([]);
  });

  /**
   * The point of cutting from the game's own metatiles: a piece of furniture
   * cut from the top layer is clear wherever it is not furniture, so it stands
   * on any floor. A floor tile and a wall tile are wholly opaque.
   */
  it('cuts furniture clear of the floor it stood on, and floors and walls whole', () => {
    const clear = (name: AreaPieceName): number =>
      pixelsOf(name).filter(([, , , alpha]) => alpha === 0).length;
    for (const name of ['house.window', 'house.tableSet', 'house.bed', 'house.plant', 'house.pcDesk'] as const) {
      expect(clear(name), name).toBeGreaterThan(16);
    }
    for (const name of ['house.floor', 'house.floorShade', 'house.wallUpper', 'house.wallLower', 'mart.floor'] as const) {
      expect(clear(name), name).toBe(0);
    }
  });
});

describe('the styles an inside is drawn in', () => {
  it('draws every style from sheets the loader fetches, and every prop from a cell that is drawn', () => {
    const loaded = new Set(TILE_SOURCES.map((source) => source.textureKey));
    for (const style of INSIDE_STYLES) {
      for (const source of INSIDE_TILESETS[style].sources) {
        expect(loaded.has(source.textureKey), `${style}: ${source.textureKey}`).toBe(true);
      }
    }
    for (const [name, prop] of Object.entries(INSIDE_PROPS)) {
      expect(prop.cells.length, name).toBe(prop.width * prop.height);
    }
  });

  it("shades a FireRed house's floor under its back wall and down its west side, and nowhere else", () => {
    const floor = INSIDE_TILESETS.house.materials.paving;
    expect(floor.edgesAtMapEdge).toBe(true);
    expect(floor.roles['edge-n']).toBe(floor.roles['edge-w']);
    expect(floor.roles['edge-s']).toBeUndefined();
    expect(floor.roles['edge-e']).toBeUndefined();
  });
});
