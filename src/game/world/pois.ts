import type { ItemId } from '../items';
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
): PoiActivationResult {
  if (!poi || !isRunActive || activatedPoiIds.has(poi.id)) {
    return 'unavailable';
  }

  if (!poi.reward.every((item) => collectRunItem(item.itemId, item.quantity))) {
    return 'bag-full';
  }

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
