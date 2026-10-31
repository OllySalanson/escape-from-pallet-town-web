import type { GridPosition } from '../movement/gridMovement';
import type { Rect } from '../ui/labelPlacement';
import type { PaintedPicture } from '../world/minimap';
import { CHALK_OUTLINES } from './generated/chalkOutlines';

/**
 * Brock's chalk: what he means to build in each empty bay of his workshop, drawn
 * on the floor where it will stand (the menu playtest of 31 Oct, row 3), and the
 * tally of the whole ladder on his wall.
 *
 * A bay used to be bare floor until it was paid for, which showed how much was
 * built and nothing of what was still to come. A chalk line round the very tiles
 * the thing will stand on says there is something to ask about before anybody
 * has read a word, and a bay is solid whether it holds chalk or the thing itself,
 * so the room walks the same however much of it is built and walking at one turns
 * the player to face it (`planNextGridStep`).
 *
 * Painted, because it is a picture of the save as the wall map is: whole pixels,
 * and a line that was traced from the very thing he will build.
 */

const CHALK = '#f4f0e4';
const CHALK_DUST = '#cbc8ba';

/** The piece a rung's bay is traced from, by the rung it stands for (`WORKSHOP_DISPLAY`). */
export const BAY_OUTLINES: Readonly<Record<string, string>> = {
  'radio-mast': 'warehouse.terminals',
  beacon: 'warehouse.generator',
  'secure-locker-1': 'warehouse.crate',
  'secure-locker-2': 'warehouse.crate',
  'recovery-bay-1': 'lab.machineLifted',
  'recovery-bay-2': 'lab.machineLifted',
  'quarantine-ward': 'warehouse.monitorDesk',
};

/**
 * One bay: the thing that will stand there, as a chalk line
 * (`scripts/draw-chalk-outlines.mjs` traces it from the piece itself), broken here
 * and there and gone to dust in places, so it is drawn rather than printed.
 */
export function chalkBayPoster(area: Rect, upgradeId: string): PaintedPicture {
  const width = area.width * 16;
  const height = area.height * 16;
  const data = new Uint8ClampedArray(width * height * 4);
  const rows = CHALK_OUTLINES[BAY_OUTLINES[upgradeId] ?? ''] ?? [];
  rows.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      if (cell !== '#' || (x * 3 + y * 5) % 13 === 0 || x >= width || y >= height) {
        return;
      }
      const ink = (x * 5 + y * 3) % 7 === 0 ? CHALK_DUST : CHALK;
      const rgb = [1, 3, 5].map((at) => Number.parseInt(ink.slice(at, at + 2), 16));
      data.set([rgb[0], rgb[1], rgb[2], 255], (y * width + x) * 4);
    });
  });
  return { width, height, data };
}

/** The rectangle round a bay's tiles, which is what its picture is painted into. */
export function bayArea(tiles: readonly GridPosition[]): Rect {
  const xs = tiles.map((tile) => tile.x);
  const ys = tiles.map((tile) => tile.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x + 1, height: Math.max(...ys) - y + 1 };
}

/**
 * The tally on his back wall: a row a rung in ladder order, a box with a tick in
 * it once it stands and a line of scrawl after it. It is what is faced to read
 * the whole ladder on a screen.
 */
export function ladderTallyPoster(area: Rect, builtFlags: readonly boolean[]): PaintedPicture {
  const width = area.width * 16;
  const height = area.height * 16;
  const data = new Uint8ClampedArray(width * height * 4);
  const plot = (x: number, y: number, ink: string): void => {
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return;
    }
    const rgb = [1, 3, 5].map((at) => Number.parseInt(ink.slice(at, at + 2), 16));
    data.set([rgb[0], rgb[1], rgb[2], 255], (y * width + x) * 4);
  };
  // Seven will not go down a wall in one column, so two: four rungs and three.
  const perColumn = Math.ceil(builtFlags.length / 2);
  const pitch = Math.floor(width / 2);
  builtFlags.forEach((built, index) => {
    const column = index < perColumn ? 0 : 1;
    const row = index < perColumn ? index : index - perColumn;
    const x = 2 + column * pitch;
    const y = 2 + row * 6;
    for (let along = 0; along < 5; along += 1) {
      plot(x + along, y, CHALK);
      plot(x + along, y + 4, CHALK);
    }
    for (let down = 1; down < 4; down += 1) {
      plot(x, y + down, CHALK);
      plot(x + 4, y + down, CHALK);
    }
    if (built) {
      plot(x + 1, y + 2, CHALK);
      plot(x + 2, y + 3, CHALK);
      plot(x + 3, y + 1, CHALK);
    }
    for (let along = 0; along < pitch - 10; along += 1) {
      if ((along + row) % 5 !== 3) {
        plot(x + 7 + along, y + 2 + (along % 3 === 0 ? 1 : 0), CHALK_DUST);
      }
    }
  });
  return { width, height, data };
}
