import { DIRECTION_DELTAS, type Direction, type GridPosition } from '../movement/gridMovement';
import type { WorldMapId } from '../worldMap';

/**
 * A ledge you may drop off and never climb.
 *
 * Route 1's ledges in the games this is dressed as are the benchmark for a map
 * that gives you a short way back: you walk the long way up and hop the short
 * way down, and the hop is one way for ever. Here it is a mechanic rather than
 * a piece of layout, because the hunter's pursuit is a breadth-first search
 * over the map's collision (`hunter.ts`) - so a ledge tile, which is solid and
 * stays solid, is a wall to the hunter whatever the player does with it. It is
 * the one route on any map that only the player has.
 *
 * Nothing about the map changes to make one. The brow is ground the player
 * already stands on, the ledge itself is already the sheet's bank art and
 * already solid, and the landing is already walkable: `mapStructure.test.ts`
 * and `hunterFlee.test.ts` therefore see exactly the map they saw before, and
 * the ledge can never be the only way anywhere. `ledges.test.ts` holds the rest
 * - that the way round still exists and is genuinely longer, that nothing a
 * raid is for is landed on, and that no ledge can be gone up.
 */

export interface MapLedge {
  readonly id: string;
  readonly mapId: WorldMapId;
  /** What the caption calls it. */
  readonly label: string;
  /** The one way over it. There is no way back. */
  readonly drop: Direction;
  /** The tiles the player may go over it from. */
  readonly brow: readonly GridPosition[];
  /** How many solid tiles the hop clears. The landing is the tile after them. */
  readonly depth: number;
}

/**
 * Longer than a walked tile, because it is a jump and has to read as one, and
 * still far quicker than the tiles it covers: the hop is three tiles in the
 * time of under two steps.
 */
export const LEDGE_HOP_DURATION_MS = 260;

/** How far the figure rises over the middle of the hop, in pixels. */
export const LEDGE_HOP_RISE = 9;

export const WORLD_LEDGES: readonly MapLedge[] = [
  {
    /**
     * Viridian Forest's EAST RISE. The rise is already drawn as a shelf with
     * the sheet's ledge under its brow and a rail along the top, and the only
     * way off it here is the trail that climbs its east end - so the walk down
     * is seven steps from the west end of the brow and five from the east, most
     * of them tall grass, and the drop is one.
     *
     * It earns its place here rather than on Route 1's Overlook, which has the
     * same bank: the Overlook's way down is already Warden Wren's second door
     * (`gates.ts`), and a hop beside it would be that door for free. And it
     * earns its place on this map above every other, because Viridian is the
     * one map with no fast lane - distance is priced in fights, the wood is
     * two-connected throughout so there is always a way round, and being caught
     * on the rise by the hunter is exactly the moment a route only the player
     * has is worth having.
     */
    id: 'viridian-east-rise-brow',
    mapId: 'viridian-forest',
    label: 'EAST RISE BROW',
    drop: 'down',
    brow: [
      { x: 26, y: 22 },
      { x: 27, y: 22 },
    ],
    depth: 2,
  },
];

export function ledgesForMap(mapId: WorldMapId): readonly MapLedge[] {
  return WORLD_LEDGES.filter((ledge) => ledge.mapId === mapId);
}

/** The tiles a hop from `from` passes over, in order, ending on the landing. */
export function ledgeHopTiles(ledge: MapLedge, from: GridPosition): GridPosition[] {
  const delta = DIRECTION_DELTAS[ledge.drop];
  return Array.from({ length: ledge.depth + 1 }, (_, index) => ({
    x: from.x + delta.x * (index + 1),
    y: from.y + delta.y * (index + 1),
  }));
}

/** Where a hop from `from` puts the player down. */
export function ledgeLanding(ledge: MapLedge, from: GridPosition): GridPosition {
  const tiles = ledgeHopTiles(ledge, from);
  return tiles[tiles.length - 1];
}

/**
 * The hop available from a tile in a direction, or null.
 *
 * Only the authored way: pushing back up a ledge finds nothing here, which is
 * what makes it one way, and pushing along one finds nothing either.
 */
export function ledgeHopAt(
  mapId: WorldMapId,
  from: GridPosition,
  facing: Direction,
): { readonly ledge: MapLedge; readonly landing: GridPosition } | null {
  const ledge = ledgesForMap(mapId).find(
    (candidate) =>
      candidate.drop === facing &&
      candidate.brow.some((tile) => tile.x === from.x && tile.y === from.y),
  );
  return ledge ? { ledge, landing: ledgeLanding(ledge, from) } : null;
}

/** What the caption says the drop leads to. */
export const LEDGE_BEARINGS: Readonly<Record<Direction, string>> = {
  up: 'NORTH',
  down: 'SOUTH',
  left: 'WEST',
  right: 'EAST',
};

/** Two lines: what it is, and the one thing about it a player has to know. */
export function ledgeCaption(ledge: MapLedge): string {
  return `${ledge.label}\nDROP ${LEDGE_BEARINGS[ledge.drop]} - ONE WAY`;
}
