import type { Direction, GridPosition } from '../movement/gridMovement';
import { HARBOUR_PATH_MAX, isPlayerId, type HarbourMove } from '../harbour/harbourProtocol';

/**
 * What two players in a raid room tell each other, and the one rule for
 * reading it, which is the harbour's (`harbour/harbourProtocol.ts`): **nothing
 * heard is believed beyond drawing it**.
 *
 * A message comes from the other player's browser, so it is read through
 * `readRaidMove` and `readRaidPresence`, which take only the shapes the game
 * sends - a place, a short path of whole tiles, a facing - and drop anything
 * else whole. A message never carries a name: the name over a figure is the one
 * on that player's door (`harbour_names`).
 *
 * Where a player is, is the room's map while they raid it and `lab` while they
 * are getting ready at base: the two never share a screen, but the other
 * player is told which, so a friend still packing is not a friend who left.
 */

/** Where a player in a room is: getting ready at base, or on a map, by its id. */
export type RaidPlace = 'lab' | `map:${string}`;

/** The place a raid on this map is. */
export function mapPlace(mapId: string): RaidPlace {
  return `map:${mapId}`;
}

/** A map id as the game writes one, and as the database holds a room's. */
const MAP_ID = /^[a-z0-9-]{1,48}$/;

export function isRaidPlace(value: unknown): value is RaidPlace {
  return value === 'lab' || (typeof value === 'string' && value.startsWith('map:') && MAP_ID.test(value.slice(4)));
}

/**
 * The largest tile a figure may stand on. A shipped map's rooms are laid east
 * of its outdoors (`world/buildingInsides.ts`), so the grid is wider than any
 * map is; this is the format's largest map with every inside beside it, and
 * room to spare.
 */
const MAX_TILE = 2047;

const FACINGS: readonly Direction[] = ['up', 'down', 'left', 'right'];

function isTileNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_TILE;
}

export type RaidMove = HarbourMove<RaidPlace>;

/** What goes on the wire for a move: short keys, whole numbers. */
export function encodeRaidMove(move: RaidMove): Record<string, unknown> {
  return {
    u: move.from,
    p: move.place,
    s: move.path.slice(-HARBOUR_PATH_MAX).map((tile) => [tile.x, tile.y]),
    f: move.facing,
  };
}

/** A move heard from the other browser, or null if it is anything but one the game sends. */
export function readRaidMove(payload: unknown): RaidMove | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  const { u, p, s, f } = payload as Record<string, unknown>;
  if (!isPlayerId(u) || !isRaidPlace(p) || typeof f !== 'string' || !FACINGS.includes(f as Direction)) {
    return null;
  }
  if (!Array.isArray(s) || s.length === 0 || s.length > HARBOUR_PATH_MAX) {
    return null;
  }
  const path: GridPosition[] = [];
  for (const step of s) {
    if (!Array.isArray(step) || step.length !== 2 || !isTileNumber(step[0]) || !isTileNumber(step[1])) {
      return null;
    }
    path.push({ x: step[0], y: step[1] });
  }
  return { from: u, place: p, path, facing: f as Direction };
}

/** What a player says about themselves on joining: only where they are. */
export function encodeRaidPresence(place: RaidPlace): Record<string, unknown> {
  return { p: place };
}

/** The place a presence says, or null if it says anything else. */
export function readRaidPresence(payload: unknown): RaidPlace | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  const { p } = payload as Record<string, unknown>;
  return isRaidPlace(p) ? p : null;
}

/** Who is on the channel and where each says they are, read off Realtime's presence state. */
export function raidMembersOf(state: Record<string, readonly unknown[]>): ReadonlyMap<string, RaidPlace> {
  const members = new Map<string, RaidPlace>();
  for (const [key, metas] of Object.entries(state)) {
    if (!isPlayerId(key)) {
      continue;
    }
    for (const meta of metas) {
      const place = readRaidPresence(meta);
      if (place) {
        members.set(key, place);
        break;
      }
    }
  }
  return members;
}
