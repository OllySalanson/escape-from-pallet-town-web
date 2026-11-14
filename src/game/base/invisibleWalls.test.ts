import { describe, expect, it } from 'vitest';
import { readPng } from '../../../tools/tileset/tileSheet.mjs';
import { WORKSHOP_UPGRADES } from '../hub/workshop';
import { getBaseMap } from './baseMap';
import { BASE_TILESET, type BasePropName } from './baseTileset';

/**
 * A wall is something you can see. The harbour's one invisible wall that a
 * playtest walked into (14 Nov 2026) was the long pier's head: two cells of
 * open quay paving with a hairline on them, solid, so the three-wide way out of
 * HARBOUR SQUARE narrowed to two for no reason anybody could see. This reads
 * the art the yard is drawn with and asks every solid cell on dry ground to
 * have something drawn over that ground.
 */

/** Below this share of a tile's pixels drawn over the ground, a solid cell looks open. */
const LEAST_DRAWN = 0.1;

/**
 * Solid cells drawn thinly on purpose, each with why. Anything else under
 * `LEAST_DRAWN` is a wall nobody can see.
 */
const DRAWN_THIN: Partial<Record<BasePropName, string>> = {
  // The pole a parasol stands on: thin, and the shade drawn over it says it is there.
  parasolRed: 'a parasol pole',
  parasolBlue: 'a parasol pole',
  parasolYellow: 'a parasol pole',
  // The middle of a game's board, which is faced from below to play it.
  derbyBoard: 'faced to play the DERBY',
  courseGate: 'faced to play THE FIELD-MOVE COURSE',
};

const sheets = BASE_TILESET.sources.map((source) => ({
  source,
  png: readPng(`public/${source.imagePath}`),
}));

/** The pixels of a tile that draw anything, as indices into its 16x16. */
function inked(tile: number): readonly number[] {
  if (tile < 0) return [];
  const sheet = sheets.find(
    ({ source }) => tile >= source.firstIndex && tile < source.firstIndex + source.columns * source.rows,
  );
  if (!sheet) throw new Error(`tile ${tile} is on none of the yard's sheets`);
  const index = tile - sheet.source.firstIndex;
  const left = (index % sheet.source.columns) * 16;
  const top = Math.floor(index / sheet.source.columns) * 16;
  const drawn: number[] = [];
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      if (sheet.png.data[((top + y) * sheet.png.width + left + x) * 4 + 3] > 0) drawn.push(y * 16 + x);
    }
  }
  return drawn;
}

describe.each([
  ['nothing built', [] as string[]],
  ['everything built', WORKSHOP_UPGRADES.map((upgrade) => upgrade.id)],
])('the yard with %s', (_name, built) => {
  const yard = getBaseMap(built);
  const propAt = (x: number, y: number): BasePropName | undefined =>
    yard.planted.find((planted) => {
      const prop = BASE_TILESET.props[planted.name];
      return x >= planted.x && x < planted.x + prop.width && y >= planted.y && y < planted.y + prop.height;
    })?.name;

  it('draws something over every solid cell of dry ground', () => {
    const unseen: string[] = [];
    for (let y = 0; y < yard.height; y += 1) {
      for (let x = 0; x < yard.width; x += 1) {
        if (!yard.collision[y][x] || yard.terrain[y][x] === 'water') continue;
        const drawn = new Set<number>();
        for (const layer of [yard.layers.overlay, yard.layers.detail, yard.layers.canopy]) {
          for (const pixel of inked(layer.tiles[y][x])) drawn.add(pixel);
        }
        if (drawn.size / 256 >= LEAST_DRAWN) continue;
        const prop = propAt(x, y);
        if (prop && DRAWN_THIN[prop]) continue;
        unseen.push(`${x},${y} (${prop ?? 'no prop'}, ${Math.round((drawn.size / 256) * 100)}% drawn)`);
      }
    }
    expect(unseen).toEqual([]);
  });

  it("walks out of HARBOUR SQUARE and down the long pier three abreast, the walkway's own width", () => {
    const pier = yard.planted.find((planted) => planted.name === 'shipPier')!;
    const walkway = [pier.x + 2, pier.x + 3, pier.x + 4];
    const blocked: string[] = [];
    // From the square's way out, between its two lamps, to the end of the pier.
    for (let y = pier.y - 2; y < pier.y + BASE_TILESET.props.shipPier.height; y += 1) {
      for (const x of walkway) if (yard.collision[y][x]) blocked.push(`${x},${y}`);
    }
    expect(blocked).toEqual([]);
  });
});
