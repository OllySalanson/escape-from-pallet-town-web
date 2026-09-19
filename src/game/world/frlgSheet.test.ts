import { readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { TILE_SIZE } from '../worldMap';
import {
  FRLG_MATERIALS,
  FRLG_NINE_SLICES,
  FRLG_OBJECTS,
  FRLG_SHEET_COLUMNS,
  FRLG_SHEET_ROWS,
  FRLG_TILES,
  MATERIAL_CELL_OFFSETS,
  NINE_SLICE_CELL_OFFSETS,
  frlgMaterialTileIndex,
  frlgNineSliceTileIndex,
  frlgObjectTileIndices,
  frlgTileIndex,
  type MaterialCell,
  type NineSliceCell,
  type SheetRegion,
} from './frlgSheet';

const SHEET = new URL('../../../public/assets/frlg-tiles.png', import.meta.url);

/**
 * `frlgSheet.ts` is a set of coordinates into an image, so the only thing that
 * can make it wrong is the image. Every coordinate in it is therefore read back
 * out of the PNG here: a cut that lands on empty sheet, or a layout that has
 * drifted, fails as a test rather than as a blank tile in a playtest. Two of
 * the coordinates in the first cut of this sheet were a row out, and this is
 * what would have caught them.
 */
interface Decoded {
  readonly width: number;
  readonly height: number;
  /** RGBA, four bytes per pixel, row-major. */
  readonly pixels: Buffer;
}

/** Decodes a non-interlaced 8-bit RGBA PNG - which is what this sheet is. */
const decodePng = (bytes: Buffer): Decoded => {
  expect(bytes.subarray(0, 8)).toEqual(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );

  let offset = 8;
  let width = 0;
  let height = 0;
  const data: Buffer[] = [];
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString('ascii');
    const body = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      expect(body.readUInt8(8), 'bit depth').toBe(8);
      expect(body.readUInt8(9), 'colour type (6 = RGBA)').toBe(6);
      expect(body.readUInt8(12), 'interlace').toBe(0);
    } else if (type === 'IDAT') {
      data.push(body);
    }
    offset += 12 + length;
  }

  const raw = inflateSync(Buffer.concat(data));
  const stride = width * 4;
  const pixels = Buffer.alloc(height * stride);
  // Undo the per-scanline PNG filters. Each scanline is prefixed by its filter
  // type and is decoded against the scanline above it.
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    for (let x = 0; x < stride; x += 1) {
      const left = x >= 4 ? pixels[y * stride + x - 4] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upLeft = x >= 4 && y > 0 ? pixels[(y - 1) * stride + x - 4] : 0;
      let value = line[x];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const dl = Math.abs(p - left);
        const du = Math.abs(p - up);
        const dul = Math.abs(p - upLeft);
        value += dl <= du && dl <= dul ? left : du <= dul ? up : upLeft;
      }
      pixels[y * stride + x] = value & 0xff;
    }
  }

  return { width, height, pixels };
};

/** How many of a tile's 256 pixels are not fully transparent. */
const opaqueCount = (sheet: Decoded, column: number, row: number): number => {
  let count = 0;
  for (let y = 0; y < TILE_SIZE; y += 1) {
    for (let x = 0; x < TILE_SIZE; x += 1) {
      const px = (row * TILE_SIZE + y) * sheet.width * 4 + (column * TILE_SIZE + x) * 4;
      if (sheet.pixels[px + 3] !== 0) count += 1;
    }
  }

  return count;
};

const sheetPromise = readFile(SHEET).then(decodePng);

/** Every region this module declares, flattened, so bounds and overlap are one check. */
const declaredRegions = (): (SheetRegion & { name: string })[] => [
  ...Object.values(FRLG_MATERIALS).map((m) => ({
    name: `material ${m.name}`,
    column: m.origin.column,
    row: m.origin.row,
    width: 5,
    height: 3,
  })),
  ...Object.entries(FRLG_NINE_SLICES).map(([name, cell]) => ({
    name: `nine-slice ${name}`,
    column: cell.column,
    row: cell.row,
    width: 3,
    height: 3,
  })),
  ...Object.entries(FRLG_OBJECTS).map(([name, region]) => ({ name: `object ${name}`, ...region })),
  ...Object.entries(FRLG_TILES).map(([name, cell]) => ({
    name: `tile ${name}`,
    column: cell.column,
    row: cell.row,
    width: 1,
    height: 1,
  })),
];

describe('the FireRed/LeafGreen sheet', () => {
  it('is the size the module says it is, on a plain 16px grid', async () => {
    const sheet = await sheetPromise;

    expect(sheet.width).toBe(FRLG_SHEET_COLUMNS * TILE_SIZE);
    expect(sheet.height).toBe(FRLG_SHEET_ROWS * TILE_SIZE);
    // No margin and no spacing: a separator pitch is what makes a sheet need a
    // loader of its own, and this one is addressed exactly like `classicTiles`.
    expect(sheet.width % TILE_SIZE).toBe(0);
    expect(sheet.height % TILE_SIZE).toBe(0);
  });

  it('keeps every declared region inside the sheet', () => {
    for (const region of declaredRegions()) {
      expect(region.column, `${region.name} column`).toBeGreaterThanOrEqual(0);
      expect(region.row, `${region.name} row`).toBeGreaterThanOrEqual(0);
      expect(region.column + region.width, `${region.name} right edge`).toBeLessThanOrEqual(
        FRLG_SHEET_COLUMNS,
      );
      expect(region.row + region.height, `${region.name} bottom edge`).toBeLessThanOrEqual(
        FRLG_SHEET_ROWS,
      );
    }
  });

  it('never declares two things on the same tile', () => {
    const owner = new Map<number, string>();
    for (const region of declaredRegions()) {
      for (let row = 0; row < region.height; row += 1) {
        for (let column = 0; column < region.width; column += 1) {
          const index = frlgTileIndex({ column: region.column + column, row: region.row + row });
          const existing = owner.get(index);
          expect(existing, `${region.name} overlaps ${existing} at tile ${index}`).toBeUndefined();
          owner.set(index, region.name);
        }
      }
    }
  });

  it('has art under every material cell, edges included', async () => {
    const sheet = await sheetPromise;

    for (const material of Object.values(FRLG_MATERIALS)) {
      for (const cell of Object.keys(MATERIAL_CELL_OFFSETS) as MaterialCell[]) {
        const offset = MATERIAL_CELL_OFFSETS[cell];
        const drawn = opaqueCount(
          sheet,
          material.origin.column + offset.column,
          material.origin.row + offset.row,
        );
        // A ground tile is opaque corner to corner; anything less means the cut
        // landed beside the block rather than on it.
        expect(drawn, `${material.name} ${cell}`).toBe(TILE_SIZE * TILE_SIZE);
      }
    }
  });

  it('has art under every nine-slice cell', async () => {
    const sheet = await sheetPromise;

    for (const [name, origin] of Object.entries(FRLG_NINE_SLICES)) {
      for (const cell of Object.keys(NINE_SLICE_CELL_OFFSETS) as NineSliceCell[]) {
        const offset = NINE_SLICE_CELL_OFFSETS[cell];
        const drawn = opaqueCount(sheet, origin.column + offset.column, origin.row + offset.row);
        expect(drawn, `${name} ${cell}`).toBeGreaterThan(0);
      }
    }
  });

  it('has art under every single tile', async () => {
    const sheet = await sheetPromise;

    for (const [name, cell] of Object.entries(FRLG_TILES)) {
      expect(opaqueCount(sheet, cell.column, cell.row), name).toBeGreaterThan(0);
    }
  });

  it('draws something in every object, and the ground under every tree', async () => {
    const sheet = await sheetPromise;

    for (const [name, region] of Object.entries(FRLG_OBJECTS)) {
      let drawn = 0;
      for (let row = 0; row < region.height; row += 1) {
        for (let column = 0; column < region.width; column += 1) {
          drawn += opaqueCount(sheet, region.column + column, region.row + row);
        }
      }
      // An object may be ragged - an awning leaves its corners clear - so this
      // only asserts that the region is not empty sheet.
      expect(drawn, `${name} is blank`).toBeGreaterThan(0);
    }
  });

  it('addresses tiles the way Phaser indexes them', () => {
    expect(frlgTileIndex({ column: 0, row: 0 })).toBe(0);
    expect(frlgTileIndex({ column: 3, row: 2 })).toBe(2 * FRLG_SHEET_COLUMNS + 3);
    expect(frlgMaterialTileIndex(FRLG_MATERIALS.DIRT, 'solid')).toBe(
      frlgTileIndex(FRLG_MATERIALS.DIRT.origin),
    );
    expect(frlgMaterialTileIndex(FRLG_MATERIALS.DIRT, 'north')).toBe(
      frlgTileIndex(FRLG_MATERIALS.DIRT.origin) + 3,
    );
    expect(frlgNineSliceTileIndex(FRLG_NINE_SLICES.WATER_SHALLOW, 'solid')).toBe(
      frlgTileIndex(FRLG_NINE_SLICES.WATER_SHALLOW) + FRLG_SHEET_COLUMNS + 1,
    );
    expect(frlgObjectTileIndices(FRLG_OBJECTS.FOUNTAIN)).toHaveLength(4);
    expect(frlgObjectTileIndices(FRLG_OBJECTS.TREE_BROAD_A)).toHaveLength(9);
  });

  it('gives every ground material a complete edge set, which is the point of the sheet', () => {
    // The 104-tile classic sheet has none of these. If a future cut drops the
    // inner corners to save room, a path stops being able to turn a corner.
    expect(Object.keys(MATERIAL_CELL_OFFSETS)).toHaveLength(13);
    expect(Object.keys(FRLG_MATERIALS).length).toBeGreaterThanOrEqual(8);
    for (const cell of ['innerNorthWest', 'innerNorthEast', 'innerSouthWest', 'innerSouthEast']) {
      expect(MATERIAL_CELL_OFFSETS).toHaveProperty(cell);
    }
  });
});
