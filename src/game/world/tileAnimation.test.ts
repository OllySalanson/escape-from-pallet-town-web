import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { getBaseMap } from '../base/baseMap';
import { TILE_ANIMATIONS, TILE_ANIMATION_SHEET } from './generated/tileAnimations';
import { TILE_ANIMATIONS_BY_TILE, TILE_ANIMATION_SOURCE, TileAnimator, animatedTileAt } from './tileAnimation';

/** Decodes a non-interlaced 8-bit RGBA PNG, which is what all three sheets are. */
function decodePng(path: string): { width: number; pixels: Buffer } {
  const bytes = readFileSync(new URL(`../../../public/${path}`, import.meta.url));
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
      expect([path, body[8], body[9]]).toEqual([path, 8, 6]);
    } else if (type === 'IDAT') {
      data.push(body);
    }
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(data));
  const stride = width * 4;
  const pixels = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x += 1) {
      const left = x >= 4 ? pixels[y * stride + x - 4] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upLeft = x >= 4 && y > 0 ? pixels[(y - 1) * stride + x - 4] : 0;
      let value = raw[y * (stride + 1) + 1 + x];
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
      pixels[y * stride + x] = value & 255;
    }
  }
  return { width, pixels };
}

const cell = (sheet: { width: number; pixels: Buffer }, column: number, row: number): Buffer => {
  const out = Buffer.alloc(16 * 16 * 4);
  for (let y = 0; y < 16; y += 1) {
    const from = ((row * 16 + y) * sheet.width + column * 16) * 4;
    sheet.pixels.copy(out, y * 64, from, from + 64);
  }
  return out;
};

const SHEETS = {
  frlg: 'assets/frlg-tiles.png',
  kanto: 'assets/frlg-kanto.png',
} as const;

describe('FireRed\'s moving ground', () => {
  it('starts every animation on the still cell it replaces, so nothing changes until it moves', () => {
    const frames = decodePng(TILE_ANIMATION_SHEET.imagePath);
    const sheets = { frlg: decodePng(SHEETS.frlg), kanto: decodePng(SHEETS.kanto) };
    TILE_ANIMATIONS.forEach((animation, row) => {
      const still = cell(sheets[animation.sheet], animation.column, animation.row);
      const first = cell(frames, 0, row);
      let worst = 0;
      for (let i = 0; i < still.length; i += 4) {
        expect([row, i, first[i + 3]]).toEqual([row, i, still[i + 3]]);
        if (still[i + 3] === 0) continue;
        for (let c = 0; c < 3; c += 1) worst = Math.max(worst, Math.abs(still[i + c] - first[i + c]));
      }
      expect([row, worst <= 8]).toEqual([row, true]);
    });
  });

  it('moves every animated cell through more than one picture', () => {
    const frames = decodePng(TILE_ANIMATION_SHEET.imagePath);
    TILE_ANIMATIONS.forEach((animation, row) => {
      const pictures = new Set(
        Array.from({ length: animation.frames }, (_, frame) => cell(frames, frame, row).toString('base64')),
      );
      expect([row, pictures.size > 1]).toEqual([row, true]);
    });
  });

  it('cycles on one shared clock and leaves a still tile alone', () => {
    const [still, animation] = [...TILE_ANIMATIONS_BY_TILE.entries()][0];
    expect(animatedTileAt(still, 0)).toBe(animation.frames[0]);
    expect(animatedTileAt(still, animation.frameMs)).toBe(animation.frames[1 % animation.frames.length]);
    expect(animatedTileAt(still, animation.frameMs * animation.frames.length)).toBe(animation.frames[0]);
    expect(animatedTileAt(-1, 500)).toBe(-1);
    for (const each of TILE_ANIMATIONS_BY_TILE.values()) {
      for (const frame of each.frames) {
        expect(frame).toBeGreaterThanOrEqual(TILE_ANIMATION_SOURCE.source.firstIndex);
        expect(frame).toBeLessThan(
          TILE_ANIMATION_SOURCE.source.firstIndex + TILE_ANIMATION_SOURCE.source.columns * TILE_ANIMATION_SOURCE.source.rows,
        );
      }
    }
  });

  it('moves the harbour\'s sea', () => {
    const { layers } = getBaseMap([]);
    const animated = [layers.ground, layers.overlay, layers.detail]
      .flatMap((layer) => layer.tiles.flat())
      .filter((tile) => TILE_ANIMATIONS_BY_TILE.has(tile)).length;
    expect(animated).toBeGreaterThan(500);
  });
});

describe('moving the ground of a map too big to walk over', () => {
  const [sea] = [...TILE_ANIMATIONS_BY_TILE.values()];
  const layerOf = (width: number, height: number) => {
    const tiles = Array.from({ length: height }, () => Array.from({ length: width }, () => ({ index: sea.still })));
    const asked: string[] = [];
    return {
      tiles,
      asked,
      layer: {
        still: tiles.map((row) => row.map(() => sea.still)),
        getTileAt: (x: number, y: number) => {
          asked.push(`${x},${y}`);
          return tiles[y]?.[x] ?? null;
        },
      },
    };
  };

  it('moves only what is in view, and what comes into view catches up', () => {
    const { tiles, layer } = layerOf(8, 8);
    const animator = new TileAnimator([layer]);
    animator.advance(sea.frameMs + 1, { x: 0, y: 0, width: 2, height: 2 });
    expect(tiles[0][0].index).toBe(sea.frames[1]);
    expect(tiles[5][5].index).toBe(sea.still);
    animator.advance(0, { x: 5, y: 5, width: 2, height: 2 });
    expect(tiles[5][5].index).toBe(sea.frames[1]);
  });

  it('asks nothing between frames while the view stays put', () => {
    const { asked, layer } = layerOf(4, 4);
    const animator = new TileAnimator([layer]);
    const view = { x: 0, y: 0, width: 4, height: 4 };
    animator.advance(sea.frameMs + 1, view);
    const once = asked.length;
    expect(once).toBeGreaterThan(0);
    animator.advance(1, view);
    expect(asked.length).toBe(once);
  });

  it('is not fooled by a view running off the edge of the map, or by ground that stands still', () => {
    const { tiles, layer } = layerOf(2, 2);
    layer.still[0][0] = 1;
    tiles[0][0].index = 1;
    new TileAnimator([layer]).advance(sea.frameMs + 1, { x: -3, y: -3, width: 9, height: 9 });
    expect(tiles[0][0].index).toBe(1);
    expect(tiles[1][1].index).toBe(sea.frames[1]);
  });
});
