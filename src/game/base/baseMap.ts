import type { GridPosition } from '../movement/gridMovement';
import { MapSketch, type PlantedProp } from '../world/mapGrid';
import { buildMapLayers, type MapLayers } from '../world/tiles';
import type { Material } from '../world/tileset/materials';
import { BASE_TILESET, type BasePropName } from './baseTileset';
import { BASE_DOORS } from './doors';
import { standingFixtures } from './fixtures';
import { HARBOUR_LANDMARKS } from './landmarks';
import { START_X as DERBY_START_X } from '../minigames/derbyLevels';

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

export const BASE_MAP_WIDTH = 130;
export const BASE_MAP_HEIGHT = 34;

/** What the screens call this place, on the way out of every one of them. */
export const BASE_PLACE_NAME = 'The Harbour';

/**
 * Where the player stands when they walk in off the title screen: the middle of
 * the yard, between the Raid Arena and the keepers' row, with both in view -
 * on the smallest screen the Arena's door, the Center's, the lab's and Bill's
 * all at once, and the lab's doorway clear of the FEEDBACK tab half way down
 * the right edge (`harbourLooks.test.ts`). A row further down would clear the
 * tab's corner off the lab's pillar too, at a step more to the Arena.
 */
export const BASE_SPAWN: GridPosition = { x: 17, y: 13 };

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
    'Every raid starts at the RAID ARENA, west of the yard: jump in from the rim, and ride home to it. OAK keeps the board of work. JOY patches the team up. BROCK builds onto the base, and BILL takes what you drag home.',
    'THE BOLTHOLE, at the end of the row, is yours. Past it, the DAY-CARE MAN raises one Pokémon while you raid.',
    'Past THE GREEN, THE PROMENADE: the GAME CORNER on PIER SQUARE pays TICKETS for POKéMON JUMP and BERRY PICKING, the FIELD-MOVE COURSE out on THE POINT pays them for a quick time, and the PRIZE WINDOW takes them.',
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
  lines: ['THE RAID ARENA', 'Every raid starts here. Walk in, kit up, jump in.'],
};

/** On the wharf at the head of the long pier, west of its bollards. */
export const PIER_SIGN: BaseSign = {
  x: 24,
  y: 20,
  lines: ['THE LONG PIER', 'The S.S. ANNE lies at the end of it. Nobody aboard has said when she sails.'],
};

/**
 * At the top of THE COVE's beach, past the boutique, above where the fishing
 * jetty goes out - and two tiles clear of the derby's west line (x 55), where
 * eight riders line up on the sand.
 */
export const COVE_SIGN: BaseSign = {
  x: 57,
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
    'South through the lamps: THE LONG PIER out to the S.S. ANNE. East along THE DOCKS: the fish stall, the warehouses, THE HARBOUR BOUTIQUE and THE COVE.',
    'THE GREEN and THE GREAT LIBRARY are past THE BOLTHOLE. Past them THE PROMENADE runs round the bay: the BATTLE ARENA, PIER SQUARE with the GAME CORNER and the PLEASURE PIER, THE GARDENS, and the FIELD-MOVE COURSE out on THE POINT.',
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
 * At the west end of THE PROMENADE, where the stone walk starts: against THE
 * BATTLE ARENA's corner, at the foot of the hedge between it and the DERBY's
 * board, and read from the walk. On the lawn over THE COVE it stood on the
 * line the derby's riders come up from the sand by.
 */
export const PROMENADE_SIGN: BaseSign = {
  x: 64,
  y: 11,
  lines: [
    'THE PROMENADE',
    'The front, round the bay: the DERBY starts here, the GAME CORNER is on PIER SQUARE, the DIG is on the beach, the FISHING DERBY off the end of the PLEASURE PIER and the FIELD-MOVE COURSE out on THE POINT. Walk it at dusk when the lamps come on.',
  ],
};

/**
 * At PIER SQUARE's west corner, read from the walk: the square's middle is
 * the arcade door's line down to the pier, and nothing stands on it.
 */
export const GAME_CORNER_SIGN: BaseSign = {
  x: 80,
  y: 11,
  lines: [
    'THE GAME CORNER',
    'POKéMON JUMP and BERRY PICKING inside - bring your best jumpers, and a DODRIO. TICKETS are kept at home and spent at the PRIZE WINDOW next door.',
  ],
};

/** On THE GARDENS' lawn beside the gravel path up to the bandstand. */
export const GARDENS_SIGN: BaseSign = {
  x: 103,
  y: 11,
  lines: ['THE GARDENS', 'The band plays Sundays. Mind the beds.'],
};

/** At the pleasure pier's gate, in the rail along PIER SQUARE's foot beside the way on. */
export const PLEASURE_PIER_SIGN: BaseSign = {
  x: 81,
  y: 16,
  lines: ['THE PLEASURE PIER', 'Out over the sea. Mind the gulls.'],
};

/**
 * The bench over THE COVE, by its top-left: three tiles wide and two deep, its
 * back to the path and a row of lawn between it and the sand. West of it two
 * columns of lawn are left clear from the path down to the sand, beside the
 * boutique's wall: the way to THE COVE and its jetty.
 */
export const BENCH = { x: 56, y: 14 } as const;

/**
 * The rowing boats tied up along the quay, each against a wall: two in the
 * corner between the raid jetty and the wharf, and four along the quay under
 * the fish stall and the boutique. They ride the swell as the ships do
 * (`floatingBoats.ts`, each on a swell of its own), which the one pulled up on
 * the sand past the pleasure pier does not.
 */
export const MOORED_ROWING_BOATS: readonly PlantedProp<BasePropName>[] = [
  { name: 'rowBoatBlue', x: 16, y: 20 },
  { name: 'rowBoatRed', x: 20, y: 21 },
  { name: 'rowBoatRed', x: 38, y: 21 },
  { name: 'rowBoatBlue', x: 43, y: 21 },
  { name: 'rowBoatGreen', x: 47, y: 21 },
  { name: 'rowBoatBlue', x: 52, y: 21 },
];

/** Where THE BATTLE ARENA stands (`doors.ts` says it, beside its door). */
export { BATTLE_ARENA_LOT } from './doors';

export const BASE_SIGNS: readonly BaseSign[] = [
  PROMENADE_SIGN,
  GAME_CORNER_SIGN,
  PLEASURE_PIER_SIGN,
  GARDENS_SIGN,
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
  // Down the Day-Care's east fence, a border along the west way up to the library.
  { name: 'THE GREEN’s border', tiles: [[53, 7], [53, 8]] },
  // Either side of THE GREAT LIBRARY's step, at the head of THE GREEN.
  { name: 'THE GREAT LIBRARY’s beds', tiles: [[55, 6], [56, 6], [58, 6], [59, 6]] },
  // Either side of THE GARDENS' bandstand.
  { name: 'THE GARDENS’ beds', tiles: [[101, 6], [102, 6], [101, 7], [107, 6], [108, 6], [108, 7]] },
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
 * the keepers' buildings stand on, the trodden path in front of them
 * (KEEPERS' ROW, two tiles wide), the quay front - Bill's cottage, HARBOUR
 * SQUARE and its fountain, the warehouses and THE HARBOUR BOUTIQUE on one
 * building line, their backs to the row and their doors to the water - and
 * the stone quay under them, three tiles deep from the jetty to THE COVE.
 * And the water, which is a harbour rather than a sea's edge because of what
 * is on it (`landmarks.ts`, `plantQuay`): the ferry at the jetty, the wharf
 * the long pier leaves from with the S.S. Anne at the end of it, and rowing
 * boats tied up along the quay wall. The owner asked for this building line
 * (14 Nov 2026: "better building placement ... it looks a little bit
 * sparse"): the warehouses stood two rows lower with a dead lawn behind them
 * and the boutique was set into the trees at the top of THE GREEN, so the
 * quay had no front and the row had one side. The three tiles of quay under the
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
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT.....TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtT............TtTTtTTtTTtTTtTTtTTTT.....TTTtTTtTTTTTtTTtTTTTT................TtTTtTTTTTtTTtTTTTTtTTtTTTTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTT............TTTTTTTTTTTTTTTTTTTTT.....TTTTT............TTTT............TTT.TTTT........TTTTTT.........TTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTT............TTTTTTTTTTTTTTTTTTTTT.....TTTTT............TTTT................TTTT...........T.......FFFFFFTTTT',
    'TtTTTTtTTTTtTTTTTtTTTT............TTTtTTTTTTTTTTTtTTTT.......TTTT............TtTT.............t..TT...........t.T.......F####FTTTT',
    'TTT...........................................FFFFFFF........................TTTT................TT.............T.......F####FTTTT',
    'TTT...........................................F.....F........................TTTT.......MMMM.....TT.............TTT..vvvF####FTTTT',
    'TtTMMMMMMMMMMM................................F.....F..............MMMMMMM...TTTMMMMMMMMMMMMMMMM.TT.....vv...........vv.F####FTtTT',
    'TTTMMMMMMMMMMM................................F.....F.............MMMMMMMMM..TTTMMMMMMMMMMMMMMMM........vv.......t...vv.F##WWFTTTT',
    'TTTMMMMMMMMMMM................................FFFFFFF.............MMMMMMMMM..TTTMMMMMMMMMMMMMMMM........vv...........vv.FFFFFFTTTT',
    'TtTMMMMMMMMMMM,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM...TTT',
    'TTTMMMMMMMMMMM,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM.t.TTT',
    'TTTMMMMMMMMMMM,,,,,,,,MMMMMMMMMMMMMMMMMMMMMMMM,,MMMMM........MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM...TTT',
    'TtTMMMMMMMMMMM,,,,,,,,MMMMMMMMMMMMMMMMMMMMMMMM,,MMMMM........MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMCCCCPPPPPPPCCCTTT',
    'TTTMMMMMMMMMMM,,,,,,,,MMMMMMMMMMMMMMMMMMMMMMMM,,MMMMM........~~~~~~~~~~~~~~~~~~~~MMMMMMMMMMMMMM~~~~~~~~~~~~~~~~~~CCCCPPPPPPPCCCTTT',
    'WWWMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMddddddd~~~~~~~~~~~~~~~~~~~~~~~___~~~~~~~~~~~~~~~~~~~~~~~~~~CCWWCCCCWWCCCWWWW',
    'WWWMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~___~~~~~~~~~~~~~~~~~~~~~~~~~~WWWWWWWWWWWWWWWWW',
    'WWWMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~___~~~~~~~~~~~~~~~~~~~~~~~~WWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~___~~~~~~~~~~~~~~~~~~~~~~WWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWMMMMMMMMMMMMMMWWWWWWWWWWWWWWWWWWWWWWWMM~~~~~~~~~~~~~~~~~~~~~~~___~~~~~~~~~~~~~WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWMMMMMMMMMMMMMMWWWWWWWWWWWWWWWWWWWWWWWMM~~~~~~~~~~~~~~~~~~~~~~~___~~~WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWMMMWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMWWW~~~~~~~~~~~~~~~~WW________WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMWWWWWWWWWW~~~~~~WWWWW________WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMWWWWWWWWWWWWWWWWWWWWWWW___WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMWWWWWWWWWWWWWWWWWWWWWWW___WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMWWWWWWWWWWWWWWWWWWW___________WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMWWWWWWWWWWWWWWWWWWW___________WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMWWWWWWWWWWWWWWWWWWW___________WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMMMMMMMMMMMMMMMMMMMWWWWWWWWWWWWWWWWWWW___________WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMMMMMMMMMMMMMMMMMMMWWWWWWWWWWWWWWWWWWW___________WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
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
  // beside the jetty; the warehouses on the quay front; Vermilion's long
  // pier running out to the S.S. Anne. The pier stands on HARBOUR SQUARE's
  // own line: its walkway is the three tiles under the fountain and between
  // the square's two lamps, so the ship is at the end of the view from the row.
  map.plant(25, 20, 'shipPier');
  // The wharf the pier leaves from: posts along its edge to tie up to either
  // side of the pier's foot, and one at its west corner. They stood a row
  // further in and one tile nearer the pier, where the corner post and the
  // square's planter shut the quay to a pair between them.
  for (const x of [24, 32, 33]) {
    map.plant(x, 21, 'mooringPost');
  }
  map.plant(22, 20, 'mooringPost');
  // Cargo, each pile against one wall and off every way: two barrels against
  // the warehouses' west gable, where HARBOUR SQUARE's paving runs up to it;
  // a stack of crates on the wharf's east corner, behind the mooring posts,
  // where the dock worker and his Machop stack it; and THE TRADER's stock
  // beside him, against the Center's wall (`plantQuay`). The stacks stood at
  // the warehouses' east end on a corner of lawn, which is the lane down to
  // the docks now.
  map.plant(35, 14, 'barrel');
  map.plant(35, 16, 'barrel');
  map.plant(34, 21, 'crateStack');
  plantQuay(map);
  // THE COVE, past the boutique: a strip of beach under the bench's lawn,
  // with a jetty to fish off and rocks out in the water.
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
  // warehouses (`harbourLife.ts` has the porter minding them). The
  // forecourt's other corner is a statue, a gap, a barrel and a cottage.
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

  // HARBOUR SQUARE, in the middle of the quay front: a paved square round a
  // fountain, with the keepers' path along the top of it, the warehouses'
  // gable closing its east side and the quay along the bottom, so it is
  // crossed on the way to everything (`plantQuay` lights its way out).
  map.plant(27, 14, 'stoneFountain');
  map.plant(SQUARE_MAP.x, SQUARE_MAP.y, 'townMap');

  // THE GREEN, past the Day-Care: THE GREAT LIBRARY at its head with a
  // fountain on its door's own line, two rows of lawn between them, a way up
  // either side of the fountain and its sign at the foot. The library shared
  // the top of the lawn with the boutique and stood behind the DERBY's board;
  // the wood is closed behind the board now. KEEPERS' ROW's gravel runs on
  // under THE GREEN to THE PROMENADE's stone, the straight way east, and
  // nothing stands on it. The bench is on the lawn south of the row, over
  // THE COVE's sand, with the jetty and the bay in front of it.
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
 * What makes the quay a working one, and the harbour full (the owner, 14 Nov
 * 2026: "it looks a little bit sparse"): the things a harbour has standing
 * about on it, each against an edge - a wall, the water, a kerb - and none of
 * them on a way (`harbourWalkable.test.ts` walks every way two abreast,
 * `harbourLooks.test.ts` holds how full it is). The quay's own things are
 * drawn for it (`scripts/draw-promenade.mjs`, "The quay").
 */
function plantQuay(map: MapSketch<BasePropName>): void {
  // HARBOUR SQUARE's south side: a planter and a lamp either side of the way
  // out onto the quay, three tiles wide under the fountain, with the long
  // pier straight ahead. A pair walks the quay below them; either side of
  // the planters the square is open to it.
  map.plant(24, 17, 'troughBlue');
  map.plant(26, 17, 'promenadeLamp');
  map.plant(30, 17, 'promenadeLamp');
  map.plant(31, 17, 'troughBlue');
  // The fish stall, a lean-to against the warehouses' wall between their two
  // doors, with the catch on ice and a net hung out to dry beside the second
  // door (`harbourLife.ts` has the fishmonger and the Meowth). Each takes one
  // row of the quay (`promenadeLeanTo`), so the two rows along the water are
  // the way from the jetty to THE COVE.
  map.plant(38, 18, 'fishStall');
  map.plant(43, 18, 'fishCrate');
  map.plant(44, 18, 'netRack');
  // The boutique's front: a planter under its window and a lamp at the end
  // of it. The tile west of its step is left open: with a lamp there the
  // step had one way off it, and a regular knocking at the door was shut in
  // by the next one to walk up (`harbourRegulars.test.ts`).
  map.plant(50, 18, 'troughRed');
  map.plant(52, 18, 'promenadeLamp');
  // Rowing boats, each tied up against a wall (`MOORED_ROWING_BOATS`), and
  // one pulled up on the sand past the pleasure pier.
  for (const boat of MOORED_ROWING_BOATS) {
    map.plant(boat.x, boat.y, boat.name);
  }
  map.plant(61, 17, 'rowBoatBlue');
  map.plant(62, 19, 'ropeCoil');
  // Gear at the water's edge: lobster pots on the corner of the quay, an
  // anchor on the wharf's, and a coil of rope where the Seagallop ties up.
  map.plant(21, 19, 'lobsterPots');
  map.plant(22, 22, 'anchor');
  map.plant(8, 19, 'ropeCoil');
  // THE TRADER's stock, against the Center's west wall beside where he
  // stands: the crates and the sack from the warehouses' end and a barrel.
  // The lawn's two columns nearest the forecourt are left clear to reach him.
  map.plant(15, 7, 'crateStack');
  map.plant(16, 9, 'sack');
  map.plant(16, 10, 'barrel');
}

/**
 * THE PROMENADE, past THE GREEN: a seaside front round a bay, walked from the
 * town end to the wild end in four places, each about a screen wide and each
 * with one thing you would name it by (the owner, 25 Nov 2026: "more spread
 * out and beautiful, and more like a human would make it. Make it make
 * sense"; `docs/screens/promenade-bay/`).
 *
 * - **The sport end**, nearest the town: the DERBY's gantry over the race's
 *   chequered start line, and THE BATTLE ARENA set back on a forecourt where
 *   a crowd would wait, with its colours either side of the door.
 * - **PIER SQUARE**, the heart: THE GAME CORNER and its prize window across
 *   the head of the square, the pleasure pier leaving from its foot on the
 *   arcade door's own line, so the view out of the arcade runs down the pier
 *   to the FISHING DERBY's board, and the ice cream where the crowd is.
 * - **THE GARDENS**, the quiet middle: a bandstand on a lawn up a gravel path,
 *   benches round it, and the beach huts on the sand against the walk's rail.
 * - **THE POINT**, the wild end: the walk climbs off the stone onto a grassy
 *   point with THE FIELD-MOVE COURSE's gate and its ground fenced off beside
 *   it, a lookout bench over the sea, and the rocks below, where the tide
 *   leaves what it brings in.
 *
 * The beach is a bay: widest under the sport end, narrowing past the pier to
 * the cove of rocks under the point. The walk is stone three wide the whole
 * way, railed along its sea edge with the sand below, and a pair walks its
 * two landward rows with nothing on them.
 */
/**
 * What stands along the walk's seaward edge (row 14), by x: never across
 * the DERBY's way up from the sand (x 69), the pier's gate under its arch
 * (84-87) or the end of the walk at THE POINT. On the walk's landward row
 * they stood across a pair's way up to every door north of it.
 */
const KERB: readonly (readonly [number, BasePropName])[] = [
  // The walk's one row of lamps, about every six tiles, with benches between.
  [63, 'promenadeLamp'],
  [65, 'seaBench'],
  [71, 'promenadeLamp'],
  [73, 'seaBench'],
  [77, 'promenadeLamp'],
  [81, 'troughRed'],
  [88, 'troughYellow'],
  [93, 'seaBench'],
  [95, 'promenadeLamp'],
  [99, 'seaBench'],
  [103, 'promenadeLamp'],
  [107, 'seaBench'],
  [109, 'promenadeLamp'],
  [115, 'promenadeLamp'],
];

function plantPromenade(map: MapSketch<BasePropName>): void {
  // --- The sport end ----------------------------------------------------
  // The race's start, painted across the walk under the gantry.
  for (const y of [12, 13, 14]) map.plant(DERBY_START_X, y, 'startLine');
  map.plant(PROMENADE_SIGN.x, PROMENADE_SIGN.y, 'homeSign');
  // THE BATTLE ARENA's colours either side of its door, and benches across
  // its forecourt facing it, where the crowd for the next bout waits.
  map.plant(66, 8, 'pennantRed');
  map.plant(73, 8, 'pennantBlue');
  map.plant(65, 10, 'troughRed');
  map.plant(74, 10, 'troughYellow');

  // Along the walk's seaward edge: a lamp now and then, benches turned to
  // the sea and planters, on its bottom row - a pair walks the two above,
  // straight on from KEEPERS' ROW's gravel, and the way up to every door
  // and down to the beach is left open.
  for (const [x, prop] of KERB) map.plant(x, 14, prop);

  // --- PIER SQUARE -----------------------------------------------------
  map.plant(GAME_CORNER_SIGN.x, GAME_CORNER_SIGN.y, 'homeSign');
  // Lamps either side of the arcade door's line, the way down to the pier.
  map.plant(83, 10, 'promenadeLamp');
  map.plant(87, 10, 'promenadeLamp');
  map.plant(93, 9, 'seaBench');
  map.plant(93, 11, 'troughBlue');
  // The pier's gate at the square's foot, under its arch on the arcade
  // door's own line: a lamp either side, its sign, the
  // rail along the square's edge over the sand, and the ice-cream cart. East
  // of the gate a step goes down onto the sand beside the pier.
  map.plant(PLEASURE_PIER_SIGN.x, PLEASURE_PIER_SIGN.y, 'homeSign');
  map.plant(82, 16, 'promenadeLamp');
  map.plant(83, 16, 'pierArch');
  map.plant(88, 16, 'promenadeLamp');
  map.plant(89, 15, 'iceCart');
  for (const x of [92, 93, 94]) map.plant(x, 16, 'railing');

  // --- The walk's sea edge -----------------------------------------------
  // A railing along the walk's seaward edge, the sand up against it below,
  // broken only where steps go down to the beach: by THE DIG, beside the
  // pier, between the huts and at the cove under THE POINT. It was a
  // boardwalk once, a second walk beside the first that nothing stood on.
  const steps = new Set([68, 69, 78, 79, 105, 106, 111, 112]);
  for (const x of [...Array.from({ length: 20 }, (_, i) => 61 + i), ...Array.from({ length: 18 }, (_, i) => 95 + i)]) {
    if (!steps.has(x)) map.plant(x, 15, 'railing');
  }
  // The huts on the sand against the rail, in a terrace of four and a pair,
  // steps down to the sand between them, painted as their owners chose
  // rather than in the rainbow's order.
  const HUTS: readonly (readonly [number, BasePropName])[] = [
    [97, 'hutBlue'],
    [99, 'hutRed'],
    [101, 'hutTeal'],
    [103, 'hutYellow'],
    [107, 'hutGreen'],
    [109, 'hutPink'],
  ];
  for (const [x, hut] of HUTS) map.plant(x, 16, hut);

  // --- The beach --------------------------------------------------------
  // A family's corner by the breakwater, THE DIG on the widest sand with a
  // castle beside it, and a parasol or two past the pier.
  map.plant(64, 18, 'parasolRed');
  map.plant(64, 20, 'deckchairRed');
  map.plant(65, 20, 'deckchairBlue');
  map.plant(73, 18, 'parasolBlue');
  map.plant(75, 19, 'deckchairBlue');
  map.plant(72, 20, 'sandcastle');
  map.plant(67, 20, 'sandcastle');
  map.plant(88, 18, 'deckchairBlue');
  map.plant(88, 20, 'parasolBlue');
  map.plant(72, 24, 'sandcastle');
  map.plant(74, 24, 'rowBoatGreen');
  map.plant(64, 23, 'wetRock');
  map.plant(81, 20, 'deckchairYellow');
  map.plant(82, 18, 'deckchairRed');
  map.plant(83, 18, 'deckchairYellow');
  map.plant(90, 18, 'parasolYellow');
  map.plant(92, 19, 'deckchairYellow');
  map.plant(93, 20, 'rowBoatRed');
  // A family's camp under the huts: a parasol and their chairs.
  map.plant(99, 19, 'parasolRed');
  map.plant(101, 19, 'deckchairRed');
  map.plant(102, 19, 'deckchairBlue');
  // Rocks at the water's edge, off the line any race swims.
  map.plant(61, 24, 'wetRock');
  map.plant(67, 24, 'wetRock');
  map.plant(77, 24, 'wetRock');
  map.plant(80, 23, 'wetRock');
  map.plant(97, 22, 'wetRock');
  map.plant(110, 20, 'wetRock');
  map.plant(113, 18, 'wetRock');

  // --- The pleasure pier ------------------------------------------------
  // Half way out, a stop: a bench on its east side, turned to the sea, and a
  // fisherman at its end (`harbourLife.ts`), and its west side left open,
  // where the beach steps up onto it; at its head the FISHING
  // DERBY's board on the pier's own line, pennants, a lifebuoy and a lamp.
  map.plant(87, 24, 'seaBench');
  map.plant(82, 23, 'lifebuoy');
  map.plant(80, 27, 'pennantRed');
  map.plant(90, 27, 'pennantBlue');
  map.plant(80, 29, 'promenadeLamp');
  map.plant(90, 29, 'promenadeLamp');
  map.plant(83, 30, 'lifebuoy');
  // Gear for the FISHING DERBY: a crate of the catch by its board, and pots.
  map.plant(82, 29, 'fishCrate');
  map.plant(88, 30, 'lobsterPots');
  for (let x = 80; x <= 90; x += 1) map.plant(x, 31, 'railing');

  // --- THE GARDENS ------------------------------------------------------
  map.plant(103, 5, 'bandstand');
  map.plant(100, 9, 'bench');
  map.plant(107, 9, 'bench');
  map.plant(GARDENS_SIGN.x, GARDENS_SIGN.y, 'homeSign');
  map.plant(97, 10, 'troughPink');
  map.plant(110, 11, 'troughRed');

  // --- THE POINT --------------------------------------------------------
  // The course's ground behind its fence, seen from its gate: scrub to CUT
  // and rocks to SMASH. It is run on its own screen
  // (`scenes/FieldCourseScene.ts`), so nobody walks in; it is all scrub
  // under the rocks, and no patch of it is ground nobody can reach.
  map.plant(122, 6, 'rock');
  map.plant(124, 8, 'rock');
  map.plant(121, 9, 'rock');
  // The lookout where the walk ends: a railing round the paving over the
  // rocks, a bench either side of a telescope, and the bay in front of them.
  for (const x of [117, 118, 119, 121, 122, 123]) map.plant(x, 16, 'railing');
  map.plant(115, 11, 'troughYellow');
  map.plant(118, 15, 'seaBench');
  map.plant(120, 16, 'coinTelescope');
  map.plant(122, 15, 'seaBench');
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
