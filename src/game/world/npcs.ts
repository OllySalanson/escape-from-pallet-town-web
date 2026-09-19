import type { Direction, GridPosition } from '../movement/gridMovement';
import type { WorldMapId } from '../worldMap';
import type { CastCharacterDesignId } from './characterDesigns';
import { REEDBEDS_PIKACHU } from './gifts';

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
    position: { x: 9, y: 8 },
    facing: 'down',
    dialogLines: [
      'PALLET TOWN - MARKET SQUARE',
      'East for the north field and the mill. South for the green, the allotments and the leat.',
      'SOUTH GATE: always open, over the water. MILL STAIR: behind the millpond, later. WEST CULVERT: across the Flood, once the sluice is wound.',
    ],
  },
  {
    id: 'oak-route-board',
    mapId: 'pallet-town',
    kind: 'sign',
    position: { x: 4, y: 14 },
    facing: 'down',
    dialogLines: [
      'THE GREEN - PARISH NOTICE',
      'Three ways over the leat. The west ford lands in the reeds; the bridge is held; the east ford is the quiet one, and the long one.',
      'The allotments have gone to seed. Whatever was left in them is still in them.',
    ],
  },
  {
    id: 'route-guide',
    mapId: 'pallet-town',
    kind: 'npc',
    position: { x: 9, y: 10 },
    facing: 'left',
    dialogLines: [
      'Two houses, one square, and the water between us and everywhere else.',
      'East for the field and the mill. South for the sheds and the allotments.',
    ],
  },
  {
    id: 'pond-watcher',
    mapId: 'pallet-town',
    kind: 'npc',
    position: { x: 22, y: 11 },
    facing: 'down',
    dialogLines: [
      'I could watch the millpond ripple all day.',
      'See the stair in the rock over the far bank? That is the quick way out, when they open it.',
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
      'Two roads, and the meadows between them. The roads are quick and bare; every way across is grass.',
      'WEST GATE: open now, south-west. ROUTE OUTPOST: south, later. STATION RELAY: east, once the field station is switched on.',
    ],
  },
  // Two of this route's ways out are the whole map away from the Overlook and
  // cannot see it, so each has a notice that says it is there and who has it -
  // as the Floodplain's far exits do.
  {
    id: 'route-1-west-gate-notice',
    mapId: 'route-1',
    kind: 'sign',
    position: { x: 9, y: 24 },
    facing: 'down',
    dialogLines: [
      'WEST GATE - always open',
      'The shelf of ground on the bank above Oak\'s field station is the OVERLOOK. It is fenced, and Warden Wren has the gate.',
      'They say there was a way down the bank into the station yard, before the rock came down.',
    ],
  },
  {
    id: 'route-1-outpost-notice',
    mapId: 'route-1',
    kind: 'sign',
    position: { x: 18, y: 26 },
    facing: 'down',
    dialogLines: [
      'ROUTE OUTPOST - opens on the signal',
      'Nobody has been up on the OVERLOOK since the warden shut it. You can see its fence from the field station\'s yard, north-east of here.',
    ],
  },
  {
    // The one giver (`gifts.ts`): she stands in the nook at the head of the
    // lane, so nobody passes through her, and she is what the entity's own
    // lines say once there is nothing left to give.
    id: REEDBEDS_PIKACHU.giverId,
    mapId: 'floodplain-relay',
    kind: 'npc',
    position: { x: 19, y: 23 },
    facing: 'down',
    design: 'old-woman',
    dialogLines: REEDBEDS_PIKACHU.after,
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
    position: { x: 4, y: 24 },
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
      'OLD TOWN - SOUTH GATE - always open',
      'The causeway east of here, over to the store-house, is barred from the far side. The orchard warden keeps the bar.',
      'Whatever the relay put in its cellar is still down there.',
    ],
  },
  {
    // Where the footpath from the reeds comes out onto the street, which is
    // the first a walker sees of the town.
    id: 'floodplain-old-town-sign',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 7, y: 36 },
    facing: 'down',
    dialogLines: [
      'OLD TOWN',
      'The river has the east end of the street, and the churchyard. Wade it - it is only to the knee.',
      'The paved road runs south past the chapel to the last house and the SOUTH GATE. Across the water is MARKET ISLE.',
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
