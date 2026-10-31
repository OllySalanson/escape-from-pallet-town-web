import type { GridPosition } from '../movement/gridMovement';
import {
  ARENA_CENTRE,
  ARENA_TILE,
  PODIUM_PARALLAX,
  PIT_RIM,
  arenaCollision,
  isArenaFence,
  parallaxShift,
  pitPointOf,
  podiumHole,
  type PitFrame,
} from './arenaHall';

/**
 * Walking round THE RAID ARENA's rim to choose a raid: which way in a player is
 * standing over, wherever they stand at the fence. Nothing here knows Phaser.
 *
 * It is a matter of bearings rather than of what is nearest. A vale's ways in
 * lie all over it, some of them in the middle, and "the nearest to where you
 * are looking" would leave those in the middle with no stretch of fence of
 * their own: nobody could ever stand over them. So the landings are read round
 * the map from its middle, as a clock is, and the rim shared out among them in
 * that order, an equal stretch each and turned to lie as near as it can over
 * where each one really is. Every way in is somebody's stretch of fence, walking
 * round the rim passes them in the order they lie, and with one way in the whole
 * rim is over it.
 */

/** A way in, as the rim knows it: a tile of the map at the bottom of the pit. */
export interface RimLanding {
  readonly id: string;
  readonly tile: GridPosition;
}

const SOLID = arenaCollision();

const FULL_TURN = Math.PI * 2;

/** An angle brought into a half turn either way of nothing. */
const wrapped = (angle: number): number => {
  const turned = ((angle + Math.PI) % FULL_TURN + FULL_TURN) % FULL_TURN;
  return turned - Math.PI;
};

/** Every tile of platform with the fence right beside it: where a raid can be chosen from. */
export const ARENA_RIM: readonly GridPosition[] = (() => {
  const rim: GridPosition[] = [];
  SOLID.forEach((row, y) =>
    row.forEach((blocked, x) => {
      if (!blocked && fenceBeside({ x, y }) !== null) {
        rim.push({ x, y });
      }
    }),
  );
  return rim;
})();

/** The fence right beside a tile, pit-side first, or null when there is none. */
export function fenceBeside(tile: GridPosition): GridPosition | null {
  const dx = ARENA_CENTRE.x - (tile.x + 0.5) * ARENA_TILE;
  const dy = ARENA_CENTRE.y - (tile.y + 0.5) * ARENA_TILE;
  const across = { x: tile.x + Math.sign(dx), y: tile.y };
  const along = { x: tile.x, y: tile.y + Math.sign(dy) };
  const [first, second] = Math.abs(dx) > Math.abs(dy) ? [across, along] : [along, across];
  return isArenaFence(first) ? first : isArenaFence(second) ? second : null;
}

export function isAtRim(tile: GridPosition): boolean {
  return !SOLID[tile.y]?.[tile.x] && fenceBeside(tile) !== null;
}

/** Where a tile stands round the hall, as `ovalPoint` turns. */
function bearingOfTile(tile: GridPosition): number {
  return Math.atan2(
    ((tile.y + 0.5) * ARENA_TILE - PIT_RIM.y) / PIT_RIM.ry,
    ((tile.x + 0.5) * ARENA_TILE - PIT_RIM.x) / PIT_RIM.rx,
  );
}

/** Where a tile of the map stands round the map's middle, the same way. */
function bearingOfLanding(tile: GridPosition, frame: PitFrame): number {
  return Math.atan2((tile.y + 0.5 - frame.height / 2) / frame.height, (tile.x + 0.5 - frame.width / 2) / frame.width);
}

/** The ways in on one map, in the order they lie round it, with the rim shared out among them. */
export interface RimShare {
  readonly landings: readonly RimLanding[];
  /** The bearing the first landing's stretch of fence is centred on. */
  readonly turn: number;
}

export function shareTheRim(landings: readonly RimLanding[], frame: PitFrame): RimShare {
  const round = [...landings].sort(
    (a, b) => bearingOfLanding(a.tile, frame) - bearingOfLanding(b.tile, frame) || a.id.localeCompare(b.id),
  );
  const stretch = FULL_TURN / Math.max(round.length, 1);
  // The turn that sets each stretch nearest over its own landing: the mean of
  // how far each landing lies from where an unturned share would put it, taken
  // round the circle so that east does not average with east to give west.
  let sin = 0;
  let cos = 0;
  round.forEach((landing, index) => {
    const off = bearingOfLanding(landing.tile, frame) - index * stretch;
    sin += Math.sin(off);
    cos += Math.cos(off);
  });
  return { landings: round, turn: Math.atan2(sin, cos) };
}

/** The way in somebody on this tile of the rim is standing over. */
export function landingBelow(tile: GridPosition, share: RimShare): RimLanding | null {
  const count = share.landings.length;
  if (count === 0) {
    return null;
  }
  const stretch = FULL_TURN / count;
  const index = Math.round(wrapped(bearingOfTile(tile) - share.turn) / stretch);
  return share.landings[((index % count) + count) % count];
}

/** The middle of the stretch of rim over a landing: where a mouse walks a player to it from far off. */
export function rimTileOver(landingId: string, share: RimShare, from: GridPosition): GridPosition | null {
  const over = ARENA_RIM.filter((tile) => landingBelow(tile, share)?.id === landingId);
  if (over.length === 0) {
    return null;
  }
  const away = (tile: GridPosition): number => Math.abs(tile.x - from.x) + Math.abs(tile.y - from.y);
  return over.reduce((best, tile) => (away(tile) < away(best) ? tile : best));
}

/** A tile's middle, in hall pixels: the point the pit's layers are slid for. */
export const tileMiddle = (tile: GridPosition): { readonly x: number; readonly y: number } => ({
  x: (tile.x + 0.5) * ARENA_TILE,
  y: (tile.y + 0.5) * ARENA_TILE,
});

/**
 * Whether a tile of the map shows through the hole for somebody standing here:
 * inside the pit's opening, which slides with its own layer.
 */
export function showsThroughTheHole(
  mapTile: GridPosition,
  player: { readonly x: number; readonly y: number },
  frame: PitFrame,
): boolean {
  const point = pitPointOf(mapTile, player, frame);
  const hole = podiumHole();
  const shift = parallaxShift(PODIUM_PARALLAX, player);
  const dx = (point.x - (hole.x + shift.x)) / hole.rx;
  const dy = (point.y - (hole.y + shift.y)) / hole.ry;
  return dx * dx + dy * dy < 1;
}
