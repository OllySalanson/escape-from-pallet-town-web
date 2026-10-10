import type { RestoredGame } from '../save/SaveManager';
import type { Rect } from '../ui/labelPlacement';
import type { PaintedPicture } from '../world/minimap';
import { WORLD_MAP_NAMES, TILE_SIZE, type BuiltInMapId } from '../worldMap';

/**
 * PENNANTS: a string of them along the wall of the player's room, one for every
 * place they have come home from.
 *
 * A pennant is what you bring back from somewhere to say you were there, and
 * the thing this game asks of a place is not that you went but that you came
 * home: `raidProgress.raidRecord` counts the raids that extracted from each
 * map, and the first one hangs that map's pennant on the wall. Each is in the
 * colours of its place with its mark on it - the river's wave, the route's
 * signpost, the forest's pine, the town's mill, the city's gate - and a place
 * not yet come home from is a bare pin on the string, so the wall says how many
 * there are to collect. Nothing is stored; the record is the save's own.
 */

export interface Pennant {
  readonly mapId: BuiltInMapId;
  /** The field, the band across its top, and the mark on it. */
  readonly ink: Readonly<Record<'field' | 'band' | 'mark' | 'shade', string>>;
  /** Five pixels square: `x` is the mark, `.` the field. */
  readonly mark: readonly string[];
}

/** In the order the maps open to a player: the Floodplain first. */
export const PENNANTS: readonly Pennant[] = [
  {
    mapId: 'floodplain-relay',
    ink: { field: '#3878d0', band: '#f8f8f8', mark: '#b8e0ff', shade: '#20488c' },
    mark: ['.....', '.x..x', 'x.xx.', '.....', '.....'],
  },
  {
    mapId: 'route-1',
    ink: { field: '#48a848', band: '#f8f8f8', mark: '#f8e8a0', shade: '#286c28' },
    mark: ['..x..', '.xxx.', '..x..', '..x..', '..x..'],
  },
  {
    mapId: 'viridian-forest',
    ink: { field: '#286840', band: '#f8f8f8', mark: '#88d070', shade: '#163c24' },
    mark: ['..x..', '.xxx.', '.xxx.', 'xxxxx', '..x..'],
  },
  {
    mapId: 'pallet-town',
    ink: { field: '#d04838', band: '#f8f8f8', mark: '#f8d8b0', shade: '#882418' },
    mark: ['x...x', '.x.x.', '..x..', '.x.x.', 'x...x'],
  },
  {
    mapId: 'viridian-city',
    ink: { field: '#8858b8', band: '#f8f8f8', mark: '#f8e070', shade: '#583080' },
    mark: ['x.x.x', 'xxxxx', 'x...x', 'x...x', 'x...x'],
  },
];

/** How many raids came home from a map. */
const homecomings = (game: RestoredGame, mapId: BuiltInMapId): number =>
  game.raidProgress.raidRecord?.[mapId]?.extracted ?? 0;

/** The pennants earned, in the string's order. */
export function earnedPennants(game: RestoredGame): readonly Pennant[] {
  return PENNANTS.filter((pennant) => homecomings(game, pennant.mapId) > 0);
}

/** The caption's second line. */
export function pennantsNote(game: RestoredGame): string {
  const earned = earnedPennants(game).length;
  return earned === 0 ? 'Bare pins, waiting' : `${earned} of ${PENNANTS.length} places come home from`;
}

/** What the string says when it is faced: one line for every pennant on it. */
export function pennantLines(game: RestoredGame): readonly string[] {
  const earned = earnedPennants(game);
  if (earned.length === 0) {
    return [
      `PENNANTS. ${PENNANTS.length} bare pins on a string along the wall.`,
      'Come home from a place - alive, with the pack on your back - and its pennant goes up.',
    ];
  }
  return [
    `PENNANTS. ${earned.length} of ${PENNANTS.length} places you have come home from.`,
    ...earned.map((pennant) => {
      const times = homecomings(game, pennant.mapId);
      return `${WORLD_MAP_NAMES[pennant.mapId].toUpperCase()}: home ${times === 1 ? 'once' : times === 2 ? 'twice' : `${times} times`}.`;
    }),
  ];
}

const STRING = '#4a3418';
const PIN = '#c0c8d0';
const OUTLINE = '#2b2228';
/** A pennant's top edge, and how far it hangs below the string. */
const PENNANT_WIDTH = 12;
const PENNANT_DROP = 16;
/** Where the string is tied at each end, below the band along the top of the wall. */
const STRING_Y = 5;
/** How far it sags in the middle. */
const STRING_SAG = 2;

/**
 * The string of pennants, painted from the save, one per tile of wall: the
 * string across the top, a pin at each pennant's corners, and the pennant
 * itself hanging to a point - or, where none has been earned, a pin and
 * nothing. Transparent everywhere else, so the wall shows through.
 */
export function pennantsPoster(game: RestoredGame, area: Rect): PaintedPicture {
  const width = area.width * TILE_SIZE;
  const height = area.height * TILE_SIZE;
  const data = new Uint8ClampedArray(width * height * 4);
  const plot = (x: number, y: number, ink: string): void => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const rgb = [1, 3, 5].map((at) => Number.parseInt(ink.slice(at, at + 2), 16));
    data.set([rgb[0], rgb[1], rgb[2], 255], (y * width + x) * 4);
  };
  // The string, tied at both ends and sagging between them.
  const stringAt = (x: number): number => {
    const t = x / (width - 1);
    return STRING_Y + Math.round(STRING_SAG * 4 * t * (1 - t));
  };
  for (let x = 1; x < width - 1; x += 1) plot(x, stringAt(x), STRING);
  const earned = new Set(earnedPennants(game).map((pennant) => pennant.mapId));
  PENNANTS.slice(0, area.width).forEach((pennant, slot) => {
    const left = slot * TILE_SIZE + Math.floor((TILE_SIZE - PENNANT_WIDTH) / 2);
    const top = stringAt(left + PENNANT_WIDTH / 2) + 1;
    if (!earned.has(pennant.mapId)) {
      plot(left + PENNANT_WIDTH / 2, top - 1, PIN);
      return;
    }
    for (let row = 0; row < PENNANT_DROP; row += 1) {
      // Narrowing from the full width to a point.
      const half = (PENNANT_WIDTH / 2) * (1 - row / PENNANT_DROP);
      const from = Math.round(left + PENNANT_WIDTH / 2 - half);
      const to = Math.round(left + PENNANT_WIDTH / 2 + half) - 1;
      for (let x = from; x <= to; x += 1) {
        const edge = x === from || x === to || row === 0;
        const ink = edge
          ? OUTLINE
          : row <= 2
            ? pennant.ink.band
            : x === to - 1
              ? pennant.ink.shade
              : pennant.ink.field;
        plot(x, top + row, ink);
      }
    }
    pennant.mark.forEach((line, y) =>
      [...line].forEach((mark, x) => {
        if (mark === 'x') plot(left + 3 + x, top + 4 + y, pennant.ink.mark);
      }),
    );
    plot(left, top - 1, PIN);
    plot(left + PENNANT_WIDTH - 1, top - 1, PIN);
  });
  return { width, height, data };
}
