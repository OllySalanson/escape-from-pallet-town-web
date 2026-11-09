import type { PaintedPicture } from '../world/minimap';
import { CHART_GRID, CHART_PIECES, chartWhole, NO_TREASURE_HUNT, type TreasureHunt } from './treasureMap';

/**
 * THE CHART ROOM's board, painted from the save onto the stretch of wall the
 * room keeps for it, as Oak's wall map and the badge case are: a wooden frame
 * round green baize, with a slot for every piece of the treasure map
 * (`CHART_GRID`). A piece on the wall shows its part of the chart; an empty
 * slot is a dashed outline round a question mark.
 *
 * The chart itself is drawn here, whole, once - sea and coast, a compass rose
 * and a ship, the tor on the moor, the pines, the cove under its cliffs and the
 * X - and each pinned piece shows only its own part of that one picture, so a
 * board is always one chart however many pieces are up. The red dotted course
 * runs through every piece, so it can only be followed end to end once the
 * chart is whole; then the frame's trim is gilded.
 *
 * Every pixel is drawn here, for this game, in the GBA's colours (each a
 * multiple of eight) with light from the top left.
 */

const TILE = 16;

const INK = {
  outline: '#382010',
  frame: '#a86830',
  frameLight: '#d89858',
  frameShade: '#704018',
  gilt: '#f8d040',
  giltShade: '#c89818',
  baize: '#305838',
  baizeDeep: '#203c28',
  dash: '#78a080',
  land: '#f0d8a8',
  landShade: '#d8b880',
  sea: '#a8c8c8',
  seaWave: '#80a8b0',
  coast: '#685030',
  ink: '#403028',
  red: '#c83020',
  redLight: '#f05838',
  tor: '#888078',
  torLight: '#b8b0a0',
  pine: '#386838',
  pineLight: '#58a050',
  cliff: '#987050',
  sand: '#f8e8b8',
  ship: '#806040',
  sail: '#f8f8f0',
  pin: '#d83828',
  pinLight: '#f8a088',
} as const;

/** The chart's colours, for anything else that draws it (`chartTable.ts`'s tracing). */
export const CHART_INK = INK;

/** The chart's own drawing area inside the frame, in board pixels. */
const FRAME = 4;

interface Painter {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray<ArrayBuffer>;
  readonly plot: (x: number, y: number, ink: string) => void;
  readonly fill: (x: number, y: number, width: number, height: number, ink: string) => void;
}

function painter(width: number, height: number): Painter {
  const data = new Uint8ClampedArray(width * height * 4);
  const plot = (x: number, y: number, ink: string): void => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const rgb = [1, 3, 5].map((at) => Number.parseInt(ink.slice(at, at + 2), 16));
    data.set([rgb[0], rgb[1], rgb[2], 255], (y * width + x) * 4);
  };
  const fill = (x: number, y: number, w: number, h: number, ink: string): void => {
    for (let py = y; py < y + h; py += 1) for (let px = x; px < x + w; px += 1) plot(px, py, ink);
  };
  return { width, height, data, plot, fill };
}

/** A repeatable scatter, so the same chart is drawn every time. */
function noise(x: number, y: number, salt = 0): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + salt * 37.719) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * The whole chart, `width` by `height`, as a colour a pixel. Coordinates are
 * shares of the chart, so a board of any size draws the same chart: the sea
 * along the west and over the north-west, the moor's tor in the north-east,
 * pines in the south-west, and in the south-east a cove under cliffs with the
 * X on its sand.
 */
export function chartPicture(width: number, height: number): readonly (readonly string[])[] {
  const u = (x: number): number => x / width;
  const v = (y: number): number => y / height;
  const sea = (x: number, y: number): boolean => {
    const [a, b] = [u(x), v(y)];
    // North: the sea runs in over most of the west half, its coast wobbling.
    const coast = b < 0.5 ? 0.44 + 0.05 * Math.sin(b * 22) : 0.14 + 0.03 * Math.sin(b * 30);
    if (a < coast) return true;
    // The cove: a bay into the south-east from the bottom edge.
    const cx = (a - 0.7) / 0.17;
    const cy = (b - 1.02) / 0.32;
    return cx * cx + cy * cy < 1;
  };
  const rows: string[][] = [];
  for (let y = 0; y < height; y += 1) {
    const row: string[] = [];
    for (let x = 0; x < width; x += 1) {
      const wet = sea(x, y);
      const edge = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dy]) => sea(x + dx, y + dy) !== wet);
      if (edge && !wet) row.push(INK.coast);
      else if (wet) row.push((x + y * 3) % 11 === 0 && noise(x, y) > 0.4 ? INK.seaWave : INK.sea);
      else row.push(noise(x, y, 2) > 0.93 ? INK.landShade : INK.land);
    }
    rows.push(row);
  }
  const put = (x: number, y: number, ink: string): void => {
    const px = Math.round(x);
    const py = Math.round(y);
    if (py >= 0 && py < height && px >= 0 && px < width) rows[py][px] = ink;
  };
  const at = (a: number, b: number): [number, number] => [Math.round(a * width), Math.round(b * height)];
  // Cliffs round the cove: a band of brown hatching on the land beside it.
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) {
      const cx = (u(x) - 0.7) / 0.23;
      const cy = (v(y) - 1.02) / 0.42;
      const r = cx * cx + cy * cy;
      if (r < 1 && rows[y][x] === INK.land && (x + y) % 2 === 0) rows[y][x] = INK.cliff;
    }
  // The compass rose, out at sea.
  const [rx, ry] = at(0.12, 0.2);
  for (let d = -4; d <= 4; d += 1) {
    put(rx + d, ry, INK.ink);
    put(rx, ry + d, INK.ink);
  }
  for (let d = -2; d <= 2; d += 1) {
    put(rx + d, ry + d, INK.ink);
    put(rx + d, ry - d, INK.ink);
  }
  put(rx, ry - 5, INK.red);
  // A ship, sailing in.
  const [sx, sy] = at(0.3, 0.34);
  for (let d = -3; d <= 3; d += 1) put(sx + d, sy + 1, INK.ship);
  for (let d = -2; d <= 2; d += 1) put(sx + d, sy + 2, INK.ship);
  for (let d = 0; d < 4; d += 1) put(sx, sy - d, INK.ink);
  for (let d = 1; d < 4; d += 1) for (let w = 1; w <= 4 - d; w += 1) put(sx + w, sy - d, INK.sail);
  // The tor on the moor: a grey peak with a standing stone either side.
  const [tx, ty] = at(0.77, 0.2);
  for (let h = 0; h < 6; h += 1)
    for (let w = -h; w <= h; w += 1) put(tx + w, ty - 3 + h, w < 0 ? INK.torLight : INK.tor);
  put(tx - 9, ty + 1, INK.tor);
  put(tx - 9, ty + 2, INK.tor);
  put(tx + 9, ty + 1, INK.tor);
  put(tx + 9, ty + 2, INK.tor);
  // Pines in the south-west.
  for (const [a, b] of [
    [0.27, 0.68],
    [0.33, 0.74],
    [0.39, 0.66],
    [0.24, 0.8],
    [0.36, 0.84],
  ] as const) {
    const [px, py] = at(a, b);
    for (let h = 0; h < 4; h += 1) for (let w = -h; w <= h; w += 1) put(px + w, py - 3 + h, w < 0 ? INK.pineLight : INK.pine);
    put(px, py + 1, INK.coast);
  }
  // The course, in red dots: in off the sea, over the moor, down through the
  // pines and along the cliffs to the cove.
  const course = [
    [0.33, 0.31],
    [0.55, 0.22],
    [0.68, 0.24],
    [0.62, 0.42],
    [0.42, 0.56],
    [0.33, 0.7],
    [0.48, 0.82],
    [0.6, 0.74],
    [0.8, 0.76],
  ] as const;
  let carried = 0;
  for (let index = 1; index < course.length; index += 1) {
    const [x0, y0] = at(course[index - 1][0], course[index - 1][1]);
    const [x1, y1] = at(course[index][0], course[index][1]);
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let step = 0; step < steps; step += 1) {
      if ((carried + step) % 3 === 0) put(x0 + ((x1 - x0) * step) / steps, y0 + ((y1 - y0) * step) / steps, INK.red);
    }
    carried += steps;
  }
  // X marks the spot, on the sand at the foot of the cliff.
  const [xx, xy] = at(0.8, 0.76);
  for (let d = -2; d <= 2; d += 1) {
    put(xx + d, xy + d, INK.red);
    put(xx + d, xy - d, INK.red);
    put(xx + d + 1, xy + d, INK.redLight);
  }
  return rows;
}

/** The board as a picture of the save, `area` tiles big. */
export function chartWallPicture(hunt: TreasureHunt | undefined, area: { readonly width: number; readonly height: number }): PaintedPicture {
  const pinned = new Set((hunt ?? NO_TREASURE_HUNT).pinned);
  const whole = chartWhole(hunt ?? NO_TREASURE_HUNT);
  const board = painter(area.width * TILE, area.height * TILE);
  const { width, height, fill, plot } = board;
  // The frame: an outline, wood lit along its top and left, gilded trim once whole.
  fill(0, 0, width, height, INK.outline);
  fill(1, 1, width - 2, height - 2, INK.frame);
  fill(1, 1, width - 2, 1, INK.frameLight);
  fill(1, 1, 1, height - 2, INK.frameLight);
  fill(1, height - 2, width - 2, 1, INK.frameShade);
  fill(width - 2, 1, 1, height - 2, INK.frameShade);
  if (whole) {
    fill(2, 2, width - 4, 1, INK.gilt);
    fill(2, 2, 1, height - 4, INK.gilt);
    fill(2, height - 3, width - 4, 1, INK.giltShade);
    fill(width - 3, 2, 1, height - 4, INK.giltShade);
  }
  // The baize the pieces are pinned to.
  const inner = { x: FRAME, y: FRAME, width: width - 2 * FRAME, height: height - 2 * FRAME };
  fill(inner.x - 1, inner.y - 1, inner.width + 2, inner.height + 2, INK.outline);
  fill(inner.x, inner.y, inner.width, inner.height, INK.baize);
  for (let y = inner.y; y < inner.y + inner.height; y += 1)
    for (let x = inner.x; x < inner.x + inner.width; x += 1) if (noise(x, y, 5) > 0.9) plot(x, y, INK.baizeDeep);
  const chart = chartPicture(inner.width, inner.height);
  const slotWidth = Math.floor(inner.width / CHART_GRID.columns);
  const slotHeight = Math.floor(inner.height / CHART_GRID.rows);
  for (const piece of CHART_PIECES) {
    const sx = inner.x + piece.slot.column * slotWidth;
    const sy = inner.y + piece.slot.row * slotHeight;
    const right = piece.slot.column === CHART_GRID.columns - 1 ? inner.x + inner.width : sx + slotWidth;
    const bottom = piece.slot.row === CHART_GRID.rows - 1 ? inner.y + inner.height : sy + slotHeight;
    if (pinned.has(piece.id)) {
      // Its part of the chart, a pixel in from the slot on every side so the
      // seams between pieces show, with a ragged torn edge.
      for (let y = sy + 1; y < bottom - 1; y += 1)
        for (let x = sx + 1; x < right - 1; x += 1) {
          const onEdge = x === sx + 1 || y === sy + 1 || x === right - 2 || y === bottom - 2;
          if (onEdge && noise(x, y, 9) > 0.55) continue;
          plot(x, y, onEdge ? INK.landShade : chart[y - inner.y][x - inner.x]);
        }
      // A drawing pin at its top.
      const pinX = Math.floor((sx + right) / 2);
      plot(pinX, sy + 2, INK.pin);
      plot(pinX + 1, sy + 2, INK.pin);
      plot(pinX, sy + 3, INK.pin);
      plot(pinX + 1, sy + 3, INK.pin);
      plot(pinX, sy + 2, INK.pinLight);
    } else {
      // An empty slot: a dashed outline round a question mark.
      for (let x = sx + 2; x < right - 2; x += 1) {
        if ((x - sx) % 4 < 2) {
          plot(x, sy + 2, INK.dash);
          plot(x, bottom - 3, INK.dash);
        }
      }
      for (let y = sy + 2; y < bottom - 2; y += 1) {
        if ((y - sy) % 4 < 2) {
          plot(sx + 2, y, INK.dash);
          plot(right - 3, y, INK.dash);
        }
      }
      const qx = Math.floor((sx + right) / 2) - 1;
      const qy = Math.floor((sy + bottom) / 2) - 3;
      for (const [dx, dy] of [
        [0, 0],
        [1, 0],
        [2, 1],
        [1, 2],
        [1, 3],
        [1, 5],
      ] as const) {
        plot(qx + dx, qy + dy, INK.dash);
      }
    }
  }
  return { width, height, data: board.data };
}
