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
    // In the nook at the head of the quarry track, which is the far end of the
    // valley from anything the town's own signs name.
    id: 'pallet-quarry-board',
    mapId: 'pallet-town',
    kind: 'sign',
    position: { x: 62, y: 16 },
    facing: 'left',
    dialogLines: [
      'QUARRY TRACK - always open',
      'Stone went out this way and never came back through the town. The RIDE west through the high wood is the long walk home.',
      'The bench above the kilns is a drop, not a path. Go down it and you are not coming back up - and the LIME ROAD out of the kiln floor is the way home from down there.',
    ],
  },
  {
    // On the Gate Lane's own stub, where the road out of the stockyard turns
    // south. The town's other boards all face the water; this one faces away.
    id: 'pallet-gate-lane-board',
    mapId: 'pallet-town',
    kind: 'sign',
    position: { x: 25, y: 42 },
    facing: 'left',
    dialogLines: [
      'GATE LANE - to the hay meadows and the tide',
      'South for the closes, the rickyard and the brook. Keep the brook on your left and you come out on the saltings.',
      'FERRY HARD is at the foot of it, and the boat comes when it comes.',
    ],
  },
  {
    // On the hard, where a player who has walked the whole valley arrives.
    id: 'pallet-hard-board',
    mapId: 'pallet-town',
    kind: 'sign',
    position: { x: 29, y: 71 },
    facing: 'down',
    dialogLines: [
      'THE HARD - ferry lies off',
      'West is the strand and the marsh behind it. East is the NESS, and SALTER COBB keeps the gate across its neck.',
      'Beat her and the COBB STEPS down the headland come out here, which makes the whole south a ring - and the HEADLAND STEPS off its south tip are a way home nobody who has not beaten her has.',
    ],
  },
  // -- The valley the town stands in ----------------------------------------
  // A parish is people working it, and on a map four times the size that is
  // also what stops the new ground reading as trail-through-trees: the walk
  // from any tile to the nearest permanent authored thing is the number
  // `tools/tileset/density.mts` prints, and these are most of what moved it.
  // Each one says where they are and what is the next way on from it, because
  // on a valley this long the thing a player most needs is a bearing.
  {
    id: 'pallet-hanger-woodman',
    mapId: 'pallet-town',
    kind: 'npc',
    position: { x: 40, y: 25 },
    facing: 'left',
    design: 'old-man',
    dialogLines: [
      'Beech, this. Cut it in winter and it burns in the same winter.',
      'Spring rises above you and goes under the rock. Nobody has ever traced it, and the mill has never gone short.',
      'Up the slope for the quarry. There is no way down to the towpath from here - that is what the rock is for.',
    ],
  },
  {
    id: 'pallet-lime-burner',
    mapId: 'pallet-town',
    kind: 'npc',
    position: { x: 60, y: 35 },
    facing: 'left',
    design: 'heavy-man',
    dialogLines: [
      'Two mouths, both drawing. Stand upwind of them.',
      'Stone comes off the bench up there, lime goes out by the LIME ROAD behind me.',
      'The bench is a drop, not a road. Breaker Finn will tell you what it costs to find that out.',
    ],
  },
  {
    id: 'pallet-drove-board',
    mapId: 'pallet-town',
    kind: 'sign',
    position: { x: 41, y: 40 },
    facing: 'left',
    dialogLines: [
      'THE DROVE - stock road, sluice apron to the old fields',
      'Six short reaches down the hill. The kilns are off the fourth of them, and the LIME ROAD out of the kiln floor.',
      'Keep on down for the old fields and the sea wall.',
    ],
  },
  {
    id: 'pallet-fields-shepherd',
    mapId: 'pallet-town',
    kind: 'npc',
    position: { x: 56, y: 47 },
    facing: 'down',
    design: 'straw-hat',
    dialogLines: [
      'Nobody has had a plough through these closes since the flood.',
      'Gate to gate is the quickest way down - the lane zig-zags because the closes do.',
      'The fold is still standing at the bottom of it, and past that the NESS.',
    ],
  },
  {
    id: 'pallet-fields-board',
    mapId: 'pallet-town',
    kind: 'sign',
    position: { x: 48, y: 52 },
    facing: 'left',
    dialogLines: [
      'THE OLD FIELDS - green lane to the sea wall',
      'Four closes and a lane that turns at every one of them. Every close has one gate and it is never where you are standing.',
      'At the foot: the NESS, and SALTER COBB across the neck of it.',
    ],
  },
  {
    id: 'pallet-fields-lad',
    mapId: 'pallet-town',
    kind: 'npc',
    position: { x: 46, y: 64 },
    facing: 'right',
    design: 'boy',
    dialogLines: [
      'You going out to the light? She will not have it.',
      'There is a way down her wall onto the hard, but you have to beat her for it first.',
    ],
  },
  {
    id: 'pallet-hayward',
    mapId: 'pallet-town',
    kind: 'npc',
    position: { x: 22, y: 60 },
    facing: 'right',
    design: 'woman',
    dialogLines: [
      'Brook rises under the rickyard and runs out on the marsh. It is fresh this far and salt a hundred steps on.',
      'Ford is on your left. Keep the water on your right after it and you come out on the strand.',
    ],
  },
  {
    id: 'pallet-withy-cutter',
    mapId: 'pallet-town',
    kind: 'npc',
    position: { x: 12, y: 54 },
    facing: 'left',
    design: 'bald-man',
    dialogLines: [
      'Osier. Cut every third year and it keeps the whole parish in baskets.',
      'Causeway is the only dry line through here and it turns four times. Off it is water.',
      'It comes out on the saltings, same as the Gate Lane does - just slower, and nobody watching.',
    ],
  },
  {
    id: 'pallet-withy-loft',
    mapId: 'pallet-town',
    kind: 'npc',
    position: { x: 7, y: 52 },
    facing: 'down',
    design: 'old-woman',
    dialogLines: [
      'Dry them a year before you weave them. Everyone is in too much of a hurry.',
      'North is the FLOOD and the town. South is the beds, then the marsh, then the sea.',
    ],
  },
  {
    id: 'pallet-withy-board',
    mapId: 'pallet-town',
    kind: 'sign',
    position: { x: 11, y: 58 },
    facing: 'left',
    dialogLines: [
      'THE WITHY BEDS - causeway only',
      'Water either side for twenty steps. The beds are cut in plots and the plots are not paths.',
      'South for THE SALTINGS and the pans. North for the Flood and the town.',
    ],
  },
  {
    id: 'pallet-withy-boy',
    mapId: 'pallet-town',
    kind: 'npc',
    position: { x: 12, y: 62 },
    facing: 'left',
    design: 'youngster',
    dialogLines: [
      'Foot of the beds. Salt starts about where the reeds stop.',
      'Mind the creeks down there - two of them, and one ford each.',
    ],
  },
  {
    id: 'pallet-salt-hand',
    mapId: 'pallet-town',
    kind: 'npc',
    position: { x: 6, y: 67 },
    facing: 'right',
    design: 'heavy-man',
    dialogLines: [
      'Pans. Tide fills them, sun empties them, and Cobb counts what is left.',
      'Walk on the stone. The rest of this is creek with a skin of grass over it.',
    ],
  },
  {
    id: 'pallet-marsh-board',
    mapId: 'pallet-town',
    kind: 'sign',
    position: { x: 18, y: 68 },
    facing: 'left',
    dialogLines: [
      'THE SALTINGS - two creeks, one ford each',
      'The tide comes up both of them. What looks like a way over is a way in.',
      'South for the strand and THE HARD. East for the brook and the meadows.',
    ],
  },
  {
    id: 'pallet-marsh-fowler',
    mapId: 'pallet-town',
    kind: 'npc',
    position: { x: 12, y: 71 },
    facing: 'down',
    design: 'hiker',
    dialogLines: [
      'Everything on this marsh is here for the same reason I am.',
      'Sand starts under you. Groynes run down it - you go round them, not over.',
    ],
  },
  {
    id: 'pallet-strand-board',
    mapId: 'pallet-town',
    kind: 'sign',
    position: { x: 4, y: 72 },
    facing: 'down',
    dialogLines: [
      'THE STRAND - west end',
      'The ribs in the sand were a Pallet boat. Nobody has moved her and nobody is going to.',
      'East along the tide line for THE HARD, and the ferry lies off it.',
    ],
  },
  {
    // In the glade off the ride's second turn, where the wood was last worked.
    id: 'pallet-wood-burner',
    mapId: 'pallet-town',
    kind: 'npc',
    position: { x: 48, y: 8 },
    facing: 'left',
    design: 'bald-man',
    dialogLines: [
      'Hearth is back west along the ride. That one is mine; this one blew down on its own.',
      'East and the ride runs out at the quarry gate. There is a track off the quarry that is not the way you came.',
    ],
  },
  {
    // In the rickyard, at the end of the meadow lane. The pound is the one
    // thing east of here and nobody walks to it by accident.
    id: 'pallet-rickyard-hand',
    mapId: 'pallet-town',
    kind: 'npc',
    position: { x: 31, y: 55 },
    facing: 'up',
    design: 'youngster',
    dialogLines: [
      'Hay comes down the Gate Lane and stops here.',
      'Spur east goes to the pound and nowhere else. If something has been shut in it, it is still in it.',
    ],
  },
  {
    // The top close of the old fields, where the drove comes off the hill.
    id: 'pallet-fields-gate-board',
    mapId: 'pallet-town',
    kind: 'sign',
    position: { x: 45, y: 47 },
    facing: 'left',
    dialogLines: [
      'CLOSES - one gate each, and mind which',
      'The drove comes in at the head of the lane. Everything below is walled.',
      'THE LIME ROAD is back up the drove; the sea is down the lane.',
    ],
  },
  {
    // The foot of the old fields, above the neck of the headland.
    id: 'pallet-fold-keeper',
    mapId: 'pallet-town',
    kind: 'npc',
    position: { x: 59, y: 62 },
    facing: 'left',
    design: 'woman',
    dialogLines: [
      'Bottom close. The fold is still standing and the sheep are not.',
      'Lane goes on south to the NESS. That is as far as anybody gets.',
    ],
  },
  {
    // The allotments were the second-thinnest ground on the map: a whole band
    // of dug rows between the millpond and the gate road with nobody working
    // them. She is what the rows are for, and she points at both crossings.
    id: 'pallet-allotment-holder',
    mapId: 'pallet-town',
    kind: 'npc',
    position: { x: 18, y: 22 },
    facing: 'down',
    design: 'old-woman',
    dialogLines: [
      'Forty years on this plot and the flood has had it twice.',
      'Rows run down to the leat. Stepping stones at the end of this one, the bridge two along.',
      'North of me is the NORTH FIELD, and nothing north of that but grass.',
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
    // Three notices in the three places the density measure calls thinnest -
    // the paddocks, the steading's yard and the old pound. The measure is the
    // one Viridian Forest set: walking steps from anywhere to the nearest
    // permanent authored thing, loot excluded because it moves every raid.
    id: 'route-1-drove-notice',
    mapId: 'route-1',
    kind: 'sign',
    position: { x: 48, y: 19 },
    facing: 'right',
    dialogLines: [
      'THE DROVE - keep the gates shut',
      'Two fields off this lane and a third below. The far one has the trough in it.',
      'ORCHARDIST NELL works the narrows further down. She will want something off you.',
    ],
  },
  {
    id: 'route-1-steading-notice',
    mapId: 'route-1',
    kind: 'sign',
    position: { x: 46, y: 39 },
    facing: 'right',
    dialogLines: [
      'THE STEADING',
      'Gate out the back of the yard. The track west joins the OLD ROAD; the track south drops to the stepping stones.',
      'Over the stones is the CHARCOAL BURN, and the cart road out of it is shut until the kiln is drawn.',
    ],
  },
  {
    id: 'route-1-pound-notice',
    mapId: 'route-1',
    kind: 'sign',
    position: { x: 21, y: 37 },
    facing: 'down',
    dialogLines: [
      'THE POUND - strays held here',
      'Nothing has been claimed out of this pen in years. Whatever is in it now let itself in.',
      'The ford is south on the OLD ROAD. Mind who is sitting on it.',
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
  // The ground the map grew into. Every one of these stands where a player
  // first arrives in a place, and every one of them names somewhere they
  // cannot get to yet - which is the whole of what this map is for.
  {
    id: 'floodplain-quarry-board',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 70, y: 11 },
    facing: 'down',
    dialogLines: [
      'THE QUARRY - TOP BENCH',
      'Everything you can see under this face came out of it: the keep, the gatehouse, the causeway, the quay.',
      'FOREMAN RUDD has the incline, and the incline is the only way down. The road out is east along the bench.',
    ],
  },
  {
    id: 'floodplain-kilns-notice',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 104, y: 13 },
    facing: 'down',
    dialogLines: [
      'THE KILNS - draw kilns, six, cold',
      'The tramway runs back west to the quarry. The drove runs south down the cut, and the cut is culverted twice and nowhere else.',
      'Follow it far enough and you come out on the sea wall. Nobody has been past that in a year.',
    ],
  },
  {
    id: 'floodplain-drove-notice',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 12, y: 65 },
    facing: 'down',
    dialogLines: [
      'THE SALTINGS - grazing, and the drove through it',
      'Every creek on this marsh is crossed in one place. Keep to the drove and you will find them; leave it and you will not.',
      'The wharf is at the end of it. The DROVE GATE is west, and it is always open.',
    ],
  },
  {
    id: 'floodplain-staithe-notice',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 22, y: 102 },
    facing: 'down',
    dialogLines: [
      'THE STAITHE - the last wharf on the river',
      'The crane has been barred since the flood. Swing it and the old STAITHE STEPS at the top of the lanes come clear.',
      'The hard in the quay wall goes down onto the sands. It is barred from the far side, and the far side is the breach.',
    ],
  },
  {
    id: 'floodplain-wall-notice',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 96, y: 104 },
    facing: 'down',
    dialogLines: [
      'THE SEA WALL - do not walk the crest',
      'There is a gap in it nine rods wide and the tide still comes through. Everything behind you was dry land before that.',
      'BANKSMAN NYE has the stile. Past him the crest runs west to the breach, and the sands run west from there to the wharf.',
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
