/**
 * A map's tile layer cut into square chunks, keeping only the chunks that hold a
 * tile.
 *
 * Phaser makes a `Tile` object for every cell of a tilemap layer, drawn or not,
 * and Greystone Vale is 547 by 384 in seven layers: 1.47 million of them, about
 * 175MB of a raid's 255MB of JavaScript heap, measured with a heap sampling
 * profile on the jump in (22 Nov 2026, the AI playtesters' tab reaching 2GB).
 * Most of that was nothing: the two roof layers are empty on the vale, and the
 * detail, canopy and brim layers are under 4% filled. Cut into 64-tile chunks
 * and only the occupied ones made, the vale needs about 610 thousand tiles in
 * some 150 small layers, and every built-in map gets smaller with it.
 */

/** The side of a chunk, in tiles: big enough that a map is a few hundred layers at most, small enough to skip the empty sea and sky. */
export const LAYER_CHUNK_TILES = 64;

/** One chunk: where it starts on the map and how big it is, in tiles. */
export interface LayerChunk {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The chunks of `tiles` (rows of tile indices, -1 for nothing) that hold at least one tile, in reading order. */
export function occupiedChunks(tiles: readonly (readonly number[])[], size = LAYER_CHUNK_TILES): readonly LayerChunk[] {
  const rows = tiles.length;
  const columns = tiles.reduce((widest, row) => Math.max(widest, row.length), 0);
  const chunks: LayerChunk[] = [];
  for (let y = 0; y < rows; y += size) {
    for (let x = 0; x < columns; x += size) {
      const height = Math.min(size, rows - y);
      const width = Math.min(size, columns - x);
      if (holdsATile(tiles, x, y, width, height)) {
        chunks.push({ x, y, width, height });
      }
    }
  }
  return chunks;
}

/** The tiles of one chunk, as rows its own layer is filled from. */
export function chunkTiles(tiles: readonly (readonly number[])[], chunk: LayerChunk): number[][] {
  const rows: number[][] = [];
  for (let y = chunk.y; y < chunk.y + chunk.height; y += 1) {
    const row = tiles[y] ?? [];
    const out: number[] = [];
    for (let x = chunk.x; x < chunk.x + chunk.width; x += 1) {
      out.push(row[x] ?? -1);
    }
    rows.push(out);
  }
  return rows;
}

/** The key a chunk is found by from any tile in it (`chunkKey`), so a lookup per tile is one map read. */
export function chunkKey(x: number, y: number, size = LAYER_CHUNK_TILES): string {
  return `${Math.floor(x / size)},${Math.floor(y / size)}`;
}

function holdsATile(tiles: readonly (readonly number[])[], x: number, y: number, width: number, height: number): boolean {
  for (let row = y; row < y + height; row += 1) {
    const cells = tiles[row];
    if (!cells) continue;
    for (let column = x; column < x + width; column += 1) {
      if ((cells[column] ?? -1) >= 0) {
        return true;
      }
    }
  }
  return false;
}
