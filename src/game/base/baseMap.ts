import type { GridPosition } from '../movement/gridMovement';
import { MapSketch, type PlantedProp } from '../world/mapGrid';
import { buildMapLayers, type MapLayers } from '../world/tiles';
import type { Material } from '../world/tileset/materials';
import { BASE_TILESET, type BasePropName } from './baseTileset';
import { BASE_DOORS } from './doors';
import { standingFixtures } from './fixtures';
import { HARBOUR_LANDMARKS } from './landmarks';

/**
 * THE HARBOUR - the one map in the game nobody is hunting you on.
 *
 * (Every building on it can be walked into: see `rooms.ts`.)
 *
 * The lobby used to be a list of four cards. This is the same places as a
 * town you walk around: the Raid Arena for the raid, Oak's Lab for the board
 * of work and the wall map, the Pokémon Center for the team, Brock's Workshop
 * for the base, and the quay where Bill takes what you dragged home.
 *
 * It was a tight yard with every door seven steps from the spawn, and the
 * captain asked for room (2026-10-23: "more open space, all the pathways need
 * to be a bit wider"), so it was redrawn wider: two tiles of lawn between
 * every pair of buildings, a yard five rows deep, and the RAID ARENA on its
 * own forecourt at the west end - a FireRed Gym, the one door every raid
 * goes through, beside the jetty a raid comes home to. What is held short is
 * the walk taken every raid (`baseMap.test.ts`): the Arena from the spawn and
 * from the boat, and Bill from the boat. What you build stands in the
 * clearings behind the keepers' row, the mast beside the house and the
 * lockers and the lamp house on the quay.
 *
 * It is not a `WorldMapId`. A raid map carries a hunter, a clock, wildlife,
 * loot, districts, gates and a density budget, and every one of those is a rule
 * the base would have to be excused from; keeping it out of that union is what
 * lets `mapStructure.testkit.ts` go on meaning what it means. What it does share
 * is the drawing: the same `MapSketch`, the same catalogue, the same
 * `buildMapLayers`, so the base is the same art in the same hand.
 *
 * Why not Pallet Town: Pallet Town is a map you deploy *into*, and a base of
 * that name would have the player dropping into Pallet Town from Pallet Town.
 */

export const BASE_MAP_WIDTH = 90;
export const BASE_MAP_HEIGHT = 34;

/** What the screens call this place, on the way out of every one of them. */
export const BASE_PLACE_NAME = 'The Harbour';

/**
 * Where the player stands when they walk in off the title screen: the middle of
 * the yard, between the Raid Arena and the keepers' row, with both in view.
 */
export const BASE_SPAWN: GridPosition = { x: 16, y: 13 };

/**
 * And where a raid puts them down: the head of the jetty their boat is tied to,
 * facing up the yard. Coming home is the one moment the base is meant to be
 * looked at rather than crossed, and it lands the player beside Bill, who is
 * the first thing a raid that went well wants.
 */
export const BASE_LANDING: GridPosition = { x: 12, y: 19 };

/** Something on a post that says something when faced: a board, a house's sign. */
export interface BaseSign {
  readonly x: number;
  readonly y: number;
  readonly lines: readonly string[];
  /**
   * A sign that is a way to knock on somebody else's door: read while the
   * shared harbour is up (`harbour/`), it asks whose, and the player picks
   * from every house in the harbour (`ui/KnockOverlay.ts`). Its `lines` are
   * what it says when there is no harbour to knock in.
   */
  readonly knocks?: true;
}

/**
 * The harbour's own board, on the quay where the boat ties up, because that is
 * where a player who has just come home is standing.
 */
export const NOTICE_BOARD: BaseSign = {
  x: 18,
  y: 17,
  lines: [
    `${BASE_PLACE_NAME.toUpperCase()} - what the raids are run out of.`,
    'THE SEAGALLOP at the jetty takes every raid out and brings it home. Every raid starts at the RAID ARENA, west of the yard. OAK keeps the board of work. JOY patches the team up. BROCK builds onto the base, and BILL takes what you drag home.',
    'THE BOLTHOLE, at the end of the row, is yours. Past it, the DAY-CARE MAN raises one Pokémon while you raid.',
    'Past THE GREEN, THE PROMENADE: the GAME CORNER pays TICKETS for POKéMON JUMP and BERRY PICKING, the FIELD-MOVE COURSE past it pays them for a quick time, and the PRIZE WINDOW takes them.',
  ],
};

/**
 * The sign at THE BOLTHOLE's front, against the west side of the house, and
 * the way to knock on another player's door: everybody's house is behind this
 * one door, so this one sign is outside every door in the harbour. It is read
 * from KEEPERS' ROW below it, and stands off it: on the row it narrowed the
 * street everybody walks to one tile. (East of the house is the garden, which
 * needs every tile it has for six Pokémon.)
 */
export const HOME_SIGN: BaseSign = {
  x: 35,
  y: 11,
  lines: ['THE BOLTHOLE', 'Home. Nobody hunts you here.'],
  knocks: true,
};

/**
 * The sign on THE GREEN, the lawn past the Day-Care that the harbour grew by
 * when it became the one everybody who plays walks (`harbour/`): somewhere to
 * stand about that is nobody's door.
 */
export const GREEN_SIGN: BaseSign = {
  x: 53,
  y: 11,
  lines: ['THE GREEN', 'Everybody in Pallet Town comes home to this harbour. Stand about - somebody always turns up.'],
};

/**
 * The Raid Arena's own sign, on its forecourt under its colours. It stood in the
 * gap between the forecourt and the yard, which made the way to the one door
 * every raid goes through a single tile wide.
 */
export const ARENA_SIGN: BaseSign = {
  x: 3,
  y: 14,
  lines: ['THE RAID ARENA', 'Every raid starts here. Walk in, kit up, drop in.'],
};

/** At the head of the long pier, beside the bollards. */
export const PIER_SIGN: BaseSign = {
  x: 25,
  y: 20,
  lines: ['THE LONG PIER', 'The S.S. ANNE lies at the end of it. Nobody aboard has said when she sails.'],
};

/** On the beach past the warehouses, where the fishing jetty goes out. */
export const COVE_SIGN: BaseSign = {
  x: 49,
  y: 17,
  lines: ['THE COVE', 'Sand, rocks and a jetty to fish off. The ANGLER on the end of it lends his rod.'],
};

/** FireRed's town map board, at the corner of HARBOUR SQUARE: where everything is. */
export const SQUARE_MAP: BaseSign = {
  x: 22,
  y: 14,
  lines: [
    'HARBOUR SQUARE - a map of THE HARBOUR.',
    'The RAID ARENA is west, on ARENA SQUARE. The keepers are along KEEPERS\u2019 ROW. THE QUAY and the SEAGALLOP are south.',
    'East along the water: THE DOCKS, THE LONG PIER out to the S.S. ANNE, and THE COVE. THE GREEN is past THE BOLTHOLE.',
    'Past THE GREEN, THE PROMENADE runs along the beach to the GAME CORNER, the FIELD-MOVE COURSE and the PLEASURE PIER.',
  ],
};

/** Where the breakwater leaves the cove's beach. */
export const BREAKWATER_SIGN: BaseSign = {
  x: 58,
  y: 20,
  lines: [
    'THE BREAKWATER',
    'It keeps the sea out of the harbour. The light at its head is BROCK\u2019s to build.',
  ],
};

/**
 * At the west end of THE PROMENADE, on THE GREEN's edge below where the stone
 * walk starts: it stood at the foot of the way up to THE GREAT LIBRARY.
 */
export const PROMENADE_SIGN: BaseSign = {
  x: 58,
  y: 15,
  lines: [
    'THE PROMENADE',
    'The front: the GAME CORNER, the DERBY, the FIELD-MOVE COURSE, the DIG on the beach and the FISHING DERBY off the PLEASURE PIER. Walk it at dusk when the lamps come on.',
  ],
};

/**
 * On the lawn in front of THE GAME CORNER, west of the way up to its door:
 * where it stood, between the hall and THE BATTLE ARENA, is a flower trough.
 */
export const GAME_CORNER_SIGN: BaseSign = {
  x: 74,
  y: 12,
  lines: [
    'THE GAME CORNER',
    'POKéMON JUMP and BERRY PICKING inside - bring your best jumpers, and a DODRIO. TICKETS are kept at home and spent at the PRIZE WINDOW next door.',
  ],
};

/** At the head of the pleasure pier, in the boardwalk's railing beside the way on. */
export const PLEASURE_PIER_SIGN: BaseSign = {
  x: 83,
  y: 16,
  lines: ['THE PLEASURE PIER', 'Out over the sea. Mind the gulls.'],
};

/**
 * THE GREEN's bench, by its top-left: three tiles wide and two deep, its back
 * to the path and a row of lawn between it and THE COVE's sand. East of it
 * two columns of lawn are left clear from the path down to the sand: the way
 * to THE COVE and its jetty.
 */
export const BENCH = { x: 50, y: 14 } as const;

/** Where THE BATTLE ARENA stands (`doors.ts` says it, beside its door). */
export { BATTLE_ARENA_LOT } from './doors';

export const BASE_SIGNS: readonly BaseSign[] = [
  PROMENADE_SIGN,
  GAME_CORNER_SIGN,
  PLEASURE_PIER_SIGN,
  BREAKWATER_SIGN,
  NOTICE_BOARD,
  HOME_SIGN,
  GREEN_SIGN,
  ARENA_SIGN,
  PIER_SIGN,
  COVE_SIGN,
  SQUARE_MAP,
];

/**
 * Every flower in the harbour, bed by bed: FireRed's red flowers, planted where
 * somebody would plant them and nowhere a walker's line runs. They stood on
 * KEEPERS' ROW's gravel once - eight of them, across both rows of the path -
 * and the lawn grew more wherever a hash fell, half under a roof or a board
 * (the owner, 14 Nov 2026: "there's flowers on the path and stuff").
 * `harbourLooks.test.ts` holds every one to lawn, clear of every way and of
 * everything that stands over it.
 */
export const FLOWER_BEDS: readonly { readonly name: string; readonly tiles: readonly (readonly [number, number])[] }[] = [
  // Under THE BOLTHOLE's window boxes, beside its step.
  { name: 'THE BOLTHOLE’s front garden', tiles: [[38, 11], [39, 11], [40, 11]] },
  // Down the Day-Care's east fence, a border along the way up to the boutique.
  { name: 'THE GREEN’s border', tiles: [[53, 7], [53, 8]] },
  // Either side of THE GREAT LIBRARY's step.
  { name: 'THE GREAT LIBRARY’s beds', tiles: [[60, 7], [61, 7], [63, 7], [64, 7]] },
];

export interface BaseMapDefinition {
  readonly width: number;
  readonly height: number;
  readonly layers: MapLayers;
  readonly collision: readonly boolean[][];
  readonly terrain: readonly Material[][];
  /**
   * Everything planted on it, by name and top-left, the wood's trees among
   * them: what `harbourLooks.test.ts` asks about what stands against what.
   */
  readonly planted: readonly PlantedProp<BasePropName>[];
}

/**
 * The picture. One drawn block, so what is reviewed is the map rather than the
 * instructions that would build it.
 *
 * Five bands read from the top: the wood the harbour is cut out of, the grass
 * the buildings stand on, the trodden path in front of them (KEEPERS' ROW,
 * two tiles wide) with HARBOUR SQUARE's brick and its fountain below it
 * opening onto the stone quay, and the water - which is a harbour rather than a sea's edge
 * because of what is on it (`landmarks.ts`): the ferry at the jetty, the
 * S.S. Anne at the end of the long pier, the warehouses on the deeper east
 * quay and THE COVE's beach past them. The three tiles of quay under the
 * pier's awning are ground the awning is walked under, because a canopy cell
 * leaves the ground to decide whether it is walked. Earth for the yard and stone for the quay because
 * the two have to tell each other apart at a glance - paving on this sheet is a
 * flat pale slab with nothing in it, and a yard drawn in it read as a blank
 * grey rectangle across the middle of the base. `t` is a tree, and every one of
 * them stands inside the wood so that no crown hangs over ground anybody can
 * stand on. The first row of them stands three rows down rather than two: the
 * top of a crown is drawn in the row above its tree (`PropDefinition.brim`),
 * and a tree any higher has the edge of the map slice it flat.
 *
 * Past THE BOLTHOLE's garden the lawn carries on east to the DAY-CARE: `F` is
 * its fence, a ring round the patch of grass the Pokemon left there walks
 * about in (`dayCarePen.ts`).
 */
function sketchBase(builtUpgradeIds: readonly string[]): MapSketch<BasePropName> {
  const map = new MapSketch<BasePropName>({
    width: BASE_MAP_WIDTH,
    height: BASE_MAP_HEIGHT,
    fill: '.',
    stamps: {
      t: {
        prop: 'tree',
        anchor: [1, 2],
        ground: '.',
        bare: 'T',
        blocks: [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0]],
      },
    },
  });

  map.draw(0, 0, [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtT............TtTTtTTtTTtTTtTTtTTT.....T.....TTTtTTtTTtTTtTTtTTtTTtTTT',
    'TTTTTTTTTTTTTTTTTTTTTT............TTTTTTTTTTTTTTTTTTTT...........TTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTT............TTTTTTTTTTTTTTTTTTTT...........TTTTTTTTTTTTTTTTTTTTTTTTT',
    'TtTTTTtTTTTtTTTTTtTTTT............TTTtTTTTTTTTTTTtTTTT...........TtTTTTtT..........TTTtTTT',
    'TTT...........................................FFFFFFF..................................TTT',
    'TTT...........................................F.....F..................................TTT',
    'TtTMMMMMMMMMMM................................F.....F..................................TtT',
    'TTTMMMMMMMMMMM................................F.....F..................................TTT',
    'TTTMMMMMMMMMMM................................FFFFFFF..................................TTT',
    'TtTMMMMMMMMMMM,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,MMM.......................TtT',
    'TTTMMMMMMMMMMM,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,MMMMMMMMMMMMMMMMMMMMMMMMMMTTT',
    'TTTMMMMMMMMMMM,,,,,,,,MMMMMMMMMMMMM..........................MMMMMMMMMMMMMMMMMMMMMMMMMMTTT',
    'TtTMMMMMMMMMMM,,,,,,,,MMMMMMMMMMMMM..........................__________________________TTT',
    'TTTMMMMMMMMMMM,,,,,,,,MMMMMMMMMMMMM..........................__________________________TtT',
    'WWWMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMddddddddddddd~~~~~~~~~~~~~~~~~~___~~~~~TTT',
    'WWWMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~___~~~~~TTT',
    'WWWMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~___~~~~~TtT',
    'WWWWWWWWWWWWWWWWWWWWWWMMMMMMMMMMMMMMMMMMMMMMMMMM~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~___~~~~~TTT',
    'WWWWWWWWWWWWWWWWWWWWWWMMMMMMMMMMMMMMMMMMMMMMMMMMWWWWWWWWWWWMM~~~~~~~~~~~~~~~~~~___~~~~~TTT',
    'WWWWWWWWWWWWWWWWWWWWWWMMMMMMMMMMMMMMMMMMMMMMMMMMWWWWWWWWWWWMM~~~~~~~~~~~~~~~~~~___~~~~~TTT',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMWWWWWWWWWWWWWWWWWW___WWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMWWWWWWWWWWWWWWWWWW___WWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMWWWWWWWWWWWWWWWWWW___WWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMWWWWWWWWWWWWWWWWWW___WWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMWWWWWWWWWWWWWWWWWW___WWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMWWWWWWWWWWWWWWW_________WWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMWWWWWWWWWWWWWWW_________WWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMMMMMMMMMMMMMMMMMMMWWWWWWWWWWWWWWW_________WWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMMMMMMMMMMMMMMMMMMMWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  ]);

  // The four buildings, each with its own doorway cut into it by the base's
  // catalogue. The three the player re-kits at stand in one row so the three
  // doors are one decision; Bill's cottage stands on the quay beside the jetty.
  for (const door of BASE_DOORS) {
    map.plant(door.building.x, door.building.y, door.building.prop);
  }

  // The quay, which is always here: the jetty the boat is tied to, Bill's
  // crates, a post to moor against and the harbour's own board.
  // Two jetties abreast: one is two planks wide, which from above reads as two
  // planks rather than as something a boat ties up to.
  map.plant(11, 19, 'jetty');
  map.plant(13, 19, 'jetty');

  // The waterfront (`landmarks.ts`): the ferry a raid goes out on, tied up
  // beside the jetty; the warehouses along the east quay; Vermilion's long
  // pier running out to the S.S. Anne.
  map.plant(26, 20, 'shipPier');
  // The working quay: posts along the edge to tie up to either side of the
  // pier's foot, and what came off the boats stacked outside the warehouses.
  // Everything on it stands off the two ways along it - KEEPERS' ROW's way down
  // to the boat, and the waterfront from the jetty to THE COVE - which were a
  // single tile wide between barrels, cellar doors and posts.
  // The posts have the quay's edge to themselves: the pair of barrels that
  // stood in the corner under them, wedged between the corner post and the
  // pier's, is with the rest of the cargo behind the warehouses' east end.
  for (const x of [24, 25, 33]) {
    map.plant(x, 21, 'mooringPost');
  }
  map.plant(22, 19, 'mooringPost');
  // Cargo at the warehouses' two ends, off the rows along the water and off
  // the three tiles the upper quay comes down to the docks by (x 33 to 35,
  // the one way round the pier's foot, which a pair needs two of): one barrel
  // against the west wall; at the east end two stacks of crates, one on the
  // quay and one on the lawn's dead corner above it, the barrels from the
  // pier's foot beside them behind the roof, and a sack by the door.
  // The sack stood with a pair of barrels in the corner where HARBOUR
  // SQUARE's paving, the lawn and the warehouses' wall meet, against the
  // second locker's door: that pair is the barrel here and the one by Bill's.
  map.plant(35, 17, 'barrel');
  map.plant(44, 14, 'barrelPair');
  map.plant(46, 15, 'crateStack');
  map.plant(46, 17, 'crateStack');
  map.plant(45, 20, 'sack');
  // THE COVE, past the warehouses: a strip of beach under THE GREEN, with a
  // jetty to fish off and rocks out in the water.
  map.plant(54, 21, 'jetty');
  map.plant(COVE_SIGN.x, COVE_SIGN.y, 'homeSign');
  map.plant(BREAKWATER_SIGN.x, BREAKWATER_SIGN.y, 'homeSign');
  map.plant(PIER_SIGN.x, PIER_SIGN.y, 'homeSign');
  map.plant(52, 27, 'wetRock');
  map.plant(49, 24, 'wetRock');
  for (const landmark of HARBOUR_LANDMARKS) {
    for (const prop of landmark.props) {
      map.plant(prop.x, prop.y, prop.name);
    }
  }
  map.plant(NOTICE_BOARD.x, NOTICE_BOARD.y, 'noticeBoard');

  // Crates on the corner of the quay, off the boats and waiting for the
  // warehouses (`harbourLife.ts` has the porter minding them). The quay below
  // them is where a raid's haul is stood out (`haulOnTheQuay.ts`). The stack
  // that stood between the Arena's east statue and Bill's cottage, touching
  // both, is at the warehouses' east end now, where the rest of the cargo is:
  // the forecourt's corner is a statue, a gap, a barrel and a cottage.
  map.plant(3, 16, 'crateStack');
  // What Bill keeps by his own wall is one barrel, a tile clear of the
  // statue and off the quay's row below it, which is the pair's way from the
  // jetty to the Arena: enough to say at a glance that this is where things
  // are traded, and small enough to leave the forecourt's corner open.
  map.plant(12, 15, 'barrel');

  // THE RAID ARENA's forecourt: a pair of statues on the way up from the
  // quay, as every Gym in Kanto has, with the forecourt in front of the door
  // left open so the yard walks straight across to it, its colours hung either side of
  // the building, and its sign. The Gym backs onto lawn because FireRed drew
  // the grass behind it into its roof.
  map.plant(6, 15, 'gymStatue');
  map.plant(10, 15, 'gymStatue');
  map.plant(3, 11, 'arenaBanners');
  map.plant(12, 11, 'arenaBanners');
  // The red runner from its door down between the statues to the quay.
  map.plant(8, 13, 'arenaRunnerHead');
  map.plant(8, 14, 'arenaRunner');
  map.plant(8, 15, 'arenaRunner');
  map.plant(8, 16, 'arenaRunnerFoot');
  map.plant(ARENA_SIGN.x, ARENA_SIGN.y, 'homeSign');

  // THE BOLTHOLE's sign beside the path to its step, and the harbour's flower
  // beds, each where it belongs (`FLOWER_BEDS`).
  map.plant(HOME_SIGN.x, HOME_SIGN.y, 'homeSign');
  for (const bed of FLOWER_BEDS) {
    for (const [x, y] of bed.tiles) {
      map.plant(x, y, 'gardenFlowers');
    }
  }

  // HARBOUR SQUARE, in the middle of the yard: a paved square round a
  // fountain, with the keepers' path running along the top of it and the
  // quay along the bottom, so it is crossed on the way to everything.
  map.plant(27, 14, 'stoneFountain');
  map.plant(SQUARE_MAP.x, SQUARE_MAP.y, 'townMap');

  // THE GREEN, past the Day-Care: a fountain to meet at and its sign, with a
  // way up either side of the fountain to THE HARBOUR BOUTIQUE and THE GREAT
  // LIBRARY. KEEPERS' ROW's gravel runs on under them to THE PROMENADE's
  // stone, the straight way east, and nothing stands on it: the bench stood
  // across it once. It is on the lawn's edge over THE COVE's sand now, clear
  // of the warehouses' crates, with the jetty and the bay in front of it.
  map.plant(56, 8, 'roundFountain');
  map.plant(BENCH.x, BENCH.y, 'bench');
  map.plant(GREEN_SIGN.x, GREEN_SIGN.y, 'homeSign');

  plantPromenade(map);

  // And what the player has built. Planted last, so a fixture is the last word
  // on its own tiles exactly as a landmark is on a raid map.
  for (const fixture of standingFixtures(builtUpgradeIds)) {
    for (const prop of fixture.props) {
      map.plant(prop.x, prop.y, prop.name);
    }
  }

  return map;
}

/**
 * THE PROMENADE, past THE GREEN: a seaside front read from the top down - the
 * BATTLE ARENA under its name board and THE GAME CORNER under its lit
 * marquee; the stone walk; the boardwalk with
 * its lamps and railings, broken where steps go down to the sand; the beach
 * with its row of painted huts, parasols and deckchairs; and the pleasure pier
 * out over the sea. Its things are drawn for it (`promenadeSheet.ts`), so a
 * front of the same stone for twenty-five tiles reads as a place with
 * somewhere to sit, something to buy and somewhere to go.
 */
function plantPromenade(map: MapSketch<BasePropName>): void {
  // THE BATTLE ARENA stands on its lot (`doors.ts`), planted with the doors.
  map.plant(PROMENADE_SIGN.x, PROMENADE_SIGN.y, 'homeSign');
  map.plant(GAME_CORNER_SIGN.x, GAME_CORNER_SIGN.y, 'homeSign');
  map.plant(PLEASURE_PIER_SIGN.x, PLEASURE_PIER_SIGN.y, 'homeSign');
  // Flower troughs either side of the arcade's plaza, against its walls; past
  // it THE FIELD-MOVE COURSE's gate and its TIME BOARD stand with the landmarks
  // (`landmarks.ts`), with the way up to the gate's front left open.
  map.plant(71, 11, 'troughPink');
  map.plant(78, 11, 'troughYellow');
  map.plant(86, 11, 'pennantYellow');
  // The boardwalk's seaward edge, read from the west: the railing, a lamp
  // where it starts, the beach huts backed onto it two by two with steps
  // down to the sand between them, a lamp by the second steps, the pleasure
  // pier, and the railing again past it. A lamp stands in the railing on its
  // post, its head over the boardwalk behind it (`promenadePost`), so the
  // boardwalk and the stone walk above it are three tiles wide the whole way
  // along with nothing on them.
  const HUTS: readonly (readonly [number, BasePropName])[] = [
    [62, 'hutRed'],
    [64, 'hutYellow'],
    [68, 'hutBlue'],
    [70, 'hutGreen'],
    [75, 'hutPink'],
    [77, 'hutTeal'],
  ];
  const lamps = [61, 72, 84, 86];
  const open = new Set([
    // The steps, and the pleasure pier's foot.
    66, 67, 73, 74, 79, 80, 81, 82,
    ...HUTS.flatMap(([x]) => [x, x + 1]),
    PLEASURE_PIER_SIGN.x,
  ]);
  for (let x = 61; x <= 86; x += 1) {
    if (lamps.includes(x)) {
      map.plant(x, 16, 'promenadeLamp');
    } else if (!open.has(x)) {
      map.plant(x, 16, 'railing');
    }
  }
  for (const [x, hut] of HUTS) {
    map.plant(x, 16, hut);
  }
  // Out on the sand in front of the huts, and never in front of the steps:
  // parasols with deckchairs in their shade, and THE DIG's sign
  // (`landmarks.ts`). The two rows along the water are the beach's way along,
  // from THE COVE to the pier, and are left clear; the ice-cream cart is past
  // the pier.
  map.plant(62, 19, 'parasolRed');
  map.plant(64, 20, 'deckchairRed');
  map.plant(65, 20, 'deckchairBlue');
  map.plant(70, 19, 'parasolBlue');
  map.plant(75, 19, 'parasolYellow');
  map.plant(77, 20, 'deckchairYellow');
  map.plant(83, 19, 'iceCart');
  map.plant(85, 21, 'wetRock');
  map.plant(70, 25, 'wetRock');
  // THE PLEASURE PIER's head: pennants at its corners, a lifebuoy and a lamp.
  map.plant(84, 28, 'pennantRed');
  map.plant(84, 29, 'lifebuoy');
  map.plant(83, 29, 'promenadeLamp');
  for (const x of [76, 77, 78, 82, 83, 84]) {
    map.plant(x, 30, 'railing');
  }
}

const built = new Map<string, BaseMapDefinition>();

/**
 * The base as it stands for a player who has built these rungs.
 *
 * Remembered by which rungs are up, the way `getWorldMap` remembers a map by
 * which doors are open: a base is a different map per state rather than a flag
 * checked while drawing, so the collision the player walks is the collision the
 * things they built actually make.
 */
export function getBaseMap(builtUpgradeIds: readonly string[] = []): BaseMapDefinition {
  const key = [...builtUpgradeIds].sort().join('|');
  const remembered = built.get(key);
  if (remembered) {
    return remembered;
  }
  const sketch = sketchBase(builtUpgradeIds);
  const layers = buildMapLayers(sketch, BASE_TILESET);
  const definition: BaseMapDefinition = {
    width: sketch.width,
    height: sketch.height,
    layers,
    collision: layers.collision,
    terrain: Array.from({ length: sketch.height }, (_row, y) =>
      Array.from({ length: sketch.width }, (_column, x) => sketch.surfaceAt(x, y)),
    ),
    planted: sketch.props(),
  };
  built.set(key, definition);
  return definition;
}
