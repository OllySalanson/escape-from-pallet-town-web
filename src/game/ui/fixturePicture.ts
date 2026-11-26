/**
 * What one of Brock's rungs builds, drawn for a menu: the very props it plants
 * in the yard (`base/fixtures.ts`), tile for tile from the base's own sheets
 * (`base/baseTileset.ts`), so the workshop shows the mast it would put up rather
 * than a sentence about one (the menu overhaul, `docs/screens/menu-overhaul/`;
 * the captain's "progress he can see beats a ledger").
 *
 * Where each tile goes is pure and tested (`fixtureArt`); putting the pixels on
 * a canvas is `drawFixture`, handed the sheets the game has already loaded.
 */
import { BASE_FIXTURES } from '../base/fixtures';
import { BASE_TILESET } from '../base/baseTileset';
import type { TileSource } from '../world/tileset/catalogue';

/** One tile of the picture: where it is drawn, in pixels, and what is drawn there. */
export interface FixtureTile {
  readonly x: number;
  readonly y: number;
  readonly tile: number;
  readonly flipX: boolean;
}

export interface FixtureArt {
  /** In pixels, one source pixel to one game pixel. */
  readonly width: number;
  readonly height: number;
  readonly tiles: readonly FixtureTile[];
}

const TILE = 16;

/**
 * The tiles of a rung's fixture, laid out in its own box: every prop it plants
 * at its place relative to the others, and a prop's brim (the crown or roof it
 * draws over the row above its footprint) in that row. Undefined for a rung
 * with no fixture, which `baseMap.test.ts` says there are none of.
 */
export function fixtureArt(upgradeId: string): FixtureArt | undefined {
  const fixture = BASE_FIXTURES.find((one) => one.upgradeId === upgradeId);
  if (!fixture || fixture.props.length === 0) {
    return undefined;
  }
  const props = fixture.props.map((placed) => ({ placed, prop: BASE_TILESET.props[placed.name] }));
  const brimmed = props.some(({ prop }) => prop.brim !== undefined);
  const left = Math.min(...props.map(({ placed }) => placed.x));
  const top = Math.min(...props.map(({ placed }) => placed.y)) - (brimmed ? 1 : 0);
  const right = Math.max(...props.map(({ placed, prop }) => placed.x + prop.width));
  const bottom = Math.max(...props.map(({ placed, prop }) => placed.y + prop.height));
  const tiles: FixtureTile[] = [];
  for (const { placed, prop } of props) {
    prop.brim?.tiles.forEach((tile, column) => {
      if (tile >= 0) {
        tiles.push({ x: (placed.x - left + column) * TILE, y: (placed.y - 1 - top) * TILE, tile, flipX: false });
      }
    });
    prop.cells.forEach((cell, index) => {
      if (cell.tile < 0) {
        return;
      }
      const column = index % prop.width;
      const row = Math.floor(index / prop.width);
      tiles.push({ x: (placed.x - left + column) * TILE, y: (placed.y - top + row) * TILE, tile: cell.tile, flipX: cell.flipX === true });
    });
  }
  return { width: (right - left) * TILE, height: (bottom - top) * TILE, tiles };
}

/** The sheet a tile index is on, by its first index: the base's one numbering over several images. */
export function sourceOfTile(tile: number, sources: readonly TileSource[] = BASE_TILESET.sources): TileSource | undefined {
  let best: TileSource | undefined;
  for (const source of sources) {
    if (source.firstIndex <= tile && tile < source.firstIndex + source.columns * source.rows && (!best || source.firstIndex > best.firstIndex)) {
      best = source;
    }
  }
  return best;
}

/**
 * Puts a fixture's pixels on a canvas the size of its art. `image` is the sheet
 * a texture key names, from the textures the game already holds; a tile whose
 * sheet is not there is left out rather than drawn wrong.
 */
export function drawFixture(
  canvas: HTMLCanvasElement,
  art: FixtureArt,
  image: (textureKey: string) => CanvasImageSource | undefined,
): void {
  canvas.width = art.width;
  canvas.height = art.height;
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, art.width, art.height);
  for (const placed of art.tiles) {
    const source = sourceOfTile(placed.tile);
    const sheet = source ? image(source.textureKey) : undefined;
    if (!source || !sheet) {
      continue;
    }
    const local = placed.tile - source.firstIndex;
    const sx = (local % source.columns) * TILE;
    const sy = Math.floor(local / source.columns) * TILE;
    if (placed.flipX) {
      context.save();
      context.translate(placed.x + TILE, placed.y);
      context.scale(-1, 1);
      context.drawImage(sheet, sx, sy, TILE, TILE, 0, 0, TILE, TILE);
      context.restore();
    } else {
      context.drawImage(sheet, sx, sy, TILE, TILE, placed.x, placed.y, TILE, TILE);
    }
  }
}

/** How tall a build's picture may be on its card, in game pixels. */
export const FIXTURE_CARD_HEIGHT = 48;

/**
 * What a fixture's size is divided by to stand whole in a card's picture box:
 * one where it fits, else the smallest whole number that makes it fit - the
 * beacon at half, the mast at a third.
 */
export function fixtureDivisor(art: Pick<FixtureArt, 'height'>): number {
  return Math.max(1, Math.ceil(art.height / FIXTURE_CARD_HEIGHT));
}

/**
 * The fixture made smaller by a whole number: painted whole, then one pixel in
 * every `divisor` kept, so a tall machine fits its card with nothing cut and
 * every pixel still on the grid. Never smoothed.
 */
export function drawFixtureScaled(
  canvas: HTMLCanvasElement,
  art: FixtureArt,
  image: (textureKey: string) => CanvasImageSource | undefined,
  divisor: number,
): void {
  if (divisor <= 1) {
    drawFixture(canvas, art, image);
    return;
  }
  const full = document.createElement('canvas');
  drawFixture(full, art, image);
  canvas.width = Math.ceil(art.width / divisor);
  canvas.height = Math.ceil(art.height / divisor);
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(full, 0, 0, art.width, art.height, 0, 0, canvas.width, canvas.height);
}