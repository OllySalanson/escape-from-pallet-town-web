import { DIRECTION_DELTAS, type Direction, type GridPosition } from '../movement/gridMovement';
import type { WorldMapId } from '../worldMap';
import { playerMap } from './playerMaps';

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
 * already solid, and the landing is already walkable: `mapStructure.testkit.ts`
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

  // -- Viridian City ---------------------------------------------------------
  // FireRed's own ledges, drawn where FireRed draws them on the roads round
  // Viridian: every one drops south, towards Pallet Town and home, so the way
  // back from anywhere is quick and the way in is the road round. The hunter
  // cannot follow a hop, which is what makes the terraces the escape they are.
  {
    // The long ledge under the Gym, exactly where Viridian has always had it:
    // off the Gym's paving onto the cross street in one hop.
    id: 'viridian-gym-ledge',
    mapId: 'viridian-city',
    label: 'GYM LEDGE',
    drop: 'down',
    brow: [{ x: 41, y: 30 }, { x: 42, y: 30 }, { x: 43, y: 30 }, { x: 44, y: 30 }, { x: 45, y: 30 }, { x: 46, y: 30 }, { x: 47, y: 30 }, { x: 48, y: 30 }, { x: 49, y: 30 }, { x: 50, y: 30 }, { x: 51, y: 30 }, { x: 52, y: 30 }, { x: 53, y: 30 }, { x: 54, y: 30 }, { x: 55, y: 30 }, { x: 56, y: 30 }, { x: 57, y: 30 }, { x: 58, y: 30 }, { x: 59, y: 30 }, { x: 60, y: 30 }, { x: 61, y: 30 }],
    depth: 1,
  },
  {
    // The foot of Route 22's pond field, onto the League road where it bends
    // for the town.
    id: 'viridian-pond-field-ledge',
    mapId: 'viridian-city',
    label: 'POND FIELD LEDGE',
    drop: 'down',
    brow: [{ x: 11, y: 30 }, { x: 12, y: 30 }, { x: 13, y: 30 }, { x: 14, y: 30 }, { x: 15, y: 30 }, { x: 16, y: 30 }, { x: 17, y: 30 }, { x: 18, y: 30 }, { x: 19, y: 30 }, { x: 20, y: 30 }, { x: 21, y: 30 }],
    depth: 1,
  },
  {
    // Off the foot of Route 2's east grass bed, back towards the town gap.
    id: 'viridian-forest-road-ledge',
    mapId: 'viridian-city',
    label: 'FOREST ROAD LEDGE',
    drop: 'down',
    brow: [{ x: 44, y: 17 }, { x: 45, y: 17 }, { x: 46, y: 17 }, { x: 47, y: 17 }, { x: 48, y: 17 }, { x: 49, y: 17 }],
    depth: 1,
  },
  {
    // The town's south edge, either side of Main Street: out of Garden Row and
    // down onto Route 1's top terrace.
    id: 'viridian-garden-ledge-west',
    mapId: 'viridian-city',
    label: 'GARDEN LEDGE',
    drop: 'down',
    brow: [{ x: 24, y: 55 }, { x: 25, y: 55 }, { x: 26, y: 55 }, { x: 27, y: 55 }, { x: 28, y: 55 }, { x: 29, y: 55 }, { x: 30, y: 55 }, { x: 31, y: 55 }, { x: 32, y: 55 }, { x: 33, y: 55 }, { x: 34, y: 55 }],
    depth: 1,
  },
  {
    id: 'viridian-garden-ledge-east',
    mapId: 'viridian-city',
    label: 'GARDEN LEDGE',
    drop: 'down',
    brow: [{ x: 41, y: 55 }, { x: 42, y: 55 }, { x: 43, y: 55 }, { x: 44, y: 55 }, { x: 45, y: 55 }, { x: 46, y: 55 }, { x: 47, y: 55 }, { x: 48, y: 55 }, { x: 49, y: 55 }, { x: 50, y: 55 }, { x: 51, y: 55 }, { x: 52, y: 55 }, { x: 53, y: 55 }, { x: 54, y: 55 }, { x: 55, y: 55 }, { x: 56, y: 55 }, { x: 57, y: 55 }, { x: 58, y: 55 }, { x: 59, y: 55 }, { x: 60, y: 55 }, { x: 61, y: 55 }],
    depth: 1,
  },
  {
    // The bush in the middle of it stands where a hop would have landed in the
    // Lass's watch on the road below: a drop taken to get away must never be
    // the step that starts a fight.
    id: 'viridian-upper-terrace-ledge',
    mapId: 'viridian-city',
    label: 'UPPER TERRACE',
    drop: 'down',
    brow: [{ x: 30, y: 62 }, { x: 31, y: 62 }, { x: 32, y: 62 }, { x: 33, y: 62 }, { x: 34, y: 62 }, { x: 35, y: 62 }, { x: 36, y: 62 }, { x: 37, y: 62 }, { x: 38, y: 62 }, { x: 39, y: 62 }, { x: 40, y: 62 }, { x: 41, y: 62 }, { x: 42, y: 62 }, { x: 43, y: 62 }, { x: 45, y: 62 }, { x: 46, y: 62 }, { x: 47, y: 62 }, { x: 48, y: 62 }, { x: 49, y: 62 }, { x: 50, y: 62 }, { x: 51, y: 62 }, { x: 52, y: 62 }, { x: 53, y: 62 }],
    depth: 1,
  },
  {
    // A bush caps each ledge where the way round is only a step or two off, as
    // FireRed ends its ledges against growth, and the two bushes along this one's
    // brow are the tiles of it that do not hop.
    id: 'viridian-lower-terrace-ledge',
    mapId: 'viridian-city',
    label: 'LOWER TERRACE',
    drop: 'down',
    brow: [{ x: 25, y: 68 }, { x: 26, y: 68 }, { x: 27, y: 68 }, { x: 28, y: 68 }, { x: 29, y: 68 }, { x: 30, y: 68 }, { x: 31, y: 68 }, { x: 32, y: 68 }, { x: 34, y: 68 }, { x: 35, y: 68 }, { x: 36, y: 68 }, { x: 37, y: 68 }, { x: 38, y: 68 }, { x: 39, y: 68 }, { x: 40, y: 68 }, { x: 41, y: 68 }, { x: 42, y: 68 }, { x: 43, y: 68 }, { x: 44, y: 68 }, { x: 46, y: 68 }, { x: 47, y: 68 }, { x: 48, y: 68 }],
    depth: 1,
  },
];

/** A map's ledges: the authored ones, or every ledge a map file paints. */
export function ledgesForMap(mapId: WorldMapId): readonly MapLedge[] {
  return [
    ...WORLD_LEDGES.filter((ledge) => ledge.mapId === mapId),
    ...(playerMap(mapId)?.ledges ?? []),
  ];
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
