import type { GridPosition } from '../movement/gridMovement';
import type { PaintedPicture } from '../world/minimap';
import { builtInFileMap } from '../world/playerMaps';
import type { Material } from '../world/tileset/materials';
import { getWorldMap } from '../worldMap';
import { CHART_PIECES, chartWhole, NO_TREASURE_HUNT, TREASURE_SECRET_ID, type TreasureHunt } from './treasureMap';

/**
 * THE CHART ROOM's board, painted from the save onto the stretch of wall the
 * room keeps for it, as Oak's wall map and the badge case are: a wooden frame
 * round green baize, and on it the treasure map, as much of it as is pinned.
 *
 * **The chart is the real place.** It is SMUGGLERS' COVE drawn off the vale's
 * own map file (`chartGround`): its sea, sand, cliffs and woods are the tiles a
 * raid walks, its sheds and its jetty stand where they stand, the red dotted
 * course is the walk from the COVE STEPS landing down the cliff steps to the
 * hidden spot, found over the map's own collision, and the X is on the tile the
 * chest is dug up at. So a player who has stood in the cove knows it, a player
 * who has not will know it when they get there, and a cove redrawn in mapcraft
 * redraws the chart: nothing here can go stale (`chartWall.test.ts`).
 *
 * **It is one sheet torn in four.** The whole chart is drawn once and each
 * pinned piece shows its own part of it, cut along two tears that both of its
 * neighbours share (`tearAcross`, `tearDown`), so two pieces side by side meet
 * along one ragged line with nothing between them, and a missing piece is a
 * chalked outline of the same shape. With every piece up the frame's trim is
 * gilded.
 *
 * Every pixel is drawn here, for this game, in the GBA's colours (each a
 * multiple of eight) with light from the top left.
 */

const TILE = 16;
const VALE = 'greystone-vale';

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
  // The paper: open ground, and its foxing.
  land: '#f0d8a8',
  landShade: '#d8b880',
  // Dry sand, paler than the paper so the beach reads against the fields.
  sand: '#f8e8b8',
  sea: '#a8c8c8',
  seaWave: '#80a8b0',
  // The line the sea meets the land on.
  coast: '#685030',
  ink: '#403028',
  red: '#c83020',
  redLight: '#f05838',
  pine: '#386838',
  pineLight: '#58a050',
  cliff: '#987050',
  cliffLight: '#c8a070',
  // Planks: the jetty and the landing stage.
  plank: '#806040',
  roof: '#a04830',
  wall: '#f8f0d8',
  sail: '#f8f8f0',
  pin: '#d83828',
  pinLight: '#f8a088',
} as const;

/** The chart's colours, for anything else that draws it (`chartTable.ts`'s tracing). */
export const CHART_INK = INK;

/** The frame's width, in board pixels: the chart's own drawing area is the board inside it. */
const FRAME = 4;

/**
 * The stretch of Greystone Vale the chart is of, in the map's own tiles:
 * SMUGGLERS' COVE from the cliff top the COVE STEPS landing stands on down to
 * the foot of the south cliff, and from open sea in the west to THE CUT in the
 * east. On the board it is exactly two pixels to a tile (`chartWall.test.ts`):
 * the board's sheet is 134 by 70.
 */
export const CHART_GROUND = { x: 44, y: 272, width: 67, height: 35 } as const;

/** The buildings a chart draws as a little house: the cove's huts, stall and sheds. */
const HOUSE_KINDS: ReadonlySet<string> = new Set(['hut', 'shed', 'striped-stall', 'grey-house', 'roundhouse', 'cottage', 'house']);
/** And the boats, drawn as a hull. */
const BOAT_KINDS: ReadonlySet<string> = new Set(['ferry', 'rowing-boat', 'boat']);

/** What a tile of the cove is drawn as. */
type Ground = 'sea' | 'sand' | 'land' | 'wood' | 'cliff' | 'plank' | 'clutter';

const GROUND_OF: Readonly<Partial<Record<Material, Ground>>> = {
  water: 'sea',
  ford: 'sea',
  sand: 'sand',
  beach: 'sand',
  earth: 'sand',
  gravel: 'sand',
  grass: 'land',
  turf: 'land',
  'tall-grass': 'land',
  tree: 'wood',
  hedge: 'wood',
  cliff: 'cliff',
  fence: 'cliff',
  boards: 'plank',
  paving: 'plank',
  stone: 'plank',
  wall: 'clutter',
};

/** What the chart is drawn from: the cove as the map file has it. */
export interface ChartGround {
  /** One row a tile row of `CHART_GROUND`, one entry a tile. */
  readonly ground: readonly (readonly Ground[])[];
  /** The tile the chest is dug up at: the treasure secret's own hidden spot. */
  readonly spot: GridPosition;
  /** The landing the course is walked from: the one in the cove the fewest steps from the spot. */
  readonly landing: GridPosition;
  /** The walk from the landing to the spot, tile by tile, over the map's own collision. */
  readonly course: readonly GridPosition[];
  readonly houses: readonly GridPosition[];
  readonly boats: readonly GridPosition[];
}

let ground: ChartGround | undefined;

const inGround = (tile: GridPosition): boolean =>
  tile.x >= CHART_GROUND.x &&
  tile.y >= CHART_GROUND.y &&
  tile.x < CHART_GROUND.x + CHART_GROUND.width &&
  tile.y < CHART_GROUND.y + CHART_GROUND.height;

/**
 * The cove, read off the vale once: its ground, the treasure's spot, the
 * landing and the walk between them. Kept, because the map file does not
 * change while the game runs.
 */
export function chartGround(): ChartGround {
  if (ground) {
    return ground;
  }
  const map = getWorldMap(VALE);
  const file = builtInFileMap(VALE);
  const spot = file?.loot.find((piece) => piece.secret === TREASURE_SECRET_ID)?.position;
  if (!file || !spot) {
    throw new Error('The treasure map has no spot to lead to: the vale lays nothing for the treasure secret.');
  }
  const rows: Ground[][] = [];
  for (let dy = 0; dy < CHART_GROUND.height; dy += 1) {
    const row: Ground[] = [];
    for (let dx = 0; dx < CHART_GROUND.width; dx += 1) {
      const x = CHART_GROUND.x + dx;
      const y = CHART_GROUND.y + dy;
      const base = GROUND_OF[map.terrain[y]?.[x] ?? 'water'] ?? 'land';
      const solid = map.collision[y]?.[x] ?? true;
      // A prop stands on its ground: something solid on grass is a tree, and
      // on sand it is the cove's clutter - a crate, a barrel, a hut.
      row.push(!solid || base === 'sea' || base === 'cliff' || base === 'wood' ? base : base === 'land' ? 'wood' : 'clutter');
    }
    rows.push(row);
  }
  // Every tile of the cove the spot can be walked to from, and how far it is.
  const key = (tile: GridPosition): number => tile.y * map.width + tile.x;
  const from = new Map<number, GridPosition | null>([[key(spot), null]]);
  const queue: GridPosition[] = [spot];
  for (let at = 0; at < queue.length; at += 1) {
    const tile = queue[at];
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
      const next = { x: tile.x + dx, y: tile.y + dy };
      if (!inGround(next) || from.has(key(next)) || map.collision[next.y][next.x]) {
        continue;
      }
      from.set(key(next), tile);
      queue.push(next);
    }
  }
  // The landing in the cove the spot is nearest, by that walk: breadth first, so the first met.
  const landings = file.insertions.map((insertion) => insertion.position).filter(inGround);
  const landing = queue.find((tile) => landings.some((each) => each.x === tile.x && each.y === tile.y));
  if (!landing) {
    throw new Error('The treasure map has no landing to start from: no way in on the chart walks to its spot.');
  }
  const course: GridPosition[] = [];
  for (let tile: GridPosition | null | undefined = landing; tile; tile = from.get(key(tile))) {
    course.push(tile);
  }
  const standing = (kinds: ReadonlySet<string>): GridPosition[] =>
    file.file.buildings.filter((building) => kinds.has(building.kind) && inGround(building)).map(({ x, y }) => ({ x, y }));
  ground = { ground: rows, spot, landing, course, houses: standing(HOUSE_KINDS), boats: standing(BOAT_KINDS) };
  return ground;
}

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

/** The chart's lettering: five pixels tall and three wide (an M is five), capitals only. */
const LETTERS: Readonly<Record<string, readonly string[]>> = {
  S: ['###', '#..', '###', '..#', '###'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  G: ['###', '#..', '#.#', '#.#', '###'],
  L: ['#..', '#..', '#..', '#..', '###'],
  E: ['###', '#..', '##.', '#..', '###'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  C: ['###', '#..', '#..', '#..', '###'],
  O: ['###', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  "'": ['#', '#', '.', '.', '.'],
};

/** How many pixels a word takes, lettered a pixel apart. */
function letteredWidth(word: string): number {
  return [...word].reduce((width, letter) => width + (LETTERS[letter]?.[0].length ?? 2) + 1, -1);
}

/** The name lettered on the chart's bay, a word a line: what the place is called in the vale. */
export const CHART_NAME: readonly string[] = ["SMUGGLERS'", 'COVE'];

/** Where on the chart, in board pixels at two to the tile, a thing drawn at a tile is. */
export interface ChartPoint {
  readonly x: number;
  readonly y: number;
}

/** The middle of a tile, in the pixels of a chart `width` by `height`. */
export function chartPointOf(tile: GridPosition, width: number, height: number): ChartPoint {
  return {
    x: Math.floor(((tile.x - CHART_GROUND.x + 0.5) * width) / CHART_GROUND.width),
    y: Math.floor(((tile.y - CHART_GROUND.y + 0.5) * height) / CHART_GROUND.height),
  };
}

/**
 * The whole chart, `width` by `height`, as a colour a pixel: the cove's own
 * ground under a chart-maker's hand - a dark line where the sea meets the land,
 * hatched cliffs, a wood of dabbed trees, the jetty in plank brown - then a
 * little house on every hut and shed, a hull at the jetty's end, a compass rose
 * and a ship out in the open sea, the cove's name lettered on its bay, the red
 * dotted course down from the landing, and the X.
 */
export function chartPicture(width: number, height: number): readonly (readonly string[])[] {
  const cove = chartGround();
  const groundAt = (x: number, y: number): Ground => {
    const tx = Math.min(CHART_GROUND.width - 1, Math.max(0, Math.floor((x * CHART_GROUND.width) / width)));
    const ty = Math.min(CHART_GROUND.height - 1, Math.max(0, Math.floor((y * CHART_GROUND.height) / height)));
    return cove.ground[ty][tx];
  };
  const wet = (x: number, y: number): boolean => groundAt(x, y) === 'sea';
  const rows: string[][] = [];
  for (let y = 0; y < height; y += 1) {
    const row: string[] = [];
    for (let x = 0; x < width; x += 1) {
      const kind = groundAt(x, y);
      const shore = kind !== 'sea' && kind !== 'plank' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => wet(x + dx, y + dy));
      if (shore) {
        row.push(INK.coast);
        continue;
      }
      switch (kind) {
        case 'sea':
          row.push((x + y * 3) % 11 === 0 && noise(x, y) > 0.4 ? INK.seaWave : INK.sea);
          break;
        case 'sand':
          row.push(INK.sand);
          break;
        case 'land':
          row.push(noise(x, y, 2) > 0.9 ? INK.landShade : INK.land);
          break;
        case 'wood':
          row.push((x + y) % 2 === 0 ? INK.pine : INK.pineLight);
          break;
        case 'cliff':
          row.push((x + y) % 2 === 0 ? INK.cliff : INK.cliffLight);
          break;
        case 'plank':
          row.push(INK.plank);
          break;
        case 'clutter':
          row.push(INK.cliff);
          break;
      }
    }
    rows.push(row);
  }
  const put = (x: number, y: number, ink: string): void => {
    if (y >= 0 && y < height && x >= 0 && x < width) rows[y][x] = ink;
  };
  const at = (tile: GridPosition): ChartPoint => chartPointOf(tile, width, height);
  // A house on every hut and shed: a roof over a pale wall with a door, outlined.
  for (const tile of cove.houses) {
    const { x, y } = at(tile);
    for (let dx = -2; dx <= 2; dx += 1) {
      put(x + dx, y - 2, dx === -2 || dx === 2 ? INK.ink : INK.roof);
      put(x + dx, y - 1, INK.roof);
      put(x + dx, y, dx === -2 || dx === 2 ? INK.ink : INK.wall);
      put(x + dx, y + 1, dx === -2 || dx === 2 || dx === 0 ? INK.ink : INK.wall);
      put(x + dx, y + 2, INK.ink);
    }
    for (let dx = -1; dx <= 1; dx += 1) put(x + dx, y - 3, INK.ink);
  }
  // A hull where a boat is tied up.
  for (const tile of cove.boats) {
    const { x, y } = at(tile);
    for (let dx = -3; dx <= 3; dx += 1) put(x + dx, y, INK.ink);
    for (let dx = -2; dx <= 2; dx += 1) put(x + dx, y + 1, INK.plank);
    put(x, y - 1, INK.ink);
    put(x, y - 2, INK.ink);
    put(x + 1, y - 2, INK.sail);
  }
  // The open sea in the north-west: a compass rose, its north point red.
  const rose = { x: Math.round(width * 0.09), y: Math.round(height * 0.28) };
  for (let d = -4; d <= 4; d += 1) {
    put(rose.x + d, rose.y, INK.ink);
    put(rose.x, rose.y + d, INK.ink);
  }
  for (let d = -2; d <= 2; d += 1) {
    put(rose.x + d, rose.y + d, INK.ink);
    put(rose.x + d, rose.y - d, INK.ink);
  }
  put(rose.x, rose.y - 5, INK.red);
  put(rose.x, rose.y - 6, INK.red);
  // And a ship, sailing in for the bay.
  const ship = { x: Math.round(width * 0.3), y: Math.round(height * 0.34) };
  for (let d = -3; d <= 3; d += 1) put(ship.x + d, ship.y + 1, INK.plank);
  for (let d = -2; d <= 2; d += 1) put(ship.x + d, ship.y + 2, INK.plank);
  for (let d = 0; d < 5; d += 1) put(ship.x, ship.y - d, INK.ink);
  for (let d = 1; d < 5; d += 1) for (let w = 1; w <= 5 - d; w += 1) put(ship.x + w, ship.y - d, INK.sail);
  // The cove's name, lettered on the water of its bay under the jetty.
  CHART_NAME.forEach((word, line) => {
    let x = Math.round(width * 0.04);
    const y = Math.round(height * 0.8) + line * 7;
    for (const letter of word) {
      const glyph = LETTERS[letter];
      if (!glyph) {
        x += 3;
        continue;
      }
      glyph.forEach((cells, dy) => [...cells].forEach((cell, dx) => cell === '#' && put(x + dx, y + dy, INK.ink)));
      x += glyph[0].length + 1;
    }
  });
  // The course, in red dashes: two tiles drawn and two left, all the way down
  // from the landing, where a ring is drawn, to the spot.
  cove.course.forEach((tile, index) => {
    const next = cove.course[index + 1];
    if (index % 4 >= 2 || !next || index >= cove.course.length - 3) {
      return;
    }
    const from = at(tile);
    const to = at(next);
    put(from.x, from.y, INK.red);
    put(Math.round((from.x + to.x) / 2), Math.round((from.y + to.y) / 2), INK.red);
  });
  const start = at(cove.landing);
  for (const [dx, dy] of [[-1, -2], [0, -2], [1, -2], [-2, -1], [2, -1], [-2, 0], [2, 0], [-2, 1], [2, 1], [-1, 2], [0, 2], [1, 2]] as const) {
    put(start.x + dx, start.y + dy, INK.red);
  }
  // X marks the spot: on a patch of bare paper, so it stands off the cliff's hatching.
  const cross = at(cove.spot);
  for (let dy = -4; dy <= 4; dy += 1) {
    for (let dx = -4; dx <= 5; dx += 1) {
      if (Math.abs(Math.abs(dx - 0.5) - Math.abs(dy)) <= 1.5 && rows[cross.y + dy]?.[cross.x + dx] !== INK.ink) {
        put(cross.x + dx, cross.y + dy, INK.sand);
      }
    }
  }
  for (let d = -3; d <= 3; d += 1) {
    for (const [x, y] of [[cross.x + d, cross.y + d], [cross.x + d, cross.y - d]] as const) {
      put(x, y, INK.red);
      put(x + 1, y, d === 0 ? INK.red : INK.redLight);
    }
  }
  return rows;
}

/** Whether the name fits the bay it is lettered on: every pixel of it over water (`chartWall.test.ts`). */
export function chartNameWidth(): number {
  return Math.max(...CHART_NAME.map(letteredWidth));
}

// -- the tears ------------------------------------------------------------------

/** How far a tear wanders either side of the middle, in pixels. */
const TEAR = 2;

/**
 * The tear between the chart's left and right halves: the column it crosses a
 * row at. One line for both sides, so two pieces pinned side by side meet on it.
 */
export function tearDown(y: number, width: number): number {
  return Math.floor(width / 2) + Math.round((noise(0, Math.floor(y / 2), 21) - 0.5) * 2 * TEAR);
}

/** The tear between the top and bottom halves: the row it crosses a column at. */
export function tearAcross(x: number, height: number): number {
  return Math.floor(height / 2) + Math.round((noise(Math.floor(x / 2), 0, 22) - 0.5) * 2 * TEAR);
}

/** Which slot of the chart a pixel of it is torn into. */
export function pieceSlotAt(x: number, y: number, width: number, height: number): { readonly column: number; readonly row: number } {
  return { column: x < tearDown(y, width) ? 0 : 1, row: y < tearAcross(x, height) ? 0 : 1 };
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
  // The sheet lies a pixel in from the baize's edge all round.
  const sheet = { x: inner.x + 1, y: inner.y + 1, width: inner.width - 2, height: inner.height - 2 };
  const chart = chartPicture(sheet.width, sheet.height);
  const pieceIn = (column: number, row: number) => CHART_PIECES.find((piece) => piece.slot.column === column && piece.slot.row === row);
  const up = (cx: number, cy: number): boolean => {
    if (cx < 0 || cy < 0 || cx >= sheet.width || cy >= sheet.height) return false;
    const slot = pieceSlotAt(cx, cy, sheet.width, sheet.height);
    const piece = pieceIn(slot.column, slot.row);
    return piece !== undefined && pinned.has(piece.id);
  };
  const sameSlot = (ax: number, ay: number, bx: number, by: number): boolean => {
    const a = pieceSlotAt(ax, ay, sheet.width, sheet.height);
    const b = pieceSlotAt(bx, by, sheet.width, sheet.height);
    return a.column === b.column && a.row === b.row;
  };
  for (let cy = 0; cy < sheet.height; cy += 1) {
    for (let cx = 0; cx < sheet.width; cx += 1) {
      const x = sheet.x + cx;
      const y = sheet.y + cy;
      if (up(cx, cy)) {
        // Paper. Along a tear: a crease where the next piece is up beside it,
        // so the two read as one sheet, and a worn edge where it is not.
        const right = cx + 1 < sheet.width && !sameSlot(cx, cy, cx + 1, cy);
        const below = cy + 1 < sheet.height && !sameSlot(cx, cy, cx, cy + 1);
        const torn = (right && !up(cx + 1, cy)) || (below && !up(cx, cy + 1)) || (cx > 0 && !sameSlot(cx, cy, cx - 1, cy) && !up(cx - 1, cy)) || (cy > 0 && !sameSlot(cx, cy, cx, cy - 1) && !up(cx, cy - 1));
        const sheetEdge = cx === 0 || cy === 0 || cx === sheet.width - 1 || cy === sheet.height - 1;
        if (sheetEdge && noise(x, y, 9) > 0.7) continue;
        const colour = chart[cy][cx];
        const marked = colour === INK.red || colour === INK.redLight || colour === INK.ink;
        const water = colour === INK.sea || colour === INK.seaWave;
        if (marked) {
          plot(x, y, colour);
        } else if (torn || sheetEdge) {
          plot(x, y, INK.landShade);
        } else if (right || below) {
          plot(x, y, water ? INK.seaWave : INK.landShade);
        } else {
          plot(x, y, colour);
        }
      } else if (up(cx - 1, cy - 1) || up(cx - 1, cy) || up(cx, cy - 1)) {
        // The paper's shadow on the baize, down and to the right of it.
        plot(x, y, INK.baizeDeep);
      }
    }
  }
  // What is not pinned: its own torn shape chalked out in dashes round a question mark.
  for (const piece of CHART_PIECES) {
    if (pinned.has(piece.id)) continue;
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    for (let cy = 2; cy < sheet.height - 2; cy += 1) {
      for (let cx = 2; cx < sheet.width - 2; cx += 1) {
        const slot = pieceSlotAt(cx, cy, sheet.width, sheet.height);
        if (slot.column !== piece.slot.column || slot.row !== piece.slot.row) continue;
        sumX += cx;
        sumY += cy;
        count += 1;
        const inSlot = (dx: number, dy: number): boolean => {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 2 || ny < 2 || nx >= sheet.width - 2 || ny >= sheet.height - 2) return false;
          const next = pieceSlotAt(nx, ny, sheet.width, sheet.height);
          return next.column === slot.column && next.row === slot.row;
        };
        // Its outline, two pixels in from the tear, dashed.
        const rim = !inSlot(2, 0) || !inSlot(-2, 0) || !inSlot(0, 2) || !inSlot(0, -2);
        const outer = !inSlot(1, 0) || !inSlot(-1, 0) || !inSlot(0, 1) || !inSlot(0, -1);
        if (rim && !outer && (cx + cy) % 4 < 2 && !up(cx, cy)) plot(sheet.x + cx, sheet.y + cy, INK.dash);
      }
    }
    const qx = sheet.x + Math.round(sumX / count) - 1;
    const qy = sheet.y + Math.round(sumY / count) - 3;
    for (const [dx, dy] of [[0, 0], [1, 0], [2, 1], [1, 2], [1, 3], [1, 5]] as const) {
      plot(qx + dx, qy + dy, INK.dash);
    }
  }
  // A drawing pin in the outer top corner of every piece that is up.
  for (const piece of CHART_PIECES) {
    if (!pinned.has(piece.id)) continue;
    const pinX = piece.slot.column === 0 ? sheet.x + 3 : sheet.x + sheet.width - 5;
    const pinY = piece.slot.row === 0 ? sheet.y + 2 : sheet.y + sheet.height - 4;
    fill(pinX, pinY, 2, 2, INK.pin);
    plot(pinX, pinY, INK.pinLight);
    plot(pinX + 1, pinY + 2, INK.coast);
  }
  return { width, height, data: board.data };
}
