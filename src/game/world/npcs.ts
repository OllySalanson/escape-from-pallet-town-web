import type { Direction, GridPosition } from '../movement/gridMovement';
import type { WorldMapId } from '../worldMap';
import type { CastCharacterDesignId } from './characterDesigns';
import { REEDBEDS_PIKACHU } from './gifts';
import type { NpcIdle } from './npcIdle';

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
  /**
   * The small schedule this townsperson keeps: where they drift and which way
   * they look. Signs and anyone without one stand where they were put. Every
   * tile of it is held solid by `mapStructure.test.ts`, so a beat can never be
   * authored across a route - see `npcIdle.ts`.
   */
  idle?: NpcIdle;
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
      'SOUTH GATE: always open, over the water. MILL STAIR: behind the millpond, later, and behind the miller. WEST CULVERT: across the Flood, once the sluice is wound.',
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
      'There were four. The towpath round the head of the water went from the pond to the sluice without wetting a boot, and the miller has both ends of it.',
      'The allotments have gone to seed. Whatever was left in them is still in them.',
    ],
  },
  {
    id: 'route-guide',
    mapId: 'pallet-town',
    kind: 'npc',
    position: { x: 9, y: 10 },
    facing: 'left',
    // Pacing the square, a step west and back, looking down the two roads they
    // keep naming. Both tiles are on the square's wide row, which is why the
    // structural suite is what decides whether a beat may be authored at all.
    idle: { roam: [{ x: 8, y: 10 }], glances: ['down', 'right'], beatMs: 2300 },
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
    // Stepping down to the water and back up to the path. A different interval
    // from the guide's, so the two of them are never seen moving together.
    idle: { roam: [{ x: 22, y: 12 }], glances: ['left', 'right'], beatMs: 3100 },
    dialogLines: [
      'I could watch the millpond ripple all day.',
      'See the stair in the rock over the far bank? That is the quick way out - and the towpath to it is hurdled at the head and fallen in at the foot.',
      'MILLER VANCE keeps both. Nobody has walked the far bank since he shut it.',
    ],
  },
  {
    // The South Gate is the whole town away from the far bank and cannot see a
    // yard of it, so it says what is up there and who has it - as Route 1's two
    // far exits do for the Overlook.
    id: 'pallet-gate-road-notice',
    mapId: 'pallet-town',
    kind: 'sign',
    position: { x: 17, y: 38 },
    facing: 'left',
    dialogLines: [
      'SOUTH GATE ROAD - always open',
      'The path along the far side of the millpond is the MILL STAIR, and it is the one way out of this town that never crosses the water.',
      'MILLER VANCE has it hurdled at the pond end and fallen in above the sluice. Ask him yourself.',
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
    // A milestone on each of the two southern roads. They are the only two
    // places on this map that are a road and nothing else, and a stranger who
    // toured the four maps once placed every district that held an object and
    // none that was only a name - so each of them holds one.
    id: 'route-1-drove-milestone',
    mapId: 'route-1',
    kind: 'sign',
    position: { x: 10, y: 40 },
    facing: 'right',
    dialogLines: [
      'THE DROVE - milestone',
      'SOUTH GATE 3 furlongs, over the plank bridge and down the west side of the common.',
      'Back the way you came: the OUTPOST, and the braid.',
    ],
  },
  {
    id: 'route-1-old-road-milestone',
    mapId: 'route-1',
    kind: 'sign',
    position: { x: 26, y: 40 },
    facing: 'left',
    dialogLines: [
      'THE OLD ROAD - milestone',
      'The ford is below. It is the quick way south and somebody sits on it.',
      'Bear east at the brook for the STEADING and the burn beyond it.',
    ],
  },
  {
    // The south half needs its own board: a player who walks past the Outpost
    // is on a map twice as long again as the one they know, with nothing that
    // says so.
    id: 'route-1-brook-board',
    mapId: 'route-1',
    kind: 'sign',
    position: { x: 14, y: 50 },
    facing: 'down',
    dialogLines: [
      'THE BROOK - three crossings',
      'Plank bridge here on the drove. The ford is on the OLD ROAD, east, and DROVER GIL sits on it.',
      'The stepping stones below the steading are the third, and nobody tolls those.',
    ],
  },
  {
    id: 'route-1-south-gate-notice',
    mapId: 'route-1',
    kind: 'sign',
    position: { x: 26, y: 65 },
    facing: 'left',
    dialogLines: [
      'SOUTH GATE - always open',
      'The road goes on to Viridian from here. THE COMMON is behind you and both roads run down either side of it.',
      'East along the hollow way is the CHARCOAL BURN. The kiln there opens the cart road out of it.',
    ],
  },
  {
    id: 'route-1-orchard-notice',
    mapId: 'route-1',
    kind: 'sign',
    position: { x: 35, y: 10 },
    facing: 'down',
    dialogLines: [
      'THE ORCHARD - keep to the turf',
      'Gate in every wall. North is the arch out; east is the ride; south is the lane down to the steading, and ORCHARDIST NELL stands in it.',
      'There is a ride up into the wood off the east lane. It has been grown shut since before my time - it would take a CUT.',
    ],
  },
  // Viridian Forest had no writing on it at all, which on the one map where
  // every screen looks like the last is the map with the least to go on. Two
  // notices: the board you drop in beside, and one at the ford at the far end,
  // because the ridge is a thing you can see and never reach.
  {
    id: 'forest-landing-board',
    mapId: 'viridian-forest',
    kind: 'sign',
    position: { x: 9, y: 3 },
    facing: 'down',
    dialogLines: [
      'VIRIDIAN FOREST - NORTH LANDING',
      'Eleven clearings, seventeen trails, and every trail is grass. Nothing here is reached dry.',
      'BROOK FORD: always open, west. FOREST CLEARING: south, later. TOWER STEPS: east, once the fire tower is lit.',
    ],
  },
  {
    id: 'forest-brook-notice',
    mapId: 'viridian-forest',
    kind: 'sign',
    position: { x: 5, y: 19 },
    facing: 'right',
    dialogLines: [
      'BROOK FORD - always open',
      'The bare rock along the top of the wood is THE RIDGE. It runs from the fire tower to the head of the Tower Steps, and it is the only ground in this forest with no grass on it.',
      'LOOKOUT PELL has the way up hurdled and the way down under rock. Nobody else has stood on it.',
    ],
  },
  {
    // Halfway along the ridge, which is fifty steps of bare rock with two doors
    // on it and, until this, nothing else: the one place in the game you are
    // above the canopy, so what it says is what you can see from up here and
    // cannot get to from up here.
    id: 'forest-ridge-board',
    mapId: 'viridian-forest',
    kind: 'sign',
    // In the nub off the shelf, not on it: three tiles east the shelf is one
    // tile through, and a sign is a figure the player cannot walk into, so one
    // standing there would wall the whole east ridge off (`mapStructure.test.ts`).
    position: { x: 41, y: 3 },
    facing: 'down',
    dialogLines: [
      'CINDER RIDGE - the lookout\u2019s board',
      'Below you, west to east: the burn where the fire ran, the black tarn, and the collier\u2019s smoke beyond it. South of the wall in the middle distance, the quarry.',
      'There is no way down off this rock between the fire tower and the crag. Walk it or go back.',
    ],
  },
  {
    // At the wall's gateway, which is the middle of the south and the place a
    // player first has to choose between the quarry and the road.
    id: 'forest-stone-row-notice',
    mapId: 'viridian-forest',
    kind: 'sign',
    position: { x: 32, y: 45 },
    facing: 'down',
    dialogLines: [
      'STONE ROW - the wall at the middle of the wood',
      'North of the wall is the sawpit and the way you came. South of it the quarry, and past the quarry the road out.',
      'SOUTH GATE: always open, at the foot of the road. QUARRY ADIT: inside the working, behind whoever is holding the gate.',
    ],
  },
  {
    // The kilns are a drop-in of their own, so the board there says what a
    // player landing in the far east can reach without crossing the whole map.
    id: 'forest-kiln-board',
    mapId: 'viridian-forest',
    kind: 'sign',
    position: { x: 54, y: 29 },
    facing: 'down',
    dialogLines: [
      'CHARCOAL BURN - the collier’s yard',
      'KILN ROAD: the cart nook east of the pitsteads, once the raid has run a while. CRAG PATH: north, over the tarn and up, and there is no way up.',
      'The ride south is quick and it is watched. The timber road west is neither.',
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
