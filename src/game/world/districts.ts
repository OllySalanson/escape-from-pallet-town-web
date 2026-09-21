import type { GridPosition } from '../movement/gridMovement';
import type { WorldMapId } from '../worldMap';
import * as wildlife from '../pokemon/encounters';
import type { WildEncounterTable } from '../pokemon/encounters';
import { WEATHER_CONDITIONS, WeatherId } from '../pokemon/battle/weather';

/**
 * The named parts of a map big enough to have them.
 *
 * A vast map is remembered as places, and a place nobody names is remembered as
 * "the bit with the two barns". Every exit, gate and landmark on the Floodplain
 * already said its own name on its caption, and a stranger who toured it once
 * could place all of them - and still drew Old Town as two unrelated spots,
 * because nothing a player stands near ever said "Old Town". The games this one
 * is dressed as answer that with a plate that names a place as you walk into
 * it; this is the data that plate reads (`WorldScene` shows it, `raidHud.ts`
 * decides for how long).
 *
 * A district is one or more rectangles of tiles, corners included. Where two
 * overlap the first listed wins, so a boundary is drawn once, by order. They
 * are rectangles on purpose: a district is a part of the map, not a flood fill,
 * and the lanes between two places have to belong to one of them.
 * `districts.test.ts` holds that no walkable tile of a districted map is
 * nameless, and that every exit, landmark and drop-in stands somewhere named.
 */
export interface DistrictArea {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface MapDistrict {
  readonly id: string;
  readonly mapId: WorldMapId;
  readonly name: string;
  readonly areas: readonly DistrictArea[];
  /**
   * What the tall grass here holds, written beside the place it is in. A
   * district with none rolls on its map's fallback table.
   */
  readonly encounters?: WildEncounterTable;
  /**
   * The weather every fight in this place is fought in. It carries no duration
   * because it is not an event: it is the reason the place looks the way it
   * does, and it is still doing it when you come back.
   *
   * Only `WEATHER_WITHOUT_A_CHIP` may be authored here, and that is a measured
   * rule rather than a taste - see `PLACE_WEATHER` below and
   * `tools/weather/measure.mts` for the numbers.
   */
  readonly weather?: WeatherId;
}

/**
 * Why a place may bend damage but may never chip HP.
 *
 * Weather takes a sixteenth of maximum HP a turn, with a floor of one, and at
 * the levels this game is played at the floor is what binds: everything on both
 * sides has under 80 HP, so a sandstorm is a **flat one HP a turn to everyone**.
 * A flat charge is not neutral - it is paid by whoever has the fewest Pokemon,
 * and in the fight that decides a raid that is always the player. Measured over
 * the real engine (`tools/weather/measure.mts --hunter`, 300 fights a cell), a
 * sandstorm *helps* the party at the bottom of the hunter ladder (rung 2, 94% ->
 * 99%) and destroys it at the top (rung 4, four Pokemon against three: 49% ->
 * 17%, and the health kept on a win 19% -> 9%). The hunter arrives wherever the
 * player happens to be standing, so a chipping district would silently reprice
 * the one fight a raid cannot decline, by a factor of three, with nothing said
 * about it on the deployment screen - and `hunterThreatFor` promises that the
 * hunter is priced by the party deployed against it and by nothing else.
 *
 * Rain and harsh sunlight have no chip at all. They bend Fire and Water, which
 * is a cost the player can read off the HUD chip, lead a different Pokemon
 * into, or walk out of - a district is a place you can leave. Of the two, only
 * rain is authored: harsh sunlight measured as a 14-point *gift* on the top rung
 * (49% -> 63%) against rain's 10-point cost (49% -> 39%), because the hunter's
 * team carries no Water and the player's Fire starter does. A place that makes
 * the hardest fight in the game easier is not a place with weather in it.
 *
 * What rain is worth is measured with the lead using its own signature move
 * (`measure.mts --lead`), because the shared harness scores a move by power
 * times effectiveness and cannot see the same-type bonus - through it a Squirtle
 * answers a Pidgey with Tackle, and a fight with no Water move in it is a fight
 * rain cannot touch. Played honestly, a Water lead comes out of these places
 * with 94% of its health against 82% clear and wins Brook Head 77% against 69%;
 * a Fire lead pays for it, 70% against 90% and 44% against 88%; a Grass lead is
 * untouched. That is the whole of what a rainy place is: the type the place is
 * about is worth more in it, and the type it is not is worth less.
 *
 * Sandstorm and hail therefore ship as engine rules with no place that has them,
 * reachable only by a move. That is not a gap: no Kanto species learns either by
 * level in FireRed/LeafGreen, and a map that wants one - a desert, an ice cave -
 * is free to author it once the hunter ladder has been re-measured under it.
 */
export const WEATHER_WITHOUT_A_CHIP: readonly WeatherId[] = Object.values(WeatherId).filter(
  (weather) => WEATHER_CONDITIONS[weather].chipFraction === 0,
);

export const MAP_DISTRICTS: readonly MapDistrict[] = [
  {
    id: 'floodplain-landing',
    mapId: 'floodplain-relay',
    name: 'THE LANDING',
    areas: [{ x: 0, y: 0, width: 40, height: 14 }],
  },
  {
    id: 'floodplain-beacon-keep',
    mapId: 'floodplain-relay',
    name: 'BEACON KEEP',
    // The keep, its causeway across the north reach, and the gatehouse road
    // down to the race: the sluice gate is the keep's door, so it is the keep.
    areas: [{ x: 40, y: 0, width: 24, height: 20 }],
  },
  {
    // The bar in the great reach, and the two rows of water that are the only
    // way onto it. Listed before MARKET ISLE, whose river it is standing in:
    // the isle's rectangle reaches down over the whole reach, and the shoal is
    // a place of its own the moment anybody can stand on it.
    id: 'floodplain-shoal',
    mapId: 'floodplain-relay',
    name: 'THE SHOAL',
    encounters: wildlife.FLOODPLAIN_SHOAL_WILDLIFE,
    areas: [{ x: 22, y: 43, width: 10, height: 4 }],
  },
  {
    id: 'floodplain-market-isle',
    mapId: 'floodplain-relay',
    name: 'MARKET ISLE',
    // Inside the ring of river, both bridges and the fords that leave it.
    areas: [{ x: 19, y: 28, width: 22, height: 19 }],
  },
  {
    id: 'floodplain-reedbeds',
    mapId: 'floodplain-relay',
    name: 'THE REEDBEDS',
    encounters: wildlife.FLOODPLAIN_REED_WILDLIFE,
    // The reeds are the way round the checkpoint, and the flooded cut through
    // them is why they are reeds. The reeds hold Squirtles, and in the rain
    // they are the wrong place to bring a Fire lead: 70% of its health out
    // against 90% on a dry day. It costs the checkpoint fight nothing, measured
    // - Maya fields Electric and Normal/Flying, and rain touches neither.
    weather: WeatherId.Rain,
    areas: [{ x: 0, y: 14, width: 27, height: 15 }],
  },
  {
    id: 'floodplain-old-town',
    mapId: 'floodplain-relay',
    name: 'OLD TOWN',
    encounters: wildlife.FLOODPLAIN_TOWN_WILDLIFE,
    // The street, the chapel, the last house and the road down to the gate:
    // one town, however much wood has grown up between its pieces.
    areas: [{ x: 0, y: 29, width: 30, height: 35 }],
  },
  {
    // Listed before MILL WEIR, whose rectangle reaches over the head of the
    // cleft: everything in the cleft is the beck's, including the pond's east
    // end and the track the mill's own yard lets out onto.
    id: 'floodplain-hollow-beck',
    mapId: 'floodplain-relay',
    name: 'HOLLOW BECK',
    encounters: wildlife.FLOODPLAIN_BECK_WILDLIFE,
    areas: [{ x: 57, y: 20, width: 40, height: 14 }],
  },
  {
    id: 'floodplain-mill-weir',
    mapId: 'floodplain-relay',
    name: 'MILL WEIR',
    // From the far end of the toll bridge: the toll road, the towpath, the mill
    // - and the mill's own doorstep, which is a row south of the rest of it.
    areas: [
      { x: 27, y: 14, width: 37, height: 15 },
      { x: 47, y: 29, width: 17, height: 1 },
    ],
  },
  // -- and the ground it grew into -------------------------------------------
  // East of the keep and the orchard, and south of the town, on the same rule
  // the first nine were drawn to: a place is one or more rectangles, the first
  // listed wins an overlap, and a boundary at a crossing is the far step.
  {
    id: 'floodplain-quarry',
    mapId: 'floodplain-relay',
    name: 'THE QUARRY',
    // No tall grass anywhere in it: it is bare rock, gravel and water, which
    // is the one thing this map has nothing else of.
    areas: [{ x: 64, y: 0, width: 33, height: 20 }],
  },
  {
    id: 'floodplain-kilns',
    mapId: 'floodplain-relay',
    name: 'THE KILNS',
    encounters: wildlife.FLOODPLAIN_HEATH_WILDLIFE,
    areas: [{ x: 97, y: 0, width: 31, height: 32 }],
  },
  {
    id: 'floodplain-cider-yard',
    mapId: 'floodplain-relay',
    name: 'THE CIDER YARD',
    encounters: wildlife.FLOODPLAIN_ORCHARD_WILDLIFE,
    areas: [{ x: 57, y: 34, width: 40, height: 30 }],
  },
  {
    id: 'floodplain-levels',
    mapId: 'floodplain-relay',
    name: 'THE LEVELS',
    encounters: wildlife.FLOODPLAIN_FEN_WILDLIFE,
    areas: [{ x: 97, y: 32, width: 31, height: 66 }],
  },
  {
    id: 'floodplain-staithe',
    mapId: 'floodplain-relay',
    name: 'THE STAITHE',
    // Paving, stone and the quay: the one place south of the river anybody
    // built anything, and the only new ground with no tall grass on it at all.
    // Listed before THE SALTINGS, which the marsh road comes down out of: the
    // wharf starts at the foot of its own steps, and a boundary at a crossing
    // is the far step.
    areas: [
      { x: 29, y: 92, width: 14, height: 4 },
      { x: 0, y: 96, width: 43, height: 16 },
    ],
  },
  {
    id: 'floodplain-saltings',
    mapId: 'floodplain-relay',
    name: 'THE SALTINGS',
    encounters: wildlife.FLOODPLAIN_MARSH_WILDLIFE,
    areas: [{ x: 0, y: 64, width: 33, height: 32 }],
  },
  {
    id: 'floodplain-hundred',
    mapId: 'floodplain-relay',
    name: 'THE DROWNED HUNDRED',
    encounters: wildlife.FLOODPLAIN_MARSH_WILDLIFE,
    areas: [{ x: 33, y: 64, width: 28, height: 32 }],
  },
  {
    id: 'floodplain-withy-beds',
    mapId: 'floodplain-relay',
    name: 'THE WITHY BEDS',
    encounters: wildlife.FLOODPLAIN_FEN_WILDLIFE,
    areas: [{ x: 61, y: 64, width: 36, height: 32 }],
  },
  {
    // Listed before THE SEA WALL, out of whose rectangle it is cut: the gap
    // and the water behind it are a place of their own the moment anybody can
    // stand in them, and it is the one a player will remember.
    id: 'floodplain-breach',
    mapId: 'floodplain-relay',
    name: 'THE BREACH',
    areas: [{ x: 58, y: 98, width: 33, height: 14 }],
  },
  {
    id: 'floodplain-sea-wall',
    mapId: 'floodplain-relay',
    name: 'THE SEA WALL',
    encounters: wildlife.FLOODPLAIN_MARSH_WILDLIFE,
    areas: [{ x: 43, y: 96, width: 62, height: 16 }],
  },
  {
    id: 'floodplain-muds',
    mapId: 'floodplain-relay',
    name: 'THE MUDS',
    // Sand and salt water: nothing grows on it, so nothing lives in it.
    areas: [{ x: 0, y: 112, width: 105, height: 16 }],
  },
  {
    id: 'floodplain-light',
    mapId: 'floodplain-relay',
    name: 'THE LIGHT',
    encounters: wildlife.FLOODPLAIN_HEATH_WILDLIFE,
    areas: [{ x: 105, y: 96, width: 23, height: 32 }],
  },

  {
    id: 'floodplain-orchard',
    mapId: 'floodplain-relay',
    name: 'THE ORCHARD',
    areas: [{ x: 41, y: 29, width: 23, height: 17 }],
  },
  {
    id: 'floodplain-vault',
    mapId: 'floodplain-relay',
    name: 'THE VAULT',
    encounters: wildlife.FLOODPLAIN_VAULT_WILDLIFE,
    areas: [{ x: 30, y: 46, width: 34, height: 18 }],
  },

  // -- Pallet Town -----------------------------------------------------------
  // A small map, so its places are small: a plate every dozen steps is right
  // for a town, where it would be noise on the Floodplain. The leat is the one
  // boundary that matters, and its crossings belong to the north bank: the
  // south is named on the far step of the bridge, where the south bank starts.
  // The water used to belong to the bank it landed you on, so THE STOCKYARD
  // went up on the bridge head with three quarters of the screen still the
  // allotments - and a stranger learned that name for the hut band.
  {
    id: 'pallet-market-square',
    mapId: 'pallet-town',
    name: 'MARKET SQUARE',
    areas: [{ x: 0, y: 0, width: 16, height: 13 }],
  },
  {
    id: 'pallet-north-field',
    mapId: 'pallet-town',
    name: 'THE NORTH FIELD',
    encounters: wildlife.PALLET_FIELD_WILDLIFE,
    areas: [{ x: 16, y: 0, width: 16, height: 11 }],
  },
  {
    // Behind the pond, and behind Miller Vance's two doors: the towpath from the
    // head of it down to the sluice apron, with the Mill Stair cut in the rock
    // half way along. Listed before THE MILLPOND, whose east side it is taken
    // out of, because a place a boss holds shut has to say its own name the
    // moment the door opens.
    id: 'pallet-far-bank',
    mapId: 'pallet-town',
    name: 'THE FAR BANK',
    // Down to the last step of the towpath: the apron below it is the
    // Stockyard's, because a boundary at a crossing is the far step.
    areas: [{ x: 26, y: 13, width: 6, height: 17 }],
  },
  {
    id: 'pallet-millpond',
    mapId: 'pallet-town',
    name: 'THE MILLPOND',
    // The mill, the pond and both its banks - and the far bank's path on down
    // past the stair to the head of the leat, which is the mill's own water.
    areas: [
      { x: 14, y: 11, width: 18, height: 8 },
      { x: 24, y: 19, width: 8, height: 11 },
    ],
  },
  {
    id: 'pallet-green',
    mapId: 'pallet-town',
    name: 'THE GREEN',
    areas: [{ x: 0, y: 13, width: 14, height: 6 }],
  },
  {
    id: 'pallet-allotments',
    mapId: 'pallet-town',
    name: 'THE ALLOTMENTS',
    encounters: wildlife.PALLET_ALLOTMENT_WILDLIFE,
    // Down to the leat's south lip: both fords and the bridge deck.
    areas: [{ x: 0, y: 19, width: 24, height: 11 }],
  },
  {
    id: 'pallet-flood',
    mapId: 'pallet-town',
    name: 'THE FLOOD',
    encounters: wildlife.PALLET_FLOOD_WILDLIFE,
    // The field the river took, and it has not stopped raining on it since.
    // Pallet's one water place, holding Pallet's one Water table.
    weather: WeatherId.Rain,
    areas: [{ x: 0, y: 30, width: 12, height: 14 }],
  },
  {
    id: 'pallet-stockyard',
    mapId: 'pallet-town',
    name: 'THE STOCKYARD',
    encounters: wildlife.PALLET_YARD_WILDLIFE,
    // The bridge foot, the paddocks, the sluice at the east end of the bank and
    // the road down to the South Gate: everything the bridge lands you in.
    areas: [{ x: 12, y: 30, width: 20, height: 14 }],
  },

  // -- Pallet Town: the valley above the town, and the valley below it -------
  // The town is the head of a parish that runs from the quarry in the east
  // hills down to the tide. Nothing here is named after the town: a player who
  // has walked to the kilns or the saltings has been somewhere else.
  {
    id: 'pallet-high-wood',
    mapId: 'pallet-town',
    name: 'THE HIGH WOOD',
    encounters: wildlife.PALLET_WOOD_WILDLIFE,
    // The ride out of the north field, the charcoal hearth off its first turn,
    // and the glade off its second.
    areas: [{ x: 32, y: 0, width: 32, height: 13 }],
  },
  {
    // Listed before the quarry and the hanger it is cut between, because the
    // first district listed wins an overlap and the delve is under both of
    // them. Its area is exactly its roof, so every tile the lid covers is
    // named THE DELVE and every tile outside it is the hillside it is in.
    id: 'pallet-delve',
    mapId: 'pallet-town',
    name: 'THE DELVE',
    encounters: wildlife.PALLET_DELVE_WILDLIFE,
    areas: [{ x: 44, y: 22, width: 10, height: 6 }],
  },
  {
    id: 'pallet-hanger',
    mapId: 'pallet-town',
    name: 'THE HANGER',
    encounters: wildlife.PALLET_WOOD_WILDLIFE,
    // The beech wood on the slope above the far bank, and the spring in it.
    areas: [{ x: 32, y: 13, width: 16, height: 15 }],
  },
  {
    id: 'pallet-quarry',
    mapId: 'pallet-town',
    name: 'THE QUARRY',
    // The stone the town is built of, its flooded pit, its adit and its track.
    areas: [{ x: 48, y: 11, width: 16, height: 20 }],
  },
  {
    id: 'pallet-drove',
    mapId: 'pallet-town',
    name: 'THE DROVE',
    // The walled road off the sluice apron, stepping east down the hill.
    areas: [{ x: 32, y: 28, width: 12, height: 18 }],
  },
  {
    id: 'pallet-kilns',
    mapId: 'pallet-town',
    name: 'THE KILNS',
    // The lime kilns cut into the foot of the quarry's rock.
    areas: [{ x: 44, y: 31, width: 20, height: 13 }],
  },
  {
    id: 'pallet-withy-beds',
    mapId: 'pallet-town',
    name: 'THE WITHY BEDS',
    encounters: wildlife.PALLET_MARSH_WILDLIFE,
    // Osier cut in wet plots below the Flood, with a causeway through them.
    areas: [{ x: 0, y: 44, width: 17, height: 20 }],
  },
  {
    id: 'pallet-water-meadows',
    mapId: 'pallet-town',
    name: 'THE WATER MEADOWS',
    encounters: wildlife.PALLET_MEADOW_WILDLIFE,
    // The hay closes off the Gate Lane, the rickyard, and the brook's head.
    areas: [{ x: 17, y: 44, width: 19, height: 20 }],
  },
  {
    id: 'pallet-old-fields',
    mapId: 'pallet-town',
    name: 'THE OLD FIELDS',
    encounters: wildlife.PALLET_MEADOW_WILDLIFE,
    // Small closes nobody has ploughed since the flood, off a green lane.
    areas: [{ x: 36, y: 44, width: 28, height: 22 }],
  },
  {
    id: 'pallet-saltings',
    mapId: 'pallet-town',
    name: 'THE SALTINGS',
    encounters: wildlife.PALLET_MARSH_WILDLIFE,
    // Salt marsh, two creeks with one ford each, and the pans worked between.
    areas: [{ x: 0, y: 64, width: 28, height: 8 }],
  },
  {
    id: 'pallet-hard',
    mapId: 'pallet-town',
    name: 'THE HARD',
    encounters: wildlife.PALLET_SHORE_WILDLIFE,
    // The stone slip the ferry lies off, and the grass above it.
    areas: [{ x: 28, y: 68, width: 16, height: 8 }],
  },
  {
    id: 'pallet-strand',
    mapId: 'pallet-town',
    name: 'THE STRAND',
    // Groyned sand between the marsh and the sea.
    areas: [{ x: 0, y: 72, width: 28, height: 4 }],
  },
  {
    id: 'pallet-ness',
    mapId: 'pallet-town',
    name: 'THE NESS',
    // The neck of the headland, and the gate the salter keeps across it.
    areas: [{ x: 44, y: 66, width: 20, height: 3 }],
  },
  {
    id: 'pallet-beacon',
    mapId: 'pallet-town',
    name: 'THE BEACON',
    // The headland itself: bare turf, a rock spine, and the light on it.
    areas: [{ x: 44, y: 69, width: 20, height: 7 }],
  },

  // -- Route 1 ---------------------------------------------------------------
  {
    id: 'route-1-overlook',
    mapId: 'route-1',
    name: 'THE OVERLOOK',
    // Both of the warden's doors are the Overlook's: its gate and its steps.
    areas: [{ x: 26, y: 0, width: 16, height: 10 }],
  },
  {
    id: 'route-1-head',
    mapId: 'route-1',
    name: 'ROUTE HEAD',
    areas: [{ x: 0, y: 0, width: 26, height: 6 }],
  },
  {
    id: 'route-1-field-station',
    mapId: 'route-1',
    name: "OAK'S FIELD STATION",
    areas: [{ x: 24, y: 10, width: 8, height: 9 }],
  },
  {
    id: 'route-1-meadows',
    mapId: 'route-1',
    name: 'THE MEADOWS',
    encounters: wildlife.ROUTE_MEADOW_WILDLIFE,
    areas: [{ x: 10, y: 6, width: 10, height: 15 }],
  },
  {
    id: 'route-1-west-road',
    mapId: 'route-1',
    name: 'WEST ROAD',
    encounters: wildlife.ROUTE_WEST_VERGE_WILDLIFE,
    areas: [{ x: 0, y: 6, width: 10, height: 17 }],
  },
  {
    id: 'route-1-east-road',
    mapId: 'route-1',
    name: 'EAST ROAD',
    encounters: wildlife.ROUTE_EAST_VERGE_WILDLIFE,
    areas: [{ x: 20, y: 6, width: 12, height: 20 }],
  },
  {
    id: 'route-1-west-gate',
    mapId: 'route-1',
    name: 'WEST GATE',
    areas: [{ x: 0, y: 23, width: 10, height: 9 }],
  },
  {
    id: 'route-1-outpost',
    mapId: 'route-1',
    name: 'THE OUTPOST',
    areas: [{ x: 10, y: 21, width: 22, height: 11 }],
  },
  // The east country, and then the south. Every one of these is cut out of the
  // same wood the shipped map was, and each is listed before the ground it is
  // cut out of so a boundary is drawn once, by order.
  {
    id: 'route-1-orchard',
    mapId: 'route-1',
    name: 'THE ORCHARD',
    // The walled garden, the grass path in from the station yard, the arch out
    // at the north, and the lane down from its south gate.
    areas: [{ x: 32, y: 6, width: 15, height: 26 }],
  },
  {
    id: 'route-1-thorn-dell',
    mapId: 'route-1',
    name: 'THE THORN DELL',
    // The hollow and the ride up to it. Named for the door rather than for the
    // wood, because the door is the only thing in it anybody remembers.
    areas: [{ x: 47, y: 0, width: 17, height: 17 }],
  },
  {
    id: 'route-1-paddocks',
    mapId: 'route-1',
    name: 'THE PADDOCKS',
    encounters: wildlife.ROUTE_PADDOCK_WILDLIFE,
    areas: [{ x: 47, y: 17, width: 17, height: 15 }],
  },
  {
    id: 'route-1-pound',
    mapId: 'route-1',
    name: 'THE POUND',
    encounters: wildlife.ROUTE_POUND_WILDLIFE,
    areas: [{ x: 16, y: 32, width: 8, height: 10 }],
  },
  {
    id: 'route-1-drove',
    mapId: 'route-1',
    name: 'THE DROVE',
    areas: [{ x: 0, y: 32, width: 16, height: 12 }],
  },
  {
    id: 'route-1-old-road',
    mapId: 'route-1',
    name: 'THE OLD ROAD',
    areas: [{ x: 16, y: 32, width: 16, height: 12 }],
  },
  {
    id: 'route-1-hollow-oak',
    mapId: 'route-1',
    name: 'THE HOLLOW OAK',
    areas: [{ x: 30, y: 33, width: 12, height: 12 }],
  },
  {
    id: 'route-1-steading',
    mapId: 'route-1',
    name: 'THE STEADING',
    areas: [{ x: 42, y: 32, width: 22, height: 15 }],
  },
  {
    // The water, its three crossings and the ground that runs down to them.
    // Listed after the steading so the farm keeps its own tracks and the brook
    // takes only what is on the bank.
    id: 'route-1-brook',
    mapId: 'route-1',
    name: 'THE BROOK',
    areas: [
      { x: 0, y: 44, width: 39, height: 5 },
      { x: 39, y: 47, width: 25, height: 6 },
    ],
  },
  {
    id: 'route-1-water-meadows',
    mapId: 'route-1',
    name: 'THE WATER MEADOWS',
    encounters: wildlife.ROUTE_WATER_MEADOW_WILDLIFE,
    areas: [{ x: 0, y: 49, width: 12, height: 23 }],
  },
  {
    id: 'route-1-common',
    mapId: 'route-1',
    name: 'THE COMMON',
    encounters: wildlife.ROUTE_COMMON_WILDLIFE,
    areas: [{ x: 12, y: 49, width: 20, height: 14 }],
  },
  {
    id: 'route-1-south-gate',
    mapId: 'route-1',
    name: 'SOUTH GATE',
    areas: [{ x: 12, y: 63, width: 24, height: 9 }],
  },
  {
    // A clearing off the Old Road that is on the way to nothing at all, which
    // is the whole of why it is worth turning aside into.
    id: 'route-1-wayside-shrine',
    mapId: 'route-1',
    name: 'THE WAYSIDE SHRINE',
    areas: [{ x: 32, y: 49, width: 10, height: 10 }],
  },
  {
    id: 'route-1-charcoal-burn',
    mapId: 'route-1',
    name: 'THE CHARCOAL BURN',
    areas: [{ x: 32, y: 53, width: 32, height: 19 }],
  },

  // -- Viridian Forest -------------------------------------------------------
  // The forest has always been eleven clearings, and until now only the design
  // notes knew their names. A wood is the one kind of map where every screen
  // looks like the last, so here the plate is most of how a player knows where
  // they are.
  {
    // The rock along the top of the wood, behind Lookout Pell's two doors, and
    // the rake of steps down into the stair clearing. Listed before FIRE TOWER
    // and TOWER STEPS, out of whose rectangles it is cut. No tall grass in it,
    // which is what makes it the one dry road in this forest and the whole of
    // what beating its keeper buys.
    id: 'forest-ridge',
    mapId: 'viridian-forest',
    name: 'THE RIDGE',
    // Row 4 stops at the rake, so the rock stair at 28,4 stays TOWER STEPS'.
    areas: [
      { x: 19, y: 0, width: 13, height: 4 },
      { x: 19, y: 4, width: 7, height: 1 },
      { x: 25, y: 5, width: 1, height: 3 },
    ],
  },
  {
    id: 'forest-tower-steps',
    mapId: 'viridian-forest',
    name: 'TOWER STEPS',
    encounters: wildlife.FOREST_EDGE_WILDLIFE,
    areas: [{ x: 27, y: 0, width: 5, height: 10 }],
  },
  {
    id: 'forest-fire-tower',
    mapId: 'viridian-forest',
    name: 'FIRE TOWER',
    encounters: wildlife.FOREST_FIRE_TOWER_WILDLIFE,
    areas: [{ x: 11, y: 0, width: 16, height: 8 }],
  },
  {
    id: 'forest-north-landing',
    mapId: 'viridian-forest',
    name: 'NORTH LANDING',
    encounters: wildlife.FOREST_EDGE_WILDLIFE,
    areas: [{ x: 0, y: 0, width: 11, height: 8 }],
  },
  {
    id: 'forest-sap-pool',
    mapId: 'viridian-forest',
    name: 'SAP POOL',
    encounters: wildlife.FOREST_WATERSIDE_WILDLIFE,
    areas: [{ x: 20, y: 8, width: 12, height: 9 }],
  },
  {
    id: 'forest-beetle-hollow',
    mapId: 'viridian-forest',
    name: 'BEETLE HOLLOW',
    encounters: wildlife.FOREST_BEETLE_HOLLOW_WILDLIFE,
    areas: [{ x: 0, y: 8, width: 10, height: 9 }],
  },
  {
    id: 'forest-crossroads',
    mapId: 'viridian-forest',
    name: 'THE CROSSROADS',
    encounters: wildlife.FOREST_TRAIL_WILDLIFE,
    // From x10: the west arm of the crossing is the Crossroads', all of it.
    areas: [{ x: 10, y: 8, width: 10, height: 9 }],
  },
  {
    // Behind the CUT door, and nothing else touches it: the trail at row 26
    // passes over its head and THE CLEARING lies one tile east of its east
    // wall. Listed before DEEP STAND, whose block it is cut out of, and before
    // THE CLEARING, whose rectangle reaches over it.
    id: 'forest-coppice',
    mapId: 'viridian-forest',
    name: 'THE COPPICE',
    encounters: wildlife.FOREST_COPPICE_WILDLIFE,
    areas: [{ x: 9, y: 27, width: 9, height: 8 }],
  },
  {
    // The name stands on the ground that looks it: the solid block of
    // broadleaves in the south-west, with the clearing at its north-east corner
    // and the trails along its north and east sides. It used to name a
    // rectangle east of here that was the same hedge and grass as everywhere
    // else, and a stranger who was shown the plate once pinned the name on the
    // tree block anyway. Listed before BROOK HEAD, whose column it is cut from.
    id: 'forest-deep-stand',
    mapId: 'viridian-forest',
    name: 'DEEP STAND',
    encounters: wildlife.FOREST_DEEP_WILDLIFE,
    areas: [{ x: 3, y: 21, width: 14, height: 11 }],
  },
  {
    id: 'forest-brook-head',
    mapId: 'viridian-forest',
    name: 'BROOK HEAD',
    encounters: wildlife.FOREST_WATERSIDE_WILDLIFE,
    // Where the brook starts, under the only canopy on the map that drips, and
    // the one place in the game where rain decides a wild fight outright: the
    // waterside's Squirtles are level 7-9, so they have Water Gun, and in the
    // rain it hits a Fire lead for half again - 44% wins against 88% clear.
    // Sap Pool shares that table and is deliberately left dry: two rainy
    // clearings in one wood is weather every dozen steps, which nobody reads.
    weather: WeatherId.Rain,
    areas: [{ x: 0, y: 17, width: 11, height: 19 }],
  },
  {
    id: 'forest-wardens-cut',
    mapId: 'viridian-forest',
    name: "WARDEN'S CUT",
    encounters: wildlife.FOREST_WARDEN_WILDLIFE,
    // The cut, and the trail that leaves it south for The Clearing.
    areas: [
      { x: 11, y: 17, width: 14, height: 4 },
      { x: 17, y: 21, width: 6, height: 6 },
    ],
  },
  {
    id: 'forest-east-rise',
    mapId: 'viridian-forest',
    name: 'EAST RISE',
    encounters: wildlife.FOREST_RISE_WILDLIFE,
    // The clearing, and the whole of the ledge under its brow.
    areas: [
      { x: 25, y: 17, width: 7, height: 10 },
      { x: 23, y: 21, width: 2, height: 6 },
    ],
  },
  // -- Viridian Forest, the east and the south -------------------------------
  // The wood turned out to be four times the size anybody had walked. What is
  // below names the new ground the same way the old ground is named: one place
  // per thing you would say to somebody describing the way you came.
  {
    // The rock runs the whole top of the wood. Listed after THE RIDGE, whose
    // rectangle it carries on from, and dry the length of it.
    id: 'forest-cinder-ridge',
    mapId: 'viridian-forest',
    name: 'CINDER RIDGE',
    areas: [{ x: 32, y: 0, width: 21, height: 6 }],
  },
  {
    id: 'forest-raven-crag',
    mapId: 'viridian-forest',
    name: 'RAVEN CRAG',
    areas: [{ x: 53, y: 0, width: 11, height: 12 }],
  },
  {
    id: 'forest-tarn',
    mapId: 'viridian-forest',
    name: 'THE TARN',
    encounters: wildlife.FOREST_TARN_WILDLIFE,
    areas: [{ x: 49, y: 12, width: 15, height: 15 }],
  },
  {
    id: 'forest-burn',
    mapId: 'viridian-forest',
    name: 'THE BURN',
    encounters: wildlife.FOREST_BURN_WILDLIFE,
    areas: [{ x: 32, y: 6, width: 17, height: 15 }],
  },
  {
    id: 'forest-hornet-glade',
    mapId: 'viridian-forest',
    name: 'HORNET GLADE',
    encounters: wildlife.FOREST_HORNET_WILDLIFE,
    areas: [{ x: 32, y: 21, width: 16, height: 10 }],
  },
  {
    id: 'forest-blowdown',
    mapId: 'viridian-forest',
    name: 'THE BLOWDOWN',
    encounters: wildlife.FOREST_BLOWDOWN_WILDLIFE,
    areas: [{ x: 33, y: 31, width: 15, height: 12 }],
  },
  {
    id: 'forest-charcoal-burn',
    mapId: 'viridian-forest',
    name: 'CHARCOAL BURN',
    encounters: wildlife.FOREST_KILN_WILDLIFE,
    areas: [{ x: 48, y: 27, width: 16, height: 15 }],
  },
  {
    // The ride is beaten earth end to end, so it holds no tall grass and rolls
    // nothing: the fastest ground in the south and the most exposed.
    id: 'forest-long-drive',
    mapId: 'viridian-forest',
    name: 'THE LONG DRIVE',
    areas: [{ x: 50, y: 42, width: 14, height: 15 }],
  },
  {
    // Two rectangles rather than one: the quarry's east benches are inside
    // x45-50 down to y64, and a quarry bench called THE ROOKERY would be the
    // plate telling the player they had left a place they are standing in.
    id: 'forest-rookery',
    mapId: 'viridian-forest',
    name: 'THE ROOKERY',
    encounters: wildlife.FOREST_ROOKERY_WILDLIFE,
    areas: [
      { x: 51, y: 57, width: 13, height: 8 },
      { x: 45, y: 65, width: 19, height: 7 },
    ],
  },
  {
    id: 'forest-sawpit',
    mapId: 'viridian-forest',
    name: 'THE SAWPIT',
    encounters: wildlife.FOREST_SAWPIT_WILDLIFE,
    areas: [{ x: 16, y: 36, width: 11, height: 12 }],
  },
  {
    id: 'forest-brook-foot',
    mapId: 'viridian-forest',
    name: 'BROOK FOOT',
    encounters: wildlife.FOREST_BROOK_FOOT_WILDLIFE,
    areas: [{ x: 0, y: 36, width: 16, height: 12 }],
  },
  {
    id: 'forest-stone-row',
    mapId: 'viridian-forest',
    name: 'STONE ROW',
    encounters: wildlife.FOREST_STONE_ROW_WILDLIFE,
    areas: [{ x: 27, y: 43, width: 21, height: 7 }],
  },
  {
    id: 'forest-hollow-way',
    mapId: 'viridian-forest',
    name: 'THE HOLLOW WAY',
    encounters: wildlife.FOREST_HOLLOW_WILDLIFE,
    areas: [{ x: 17, y: 47, width: 15, height: 15 }],
  },
  {
    id: 'forest-quarry',
    mapId: 'viridian-forest',
    name: 'THE QUARRY',
    encounters: wildlife.FOREST_QUARRY_WILDLIFE,
    areas: [{ x: 32, y: 49, width: 19, height: 16 }],
  },
  {
    id: 'forest-mere',
    mapId: 'viridian-forest',
    name: 'THE MERE',
    encounters: wildlife.FOREST_MERE_WILDLIFE,
    // The fourth rainy place in the game and the second in this wood, which is
    // the same rule BROOK HEAD is: a place made of water. It is the foot of the
    // same brook and twenty-five steps south of BROOK HEAD's nearest tile, so
    // it is a second place rather than weather every dozen steps - and BROOK
    // FOOT between them is deliberately dry for exactly that reason.
    weather: WeatherId.Rain,
    areas: [{ x: 0, y: 48, width: 17, height: 11 }],
  },
  {
    id: 'forest-warren',
    mapId: 'viridian-forest',
    name: 'THE WARREN',
    encounters: wildlife.FOREST_WARREN_WILDLIFE,
    areas: [{ x: 0, y: 59, width: 17, height: 13 }],
  },
  {
    id: 'forest-south-road',
    mapId: 'viridian-forest',
    name: 'THE SOUTH ROAD',
    encounters: wildlife.FOREST_SOUTH_ROAD_WILDLIFE,
    areas: [{ x: 17, y: 62, width: 14, height: 10 }],
  },
  {
    id: 'forest-beech-flat',
    mapId: 'viridian-forest',
    name: 'BEECH FLAT',
    encounters: wildlife.FOREST_BEECH_WILDLIFE,
    areas: [{ x: 31, y: 62, width: 14, height: 10 }],
  },
  {
    id: 'forest-clearing',
    mapId: 'viridian-forest',
    name: 'THE CLEARING',
    encounters: wildlife.FOREST_CLEARING_WILDLIFE,
    areas: [{ x: 11, y: 27, width: 21, height: 9 }],
  },
];

const holds = (area: DistrictArea, tile: GridPosition): boolean =>
  tile.x >= area.x &&
  tile.x < area.x + area.width &&
  tile.y >= area.y &&
  tile.y < area.y + area.height;

/** The districts a map declares, in the order that settles an overlap. */
export function districtsForMap(mapId: WorldMapId): readonly MapDistrict[] {
  return MAP_DISTRICTS.filter((district) => district.mapId === mapId);
}

/** The district a tile is in, or undefined on a map that names none. */
export function districtAt(mapId: WorldMapId, tile: GridPosition): MapDistrict | undefined {
  return districtsForMap(mapId).find((district) => district.areas.some((area) => holds(area, tile)));
}

/**
 * The weather a fight starting on this tile is fought in. Null everywhere a
 * place has not authored one, which is most of every map.
 */
export function weatherAt(mapId: WorldMapId, tile: GridPosition): WeatherId | null {
  return districtAt(mapId, tile)?.weather ?? null;
}
