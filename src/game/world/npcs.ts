import type { Direction, GridPosition } from '../movement/gridMovement';
import type { WorldMapId } from '../worldMap';

export type WorldEntityKind = 'npc' | 'sign';

export interface WorldEntity {
  id: string;
  mapId: WorldMapId;
  kind: WorldEntityKind;
  position: GridPosition;
  facing: Direction;
  dialogLines: readonly string[];
}

/**
 * Signs and townsfolk block their own tile, so every one of them stands at the
 * end of a lane you walk into or on a one-tile stub off one. A sign placed on a
 * lane is a severed route, not a landmark.
 */
export const WORLD_ENTITIES: readonly WorldEntity[] = [
  {
    id: 'town-sign',
    mapId: 'pallet-town',
    kind: 'sign',
    position: { x: 9, y: 4 },
    facing: 'down',
    dialogLines: [
      'PALLET TOWN - MARKET SQUARE',
      'One gate on each side. The ring does not join up in the north-west.',
      'South Gate is always open. Mill Stair opens later. West Culvert needs the sluice.',
    ],
  },
  {
    id: 'oak-route-board',
    mapId: 'pallet-town',
    kind: 'sign',
    position: { x: 1, y: 5 },
    facing: 'down',
    dialogLines: [
      'WELL VERGE NOTICE',
      'The pump is a dead end. Nothing comes through here but you.',
      'The allotments hold the store. The copse holds nothing and hides you from nothing.',
    ],
  },
  {
    id: 'route-guide',
    mapId: 'pallet-town',
    kind: 'npc',
    position: { x: 5, y: 7 },
    facing: 'right',
    dialogLines: [
      'Four gates, four different mornings.',
      'East for the orchard and the mill. South for the sheds and the allotments.',
    ],
  },
  {
    id: 'pond-watcher',
    mapId: 'pallet-town',
    kind: 'npc',
    position: { x: 19, y: 9 },
    facing: 'up',
    dialogLines: [
      'I could watch the millpond ripple all day.',
      'Mind the leat down south. Three fords and only one of them is quiet.',
    ],
  },
  {
    id: 'route-1-board',
    mapId: 'route-1',
    kind: 'sign',
    position: { x: 15, y: 2 },
    facing: 'down',
    dialogLines: [
      'ROUTE 1 - THE BRAID',
      'Two roads, four crossings. The roads are quick and bare.',
      'Every crossing is grass. West Gate is open now; the outpost opens later.',
    ],
  },
  {
    id: 'floodplain-route-board',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 13, y: 4 },
    facing: 'down',
    dialogLines: [
      'FLOODPLAIN RELAY',
      'SOUTH GATE: dependable and open now.',
      'FERRY DOCK: departs on the next signal. RANGER RADIO: activate at the station.',
    ],
  },
  {
    id: 'vault-warning',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 19, y: 14 },
    facing: 'left',
    dialogLines: [
      'FLOODED SUPPLY VAULT',
      'High-value supplies inside. The way back north is longer than the way in.',
      'Anything carried out banks only after extraction.',
    ],
  },
];

export function entitiesForMap(mapId: WorldMapId): readonly WorldEntity[] {
  return WORLD_ENTITIES.filter((entity) => entity.mapId === mapId);
}

export function getWorldEntityAt(
  mapId: WorldMapId,
  position: GridPosition,
): WorldEntity | undefined {
  return WORLD_ENTITIES.find(
    (entity) =>
      entity.mapId === mapId &&
      entity.position.x === position.x &&
      entity.position.y === position.y,
  );
}
