import { ITEMS, cellsFor, type ItemId } from '../items';
import type { GridPosition } from '../movement/gridMovement';
import type { WorldMapId } from '../worldMap';

export interface WorldPoi {
  readonly id: string;
  readonly mapId: WorldMapId;
  readonly position: GridPosition;
  readonly label: string;
  readonly description: string;
  readonly reward: readonly { readonly itemId: ItemId; readonly quantity: number }[];
  /**
   * A landmark can change the route state even when it has no item reward.
   * Every map has exactly one exit that opens this way, and it is always at the
   * other end of the map from the landmark that opens it.
   */
  readonly effect?: 'unlock-extraction';
  /** What that exit is called, so the landmark can name it when it opens. */
  readonly unlockedExtractionLabel?: string;
}

export type PoiActivationResult = 'activated' | 'unavailable' | 'bag-full';

/**
 * Fixed landmarks belong to authored map content, not the seeded loot pool.
 * They can only be activated once during an active extraction raid.
 */
export function tryActivatePoi(
  poi: WorldPoi | undefined,
  isRunActive: boolean,
  activatedPoiIds: Set<string>,
  collectRunItem: (itemId: ItemId, quantity: number) => boolean,
  hasRoomForAll: (reward: WorldPoi['reward']) => boolean,
): PoiActivationResult {
  if (!poi || !isRunActive || activatedPoiIds.has(poi.id)) {
    return 'unavailable';
  }

  // Whole or not at all. Taken a piece at a time, two Poke Balls that fit and a
  // Potion that does not left the balls in the pack with the landmark still
  // unworked - so walking over it again paid the balls out a second time.
  if (!hasRoomForAll(poi.reward)) {
    return 'bag-full';
  }
  poi.reward.forEach((item) => collectRunItem(item.itemId, item.quantity));

  activatedPoiIds.add(poi.id);
  return 'activated';
}

export const WORLD_POIS: readonly WorldPoi[] = [
  {
    id: 'pallet-town-pump',
    mapId: 'pallet-town',
    position: { x: 3, y: 16 },
    label: 'TOWN PUMP',
    description: 'Marked supply cache under the pump on the Green, a few steps south of the square.',
    reward: [
      { itemId: 'poke-ball', quantity: 2 },
      { itemId: 'potion', quantity: 1 },
    ],
  },
  {
    id: 'pallet-sluice-wheel',
    mapId: 'pallet-town',
    position: { x: 25, y: 31 },
    label: 'SLUICE WHEEL',
    description: 'The hatch at the head of the leat, below the mill race. Winding it shut drains the culvert on the far shore of the Flood and opens it as an exit.',
    reward: [],
    effect: 'unlock-extraction',
    unlockedExtractionLabel: 'WEST CULVERT',
  },
  {
    id: 'oak-field-station-relay',
    mapId: 'route-1',
    position: { x: 26, y: 15 },
    label: "OAK'S FIELD STATION",
    description: 'Marked supply cache at the station door: 2 Poké Balls and 1 Potion. Switching its relay on opens the Station Relay exit at the east end of the yard.',
    reward: [
      { itemId: 'poke-ball', quantity: 2 },
      { itemId: 'potion', quantity: 1 },
    ],
    effect: 'unlock-extraction',
    unlockedExtractionLabel: 'STATION RELAY',
  },
  {
    id: 'forest-fire-tower',
    mapId: 'viridian-forest',
    position: { x: 14, y: 4 },
    label: 'FIRE TOWER',
    description: 'The stone tower that stands above the canopy. Lighting it opens the Tower Steps, the stair in the rock on the east ridge.',
    reward: [],
    effect: 'unlock-extraction',
    unlockedExtractionLabel: 'TOWER STEPS',
  },
  {
    // Behind the CUT door, and the whole of what that door is worth. A cache
    // rather than a route: the wood is two-connected, so a cut anywhere in it
    // saves four steps, and what makes an HM worth carrying is the clearing on
    // the other side of one.
    id: 'forest-coppice-store',
    mapId: 'viridian-forest',
    position: { x: 13, y: 29 },
    label: "COPPICER'S STORE",
    description:
      'The store in the old coppice, behind the growth that closed the ride. Nobody has been in since the wood grew over it.',
    reward: [
      { itemId: 'great-ball', quantity: 2 },
      { itemId: 'super-potion', quantity: 1 },
    ],
  },
  {
    // The south's own cache, in the timber yard everybody walks through on the
    // way to the hollow way. Nothing seals behind it: it is the ordinary kind
    // of landmark, which a map this size needs more than one of.
    id: 'forest-sawyers-store',
    mapId: 'viridian-forest',
    position: { x: 20, y: 44 },
    label: "SAWYER'S STORE",
    description: 'The lean-to at the foot of the sawpit, still holding what the sawyers left when the wood stopped being worked.',
    reward: [
      { itemId: 'poke-ball', quantity: 2 },
      { itemId: 'potion', quantity: 1 },
    ],
  },
  {
    // Behind Quarryman Mott, beside the adit that is also the way home. The
    // best cache on the map because it is behind the deepest door on it.
    id: 'forest-adit-store',
    mapId: 'viridian-forest',
    position: { x: 42, y: 62 },
    label: 'ADIT STORE',
    description: "The quarrymen's store at the back of the working, under the adit mouth. Nobody has been down here since the gate was hung.",
    reward: [
      { itemId: 'great-ball', quantity: 2 },
      { itemId: 'super-potion', quantity: 1 },
    ],
  },
  {
    // The far south-west corner, which is the longest walk on the map from any
    // landing. What is out there has to be worth the walk out there.
    id: 'forest-warren-dig',
    mapId: 'viridian-forest',
    position: { x: 9, y: 62 },
    label: 'THE OLD DIG',
    description: 'Somebody dug into the sand bank a long time ago and roofed it with a board. Whatever they were keeping out of the wet is still in it.',
    reward: [
      { itemId: 'super-potion', quantity: 1 },
      { itemId: 'antidote', quantity: 1 },
    ],
  },
  {
    // The home bank's own cache. The supply vault was this map's only one, and
    // it is behind two bosses now; a fresh save had nothing left to detour for.
    id: 'floodplain-drowned-chapel',
    mapId: 'floodplain-relay',
    position: { x: 12, y: 41 },
    label: 'DROWNED CHAPEL',
    description: "Old Town's chapel, standing in what was its green. Somebody left a Poke Ball on the sill above the waterline.",
    reward: [{ itemId: 'poke-ball', quantity: 1 }],
  },
  {
    id: 'floodplain-supply-vault',
    mapId: 'floodplain-relay',
    position: { x: 44, y: 50 },
    label: 'FLOODED SUPPLY VAULT',
    description: 'High-value cache under the open trapdoor. The causeway west is the short way out once the orchard warden is beaten. Extract to bank it.',
    reward: [
      { itemId: 'great-ball', quantity: 2 },
      { itemId: 'super-potion', quantity: 1 },
    ],
  },
  {
    // On the bar in the great reach, across the SURF door. What the flood took
    // off the quay and put down again where nobody could follow it.
    id: 'floodplain-shoal-cache',
    mapId: 'floodplain-relay',
    position: { x: 28, y: 43 },
    label: 'STRANDED LIGHTER',
    description:
      'A relay lighter left on the bar when the water dropped, still holding what it was carrying when the flood took it.',
    reward: [
      { itemId: 'great-ball', quantity: 1 },
      { itemId: 'super-potion', quantity: 2 },
    ],
  },
  {
    id: 'floodplain-ranger-radio',
    mapId: 'floodplain-relay',
    position: { x: 12, y: 16 },
    label: 'RANGER STATION',
    description: 'Hunter forecast: the shore road is exposed, the reeds break sightlines, and switching this on opens the Radio Exit out west in the marsh.',
    reward: [],
    effect: 'unlock-extraction',
    unlockedExtractionLabel: 'RADIO EXIT',
  },
];

export function poisForMap(mapId: WorldMapId): readonly WorldPoi[] {
  return WORLD_POIS.filter((poi) => poi.mapId === mapId);
}

/**
 * What a landmark says when its cache will not go into the pack.
 *
 * It names the cache and the squares it needs, exactly as ground loot does:
 * "bag is full" on its own is a wall, and the grid's promise is that a refusal
 * hands the player the decision. Nothing is taken and nothing is worked, so
 * the answer is to put something down and step back on to it.
 */
export function cacheRefusalLine(poi: WorldPoi): string {
  const squares = poi.reward.reduce(
    (total, { itemId, quantity }) => total + cellsFor(itemId, quantity),
    0,
  );
  const names = poi.reward
    .map(({ itemId, quantity }) => `${quantity}\u00d7 ${ITEMS[itemId].displayName.toUpperCase()}`)
    .join(' and ');
  return `No room for ${names} - the cache needs ${
    squares === 1 ? '1 square' : `${squares} squares`
  }.`;
}
