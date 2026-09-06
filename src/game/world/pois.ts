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
  /** A landmark can change the route state even when it has no item reward. */
  readonly effect?: 'activate-radio';
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
    id: 'oak-field-station-relay',
    mapId: 'route-1',
    position: { x: 12, y: 5 },
    label: "OAK'S FIELD STATION",
    description: 'Marked supply cache: 2 Poke Balls and 1 Potion. Extract to secure it.',
    reward: [
      { itemId: 'poke-ball', quantity: 2 },
      { itemId: 'potion', quantity: 1 },
    ],
  },
  {
    id: 'floodplain-supply-vault',
    mapId: 'floodplain-relay',
    position: { x: 27, y: 15 },
    label: 'FLOODED SUPPLY VAULT',
    description: 'High-value cache. The only return crosses the exposed flooded causeway. Extract to bank it.',
    reward: [
      { itemId: 'great-ball', quantity: 2 },
      { itemId: 'super-potion', quantity: 1 },
    ],
  },
  {
    id: 'floodplain-ranger-radio',
    mapId: 'floodplain-relay',
    position: { x: 18, y: 7 },
    label: 'RANGER STATION',
    description: 'Hunter forecast: the road is exposed, reeds break sightlines, and the Radio Exit opens here.',
    reward: [],
    effect: 'activate-radio',
  },
];

export function poisForMap(mapId: WorldMapId): readonly WorldPoi[] {
  return WORLD_POIS.filter((poi) => poi.mapId === mapId);
}
