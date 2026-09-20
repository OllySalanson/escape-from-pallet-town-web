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
    position: { x: 76, y: 11 },
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
    position: { x: 25, y: 100 },
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
  // The country the map grew into. Every one of these stands where the walk
  // was longest from anything anybody had authored - measured, not guessed -
  // because ground a player crosses for eighty steps without meeting a name is
  // ground they will describe as "more of it". Most are notices, because a
  // notice costs a raid nothing and tells it where it is; the rest are people,
  // because a drowned parish with nobody left in it still has somebody in it.
  {
    id: 'floodplain-hundred-boundary',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 33, y: 64 },
    facing: 'down',
    dialogLines: [
      'HUNDRED BOUNDARY - a stone in a hedge bank',
      'Everything south and east of this stone was fields. The hedges you are walking on are the tops of the banks between them.',
      'Keep to the gateways. There is one in each bank and there was never more than one.',
    ],
  },
  {
    id: 'floodplain-hundred-fowler',
    mapId: 'floodplain-relay',
    kind: 'npc',
    position: { x: 40, y: 69 },
    facing: 'down',
    design: 'old-man',
    dialogLines: [
      'There is nothing to shoot any more. I come out for the walk.',
      'Every field in this parish had a name. Nobody left knows them.',
    ],
  },
  {
    id: 'floodplain-hundred-names',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 33, y: 78 },
    facing: 'right',
    dialogLines: [
      'THE FIELD NAMES - cut into a gatepost',
      'LONG ACRE. HANGING PIECE. THE SIXTEENS. BROAD MEAD. HUNGER HILL.',
      'The water took them in a night and a day.',
    ],
  },
  {
    id: 'floodplain-hundred-flood-mark',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 37, y: 86 },
    facing: 'down',
    dialogLines: [
      'FLOOD MARK - a notch and a date',
      'The notch is a foot over your head. That was the night the wall went.',
      'Nobody has cut a second one, because nobody has come back to cut it.',
    ],
  },
  {
    id: 'floodplain-hundred-finger',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 47, y: 64 },
    facing: 'down',
    dialogLines: [
      'FINGER POST - three arms, two of them down',
      'The arm still up points east: TO THE BEDS.',
      'The others are in the water at the foot of it, face down.',
    ],
  },
  {
    id: 'floodplain-hundred-reeve',
    mapId: 'floodplain-relay',
    kind: 'npc',
    position: { x: 58, y: 68 },
    facing: 'left',
    design: 'heavy-man',
    dialogLines: [
      'I was the drainage reeve. I kept a book of every bank in this hundred.',
      'The book is dry and the hundred is not. Go and see the breach if you want to know why.',
    ],
  },
  {
    id: 'floodplain-hundred-cross',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 55, y: 78 },
    facing: 'down',
    dialogLines: [
      'A CHURCHYARD CROSS - standing in a field',
      'It is not in the churchyard. The water moved it, and nobody has moved it back.',
    ],
  },
  {
    id: 'floodplain-hundred-pound',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 58, y: 87 },
    facing: 'left',
    dialogLines: [
      'THE PARISH POUND - four banks and a gate',
      'Strayed beasts were shut in here until somebody paid for them.',
      'The gate is open and there is a foot of water in it.',
    ],
  },
  {
    id: 'floodplain-hundred-drover',
    mapId: 'floodplain-relay',
    kind: 'npc',
    position: { x: 47, y: 88 },
    facing: 'down',
    design: 'boy',
    dialogLines: [
      'Wading? You will want to go west of the pound, not east.',
      'East of it the bank is gone and there is nothing under you but the old ditch.',
    ],
  },
  {
    id: 'floodplain-withy-cutter',
    mapId: 'floodplain-relay',
    kind: 'npc',
    position: { x: 71, y: 91 },
    facing: 'up',
    design: 'straw-hat',
    dialogLines: [
      'Three year withy, this bed. Cut it now and it is baskets; leave it and it is firewood.',
      'Nobody has cut the far corner since the ride closed over. Take a blade to it if you have one.',
    ],
  },
  {
    id: 'floodplain-withy-tally',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 78, y: 86 },
    facing: 'down',
    dialogLines: [
      'THE TALLY BOARD - beds and their years',
      'ONE: cut. TWO: cut. THREE: standing. FOUR: standing. FIVE: gone over.',
      'The last hand on it was a year ago and the chalk has run.',
    ],
  },
  {
    id: 'floodplain-withy-frame',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 70, y: 80 },
    facing: 'left',
    dialogLines: [
      'A BUNDLING FRAME - two posts and a rail',
      'Withy is tied here before it goes on a cart. There is no cart.',
    ],
  },
  {
    id: 'floodplain-withy-lane',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 68, y: 70 },
    facing: 'down',
    dialogLines: [
      'THE BED LANES - ankle deep, all of them',
      'A bed is a wall you can see over and not walk through. The lanes between them are the only way across this ground.',
    ],
  },
  {
    id: 'floodplain-withy-hut',
    mapId: 'floodplain-relay',
    kind: 'npc',
    position: { x: 94, y: 72 },
    facing: 'left',
    design: 'lass',
    dialogLines: [
      'You are a long way in. The cut\'s east bank is over there and the culvert is north of you.',
      'If you came the other way you came past the warden, and I would not have.',
    ],
  },
  {
    id: 'floodplain-withy-stools',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 76, y: 74 },
    facing: 'down',
    dialogLines: [
      'CUT STOOLS - and what grows back from them',
      'A stool cut every third year lives a hundred. One left alone falls over in ten.',
    ],
  },
  {
    id: 'floodplain-withy-north',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 80, y: 66 },
    facing: 'up',
    dialogLines: [
      'THE BEDS - north gate',
      'The track behind you goes up through the wood to the cider yard, and that is the only dry way in.',
    ],
  },
  {
    id: 'floodplain-withy-eelman',
    mapId: 'floodplain-relay',
    kind: 'npc',
    position: { x: 87, y: 79 },
    facing: 'down',
    design: 'bald-man',
    dialogLines: [
      'Eels in the bed lanes, if you have the patience.',
      'The warden does not come down here and neither does anybody else.',
    ],
  },
  {
    id: 'floodplain-wall-workboard',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 82, y: 96 },
    facing: 'down',
    dialogLines: [
      'BANK WORK - notice to all hands',
      'Every man to the wall at the tide. Bring a spade and a hurdle.',
      'The notice is a year old. Nobody came.',
    ],
  },
  {
    id: 'floodplain-wall-mark',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 55, y: 99 },
    facing: 'down',
    dialogLines: [
      'SALT MARK - as far as the tide comes inland',
      'It is a mile behind the wall. That is what a hole in a wall is worth.',
    ],
  },
  {
    id: 'floodplain-wall-boy',
    mapId: 'floodplain-relay',
    kind: 'npc',
    position: { x: 64, y: 96 },
    facing: 'down',
    design: 'youngster',
    dialogLines: [
      'Do not go on the crest without the banksman. He will know.',
      'And do not go through the gap at all. The tide comes through it faster than you walk.',
    ],
  },
  {
    id: 'floodplain-wall-stone',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 45, y: 109 },
    facing: 'right',
    dialogLines: [
      'A GROYNE HEAD - set in the crest',
      'One every twenty rods, all the way east to the light. They are what hold the bank together when the sea leans on it.',
    ],
  },
  {
    id: 'floodplain-breach-notice',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 65, y: 109 },
    facing: 'down',
    dialogLines: [
      'THE BREACH',
      'Nine rods of wall, gone in one night. Everything you have walked across since the town was dry land before it.',
    ],
  },
  {
    id: 'floodplain-muds-perch',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 104, y: 122 },
    facing: 'left',
    dialogLines: [
      'A PERCH - a withy bundle on a pole',
      'One at the head of every gutway. Follow them and you cross the sands; ignore them and you do not.',
    ],
  },
  {
    id: 'floodplain-muds-pilot',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 100, y: 112 },
    facing: 'down',
    dialogLines: [
      'PILOT MARK - line it up with the light',
      'Keep the mark on the light and you are in the channel. There is nothing in the channel for you.',
    ],
  },
  {
    id: 'floodplain-muds-fowler',
    mapId: 'floodplain-relay',
    kind: 'npc',
    position: { x: 94, y: 118 },
    facing: 'left',
    design: 'old-woman',
    dialogLines: [
      'Two hours you have, either side of low water. I have counted them since I was a girl.',
      'The hard is west of here, under the wharf wall. That is your way off.',
    ],
  },
  {
    id: 'floodplain-muds-bell',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 78, y: 121 },
    facing: 'down',
    dialogLines: [
      'A BELL BUOY - lying on the sand',
      'It rang on every tide until the flood put it here. It has not rung since.',
    ],
  },
  {
    id: 'floodplain-muds-anchor',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 70, y: 121 },
    facing: 'down',
    dialogLines: [
      'AN ANCHOR - fluke up, in four feet of sand',
      'Whatever it held is not here any more.',
    ],
  },
  {
    id: 'floodplain-muds-stakes',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 88, y: 112 },
    facing: 'up',
    dialogLines: [
      'EEL STAKES - a line of them across the bank',
      'They were a fence with nets on it, once a tide.',
    ],
  },
  {
    id: 'floodplain-muds-ridge',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 60, y: 116 },
    facing: 'down',
    dialogLines: [
      'THE HARD SAND - and where it stops',
      'What is ribbed underfoot will hold you. What is smooth is where the water still runs.',
    ],
  },
  {
    id: 'floodplain-muds-post',
    mapId: 'floodplain-relay',
    kind: 'npc',
    position: { x: 49, y: 122 },
    facing: 'right',
    design: 'woman',
    dialogLines: [
      'Walking to the wharf? Keep two bars north of me and you will not get wet.',
      'Walking to the breach? You had better be quick.',
    ],
  },
  {
    id: 'floodplain-levels-milestone-north',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 123, y: 36 },
    facing: 'left',
    dialogLines: [
      'A MILESTONE - on the drove',
      'THE KILNS 1. THE WALL 5.',
      'The drove is the only quick road on this side of the river, and every step off it is fen.',
    ],
  },
  {
    id: 'floodplain-levels-floodgate',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 121, y: 46 },
    facing: 'down',
    dialogLines: [
      'A FLOOD GATE - shut, and welded shut by rust',
      'It let the fen off the fields into the cut. It does not any more, which is why the fields are fen.',
    ],
  },
  {
    id: 'floodplain-levels-lengthsman-hut',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 112, y: 37 },
    facing: 'down',
    dialogLines: [
      'THE LENGTHSMAN\'S HUT - one room, one stove',
      'A length is two miles of bank and one man. There were eleven of them on this cut.',
    ],
  },
  {
    id: 'floodplain-levels-milestone-south',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 121, y: 79 },
    facing: 'left',
    dialogLines: [
      'A MILESTONE - on the drove',
      'THE KILNS 4. THE WALL 2.',
    ],
  },
  {
    id: 'floodplain-levels-engine-notice',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 124, y: 90 },
    facing: 'left',
    dialogLines: [
      'THE ENGINE - notice of steam',
      'Fire at four, steam at six, pumping by seven. Every day of the year but one.',
      'The fire has been out for a year.',
    ],
  },
  {
    id: 'floodplain-levels-fenman',
    mapId: 'floodplain-relay',
    kind: 'npc',
    position: { x: 116, y: 86 },
    facing: 'down',
    design: 'scientist',
    dialogLines: [
      'Keep to the drove. The drains are deeper than they look and they all look the same.',
      'The wall road is at the bottom of it, and the light is at the end of that.',
    ],
  },
  {
    id: 'floodplain-kilns-weighbridge',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 120, y: 26 },
    facing: 'down',
    dialogLines: [
      'THE WEIGHBRIDGE - lime out, coal in',
      'Every cart that left this heath was weighed here. The plate is still under your feet.',
    ],
  },
  {
    id: 'floodplain-beck-stones',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 67, y: 22 },
    facing: 'down',
    dialogLines: [
      'STEPPING STONES - washed out',
      'The beck ran under them once. Now it runs over them, and the way round is east, past the adit.',
    ],
  },
  {
    id: 'floodplain-beck-burner',
    mapId: 'floodplain-relay',
    kind: 'npc',
    position: { x: 82, y: 30 },
    facing: 'up',
    design: 'hiker',
    dialogLines: [
      'Charcoal, when there was a kiln to burn it for.',
      'The level through the hill comes out above you. I would not go into it without the foreman.',
    ],
  },
  {
    id: 'floodplain-cider-heap',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 85, y: 56 },
    facing: 'down',
    dialogLines: [
      'THE POMACE HEAP - and what it is for',
      'Pressed apple, spread on the rows it came off. Two years and it is soil again.',
    ],
  },
  {
    id: 'floodplain-cider-rows',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 88, y: 47 },
    facing: 'up',
    dialogLines: [
      'THE OLD STANDARDS - planted long before the warden',
      'Wide, so a cart goes between them and a man goes round them. The warden\'s rows are planted close, and that is how you tell the two apart.',
    ],
  },
  {
    id: 'floodplain-saltings-wash',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 27, y: 88 },
    facing: 'down',
    dialogLines: [
      'THE SHEEP WASH - a creek dammed at both ends',
      'Every fleece on this marsh came through it in June.',
    ],
  },
  {
    id: 'floodplain-levels-fieldnumber-north',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 124, y: 40 },
    facing: 'left',
    dialogLines: [
      'FIELD 14 - a numbered post at the head of a drain',
      'Every field on these levels has a number and no name. That is what a drained fen is.',
    ],
  },
  {
    id: 'floodplain-levels-wildfowler',
    mapId: 'floodplain-relay',
    kind: 'npc',
    position: { x: 113, y: 41 },
    facing: 'down',
    design: 'old-man',
    dialogLines: [
      'Snipe, in the wet fields. Harriers over them, if you stand still.',
      'Half of this was corn before the engine stopped.',
    ],
  },
  {
    id: 'floodplain-levels-bank-notice',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 124, y: 52 },
    facing: 'left',
    dialogLines: [
      'BANK ORDER - no beast to be tethered on the drove',
      'The bank is the road and the road is the bank. Cut one and you lose both.',
    ],
  },
  {
    id: 'floodplain-levels-plank',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 117, y: 57 },
    facing: 'down',
    dialogLines: [
      'A PLANK BRIDGE - one board, no rail',
      'The only way over this drain for half a mile in either direction.',
    ],
  },
  {
    id: 'floodplain-levels-field-south',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 124, y: 66 },
    facing: 'left',
    dialogLines: [
      'FIELD 31 - and the drain that drowned it',
      'It was wheat. It is fen. There is no third thing it can be.',
    ],
  },
  {
    id: 'floodplain-levels-cutside',
    mapId: 'floodplain-relay',
    kind: 'npc',
    position: { x: 117, y: 73 },
    facing: 'left',
    design: 'boy',
    dialogLines: [
      'You can see the light from the top of the bank on a clear day.',
      'Keep going south. There is nothing off the drove but water and reed.',
    ],
  },
  {
    id: 'floodplain-levels-eel-house',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 124, y: 78 },
    facing: 'left',
    dialogLines: [
      'THE EEL HOUSE - a hut over a trap in the cut',
      'Eels ran down this drain to the sea every autumn and stopped here on the way.',
    ],
  },
  {
    id: 'floodplain-levels-sluice',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 122, y: 94 },
    facing: 'left',
    dialogLines: [
      'THE OUTFALL SLUICE - where the cut meets the wall',
      'Shut on a rising tide, open on a falling one. Somebody turned it twice a day for forty years.',
    ],
  },
  {
    id: 'floodplain-levels-wallhead',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 109, y: 95 },
    facing: 'down',
    dialogLines: [
      'THE WALL ROAD - east to the pier, west to the stile',
      'The crest is the only dry road along the bottom of this map, and the banksman has the stile.',
    ],
  },
  {
    id: 'floodplain-levels-barnpost',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 107, y: 78 },
    facing: 'left',
    dialogLines: [
      'A BARN POST - and nothing else left of the barn',
      'The fen took the rest of it a board at a time.',
    ],
  },
  {
    id: 'floodplain-kilns-coalyard',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 121, y: 19 },
    facing: 'down',
    dialogLines: [
      'THE COAL YARD - five hundred ton, and empty',
      'The kilns ate coal by the cart and the carts came up the drove.',
    ],
  },
  {
    id: 'floodplain-kilns-quarryman',
    mapId: 'floodplain-relay',
    kind: 'npc',
    position: { x: 109, y: 18 },
    facing: 'down',
    design: 'heavy-man',
    dialogLines: [
      'Burnt lime for the whole hundred, we did. Walls, mortar, fields, all of it.',
      'The tramway runs back west to the workings. Mind the incline - the foreman has it.',
    ],
  },
  {
    id: 'floodplain-kilns-heathstone',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 125, y: 27 },
    facing: 'left',
    dialogLines: [
      'A BOUNDARY STONE - the edge of the heath',
      'Past it there is nothing but the drove and the cut, all the way to the sea.',
    ],
  },
  {
    id: 'floodplain-staithe-gauge',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 2, y: 104 },
    facing: 'right',
    dialogLines: [
      'THE TIDE GAUGE - painted on the quay wall',
      'The top figure is the night of the flood. It is above the roofs behind you.',
    ],
  },
  {
    id: 'floodplain-muds-westperch',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 6, y: 122 },
    facing: 'right',
    dialogLines: [
      'THE LAST PERCH - west end of the sands',
      'The wharf is behind you and the hard is in the wall. There is nothing further west than this.',
    ],
  },
  {
    id: 'floodplain-withy-westgate',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 61, y: 70 },
    facing: 'left',
    dialogLines: [
      'THE BEDS - west gate',
      'The hundred is through the bank behind you, and it is one gateway wide.',
    ],
  },
  {
    id: 'floodplain-levels-gaugeboard',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 123, y: 49 },
    facing: 'left',
    dialogLines: [
      'A GAUGE BOARD - feet above the outfall',
      'The fen is below the sea for most of the year. That is the whole trick, and the engine was how it was done.',
    ],
  },
  {
    id: 'floodplain-levels-dolestone',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 123, y: 61 },
    facing: 'left',
    dialogLines: [
      'A DOLE STONE - where one man\'s length ended and the next began',
      'Two miles of bank each, and they knew every yard of it by the feel of a spade.',
    ],
  },
  {
    id: 'floodplain-kilns-tramhead',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 124, y: 28 },
    facing: 'left',
    dialogLines: [
      'THE TRAM HEAD - end of the line',
      'Trucks came out of the workings by gravity and went back up on a horse.',
    ],
  },
  {
    id: 'floodplain-kilns-burnerboy',
    mapId: 'floodplain-relay',
    kind: 'npc',
    position: { x: 99, y: 21 },
    facing: 'down',
    design: 'youngster',
    dialogLines: [
      'Six kilns, drawn every morning, hot the whole year.',
      'You can see the keep from the bank top, and the sea from the yard.',
    ],
  },
  {
    id: 'floodplain-staithe-lodging',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 4, y: 97 },
    facing: 'down',
    dialogLines: [
      'THE BARGEMEN\'S LODGING - beds by the night',
      'Full on a Friday, once. The door is off and the beds are not.',
    ],
  },
  {
    id: 'floodplain-staithe-limeman',
    mapId: 'floodplain-relay',
    kind: 'npc',
    position: { x: 2, y: 107 },
    facing: 'right',
    design: 'old-woman',
    dialogLines: [
      'The kiln at the end of the lane burned lime off the heath, brought down the cut.',
      'Nothing comes down the cut now.',
    ],
  },
  {
    id: 'floodplain-wall-lookout',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 85, y: 97 },
    facing: 'down',
    dialogLines: [
      'A LOOKOUT STAGE - three steps and a rail',
      'From the top you can see over the wall to the sands, and over the lagoon to the hundred.',
    ],
  },
  {
    id: 'floodplain-muds-eastperch',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 48, y: 112 },
    facing: 'up',
    dialogLines: [
      'A PERCH - and the gutway it stands at the head of',
      'The bank either side of it will hold you. The gutway will not.',
    ],
  },
  {
    id: 'floodplain-saltings-penfold',
    mapId: 'floodplain-relay',
    kind: 'npc',
    position: { x: 29, y: 74 },
    facing: 'left',
    design: 'straw-hat',
    dialogLines: [
      'Three hundred head on this marsh in a good year.',
      'The drove is the only way through, and every creek is crossed in one place.',
    ],
  },
  {
    id: 'floodplain-saltings-creekmark',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 2, y: 82 },
    facing: 'right',
    dialogLines: [
      'A CREEK MARK - a stake and a bundle of reed',
      'One at every crossing. Where there is no stake there is no crossing.',
    ],
  },
  {
    id: 'floodplain-muds-lowwater',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 6, y: 115 },
    facing: 'right',
    dialogLines: [
      'LOW WATER - and what it means for you',
      'Two hours each side of it. The sands are a road for four hours a tide and a sea for eight.',
    ],
  },
  {
    id: 'floodplain-beck-adit-notice',
    mapId: 'floodplain-relay',
    kind: 'sign',
    position: { x: 71, y: 26 },
    facing: 'down',
    dialogLines: [
      'THE LEVEL - no man to enter alone',
      'Six tiles of dark under the hill, and the quarry floor at the far end of it.',
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
