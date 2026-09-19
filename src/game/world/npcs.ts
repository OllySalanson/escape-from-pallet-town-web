import type { Direction, GridPosition } from '../movement/gridMovement';
import type { WorldMapId } from '../worldMap';
import type { CastCharacterDesignId } from './characterDesigns';

export type WorldEntityKind = 'npc' | 'sign';

export interface WorldEntity {
  id: string;
  mapId: WorldMapId;
  kind: WorldEntityKind;
  position: GridPosition;
  facing: Direction;
  dialogLines: readonly string[];
  /**
   * The character design an `npc` is drawn from. Omitted is the shared sheet
   * under the townsfolk tint - see `characterPresentation.ts`. Signs ignore it.
   */
  design?: CastCharacterDesignId;
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
    position: { x: 15, y: 8 },
    facing: 'down',
    dialogLines: [
      'FLOODPLAIN RELAY - THE LANDING',
      'FERRY DOCK: the jetty, on the next signal. RADIO EXIT: west in the reeds, once the ranger station is switched on. SOUTH GATE: always open, and a long way south.',
      'East of the river somebody holds the toll bridge, the sluice and the orchard fence. Every one of them has a way out behind it.',
    ],
  },
  // Every way out of this map leaves the player looking at, or reading about,
  // somewhere they cannot get to yet. The Ferry Dock has the keep's tower across
  // the water; these two exits have no such view, so they have a notice.
  {
    id: 'floodplain-rangers-log',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 4, y: 23 },
    facing: 'right',
    dialogLines: [
      "RANGER'S LOG - nailed to a post",
      'Light in the keep tower again last night. Nobody has crossed the race since the sluice was shut, so who is up there?',
      'The old causeway off the Landing quay is under a yard of water. It was dry the summer before the flood.',
    ],
  },
  {
    id: 'floodplain-south-gate-notice',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 15, y: 56 },
    facing: 'right',
    dialogLines: [
      'SOUTH GATE - always open',
      'The causeway east of here, over to the store-house, is barred from the far side. The orchard warden keeps the bar.',
      'Whatever the relay put in its cellar is still down there.',
    ],
  },
  {
    id: 'floodplain-shore-road-sign',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 19, y: 17 },
    facing: 'left',
    dialogLines: [
      'SHORE ROAD - to MARKET ISLE',
      'Quick, dry, and watched where it narrows.',
      'The reeds go round. Nothing in them is free.',
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
