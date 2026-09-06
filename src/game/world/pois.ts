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
];

export function poisForMap(mapId: WorldMapId): readonly WorldPoi[] {
  return WORLD_POIS.filter((poi) => poi.mapId === mapId);
}
