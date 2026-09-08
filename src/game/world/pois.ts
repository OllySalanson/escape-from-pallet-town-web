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
    position: { x: 1, y: 4 },
    label: 'TOWN PUMP',
    description: 'Marked supply cache at the end of the Well Verge. Nothing else comes through here.',
    reward: [
      { itemId: 'poke-ball', quantity: 2 },
      { itemId: 'potion', quantity: 1 },
    ],
  },
  {
    id: 'pallet-sluice-wheel',
    mapId: 'pallet-town',
    position: { x: 28, y: 31 },
    label: 'SLUICE WHEEL',
    description: 'Winding it drains the culvert at the far west corner of the leat and opens it as an exit.',
    reward: [],
    effect: 'unlock-extraction',
    unlockedExtractionLabel: 'WEST CULVERT',
  },
  {
    id: 'oak-field-station-relay',
    mapId: 'route-1',
    position: { x: 28, y: 18 },
    label: "OAK'S FIELD STATION",
    description: 'Marked supply cache: 2 Poke Balls and 1 Potion. Its relay opens the east spur.',
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
    position: { x: 16, y: 6 },
    label: 'FIRE TOWER',
    description: 'The warden ladder above the canopy. Lighting it opens the Tower Steps on the east ridge.',
    reward: [],
    effect: 'unlock-extraction',
    unlockedExtractionLabel: 'TOWER STEPS',
  },
  {
    id: 'floodplain-supply-vault',
    mapId: 'floodplain-relay',
    position: { x: 27, y: 15 },
    label: 'FLOODED SUPPLY VAULT',
    description: 'High-value cache. The way back north is longer than the causeway you came in on. Extract to bank it.',
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
    effect: 'unlock-extraction',
    unlockedExtractionLabel: 'RADIO EXIT',
  },
];

export function poisForMap(mapId: WorldMapId): readonly WorldPoi[] {
  return WORLD_POIS.filter((poi) => poi.mapId === mapId);
}
