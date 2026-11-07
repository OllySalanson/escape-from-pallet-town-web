import { BASE_DOORS } from '../base/doors';
import { BASE_SPAWN, getBaseMap } from '../base/baseMap';
import { HARBOUR_PLACES, type HarbourPlace } from '../base/harbourPlaces';
import { BASE_ROOMS, type RoomId } from '../base/rooms';
import { DOJO_COUNTER_TILES } from '../arena/dojoCounter';
import { LEADER_TILES } from '../base/gymPractice';
import type { Direction, GridPosition } from '../movement/gridMovement';
import type { PlaytestHour } from './playtestClock';
import { PLAYTEST_GAMES } from './playtestKit';

/**
 * The PLAYTEST BOARD: a sign in the yard, a step from where an explorer run
 * lands, that gets a playtester to whatever they came to try without walking
 * the harbour to it or waiting for the evening.
 *
 * It stands only in the explorer run (`isPlaytestRun`), on a tile of lawn off
 * every lane and door, made solid only while it stands there - the ordinary
 * harbour's map, and every walk `baseMap.test.ts` measures, never has it.
 *
 * What it does, one row each (`playtestBoardView.ts` draws it):
 *
 * - **GO TO** any room behind a door, or any named part of the harbour
 *   (`harbourPlaces.ts`), straight there;
 * - **THE HOUR**: day, dusk or night by hand, or back to the player's own clock
 *   (`playtestClock.ts`), which the harbour's light, its people and a night
 *   raid all read;
 * - **NEW DAY**: every cabinet pays again and the prize window's limits are
 *   back (`withNewDay` in `playtestKit.ts`);
 * - **PLAY** any harbour game at once (`PLAYTEST_GAMES`).
 *
 * Phaser-free: what a row is and where it sends the player are worked out
 * here, and `BaseScene` only does it.
 */

/** Where the board stands: the lawn east of the landing, read from the path. */
export const PLAYTEST_BOARD_TILE: GridPosition = { x: 18, y: 14 };

/** Its name, over it and on its screen. */
export const PLAYTEST_BOARD_NAME = 'PLAYTEST BOARD';

export type PlaytestBoardAction =
  | { readonly kind: 'room'; readonly room: RoomId }
  | { readonly kind: 'stand'; readonly room: RoomId; readonly at: GridPosition; readonly facing: Direction }
  | { readonly kind: 'place'; readonly place: string }
  | { readonly kind: 'hour'; readonly hour: PlaytestHour | null }
  | { readonly kind: 'new-day' }
  | { readonly kind: 'game'; readonly game: string };

/** A row of the board: what it says, and what pressing it does. */
export interface PlaytestBoardRow {
  readonly id: string;
  readonly label: string;
  readonly note: string;
  readonly action: PlaytestBoardAction;
}

export interface PlaytestBoardSection {
  readonly heading: string;
  readonly rows: readonly PlaytestBoardRow[];
}

const HOUR_ROWS: readonly { readonly hour: PlaytestHour | null; readonly label: string; readonly note: string }[] = [
  { hour: 'day', label: 'DAY', note: 'The harbour in the sun' },
  { hour: 'dusk', label: 'DUSK', note: 'The windows start to light' },
  { hour: 'night', label: 'NIGHT', note: 'Lit windows, night people, night raids' },
  { hour: null, label: 'MY CLOCK', note: 'Back to the hour it really is' },
];

/**
 * The fights a playtest wants straight away, as rows of PLAY: standing at the
 * dojo's counter facing the receptionist, and before the first leader on the
 * hall's far floor (every leader is met in the explorer run). One SPACE then
 * opens the counter or asks the leader.
 */
const DOJO_COUNTER_FRONT: GridPosition = {
  x: DOJO_COUNTER_TILES[0].x + 1,
  y: Math.max(...DOJO_COUNTER_TILES.map((tile) => tile.y)) + 1,
};
const FIRST_LEADER_FRONT: GridPosition = { x: LEADER_TILES[0].x, y: LEADER_TILES[0].y + 1 };
export const STAND_ROWS: readonly PlaytestBoardRow[] = [
  {
    id: 'stand-dojo-counter',
    label: 'THE BATTLE ARENA COUNTER',
    note: 'At the counter: SPACE for a bout',
    action: { kind: 'stand', room: 'battle-arena', at: DOJO_COUNTER_FRONT, facing: 'up' },
  },
  {
    id: 'stand-practice',
    label: 'PRACTISE WITH A LEADER',
    note: 'In the hall: SPACE to spar',
    action: { kind: 'stand', room: 'raid-arena', at: FIRST_LEADER_FRONT, facing: 'up' },
  },
];

/** Every row of the board, in its sections; `hour` is the one set now, if any. */
export function playtestBoardSections(hour: PlaytestHour | null): readonly PlaytestBoardSection[] {
  return [
    {
      heading: 'Play',
      rows: [
        ...PLAYTEST_GAMES.map((game): PlaytestBoardRow => ({
          id: `game-${game.id}`,
          label: game.name,
          note: 'Open it now',
          action: { kind: 'game', game: game.id },
        })),
        ...STAND_ROWS,
      ],
    },
    {
      heading: 'The hour',
      rows: HOUR_ROWS.map((row) => ({
        id: `hour-${row.hour ?? 'clock'}`,
        label: row.hour === hour ? `${row.label} (NOW)` : row.label,
        note: row.note,
        action: { kind: 'hour', hour: row.hour },
      })),
    },
    {
      heading: 'The day',
      rows: [
        {
          id: 'new-day',
          label: 'NEW DAY',
          note: "Every cabinet pays again; the dojo's regulars keep the real date",
          action: { kind: 'new-day' },
        },
      ],
    },
    {
      heading: 'Go to a room',
      rows: BASE_ROOMS.map((room) => ({
        id: `room-${room.id}`,
        label: room.name.toUpperCase(),
        note: 'Straight in',
        action: { kind: 'room', room: room.id },
      })),
    },
    {
      heading: 'Go to the harbour',
      rows: HARBOUR_PLACES.map((place) => ({
        id: `place-${place.id}`,
        label: place.name,
        note: 'Straight there',
        action: { kind: 'place', place: place.id },
      })),
    },
  ];
}

/** Every row, in order, for finding one by id. */
export function playtestBoardRows(hour: PlaytestHour | null): readonly PlaytestBoardRow[] {
  return playtestBoardSections(hour).flatMap((section) => section.rows);
}

/**
 * Where in a part of the harbour the board puts the player down: the open
 * tile nearest the middle of its first stretch, never a doorway (which would
 * be walked straight through) or the board's own tile. Asked of the yard as
 * this save has built it, so a fixture never lands on the player.
 */
export function placeLanding(place: HarbourPlace, builtUpgradeIds: readonly string[] = []): GridPosition {
  const map = getBaseMap(builtUpgradeIds);
  const doorways = BASE_DOORS.flatMap((door) => door.tiles);
  const open = (tile: GridPosition): boolean =>
    map.collision[tile.y]?.[tile.x] === false &&
    !doorways.some((door) => door.x === tile.x && door.y === tile.y) &&
    !(tile.x === PLAYTEST_BOARD_TILE.x && tile.y === PLAYTEST_BOARD_TILE.y);
  let best: GridPosition | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const area of place.areas) {
    const middle = { x: area.x + (area.width - 1) / 2, y: area.y + (area.height - 1) / 2 };
    for (let y = area.y; y < area.y + area.height; y += 1) {
      for (let x = area.x; x < area.x + area.width; x += 1) {
        const distance = Math.abs(x - middle.x) + Math.abs(y - middle.y);
        if (open({ x, y }) && distance < bestDistance) {
          best = { x, y };
          bestDistance = distance;
        }
      }
    }
    if (best) {
      return best;
    }
  }
  return { ...BASE_SPAWN };
}
