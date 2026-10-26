import type { GridPosition } from '../movement/gridMovement';
import { MapSketch } from '../world/mapGrid';
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

export const BASE_MAP_WIDTH = 64;
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
  ],
};

/**
 * The sign in THE BOLTHOLE's front garden, beside the path up to the step, and
 * the way to knock on another player's door: everybody's house is behind this
 * one door, so this one sign is outside every door in the harbour.
 */
export const HOME_SIGN: BaseSign = {
  x: 38,
  y: 12,
  lines: ['THE BOLTHOLE', 'Home. Nobody hunts you here.'],
  knocks: true,
};

/**
 * The sign on THE GREEN, the lawn past the Day-Care that the harbour grew by
 * when it became the one everybody who plays walks (`harbour/`): somewhere to
 * stand about that is nobody's door.
 */
export const GREEN_SIGN: BaseSign = {
  x: 54,
  y: 12,
  lines: ['THE GREEN', 'Everybody in Pallet Town comes home to this harbour. Stand about - somebody always turns up.'],
};

/** The Raid Arena's own sign, beside the way up to its door. */
export const ARENA_SIGN: BaseSign = {
  x: 12,
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
  lines: ['THE COVE', 'Sand, rocks and a jetty to fish off.'],
};

/** FireRed's town map board, at the corner of HARBOUR SQUARE: where everything is. */
export const SQUARE_MAP: BaseSign = {
  x: 22,
  y: 14,
  lines: [
    'HARBOUR SQUARE - a map of THE HARBOUR.',
    'The RAID ARENA is west, on ARENA SQUARE. The keepers are along KEEPERS\u2019 ROW. THE QUAY and the SEAGALLOP are south.',
    'East along the water: THE DOCKS, THE LONG PIER out to the S.S. ANNE, and THE COVE. THE GREEN is past THE BOLTHOLE.',
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

export const BASE_SIGNS: readonly BaseSign[] = [
  BREAKWATER_SIGN,
  NOTICE_BOARD,
  HOME_SIGN,
  GREEN_SIGN,
  ARENA_SIGN,
  PIER_SIGN,
  COVE_SIGN,
  SQUARE_MAP,
];

/** FireRed's red flowers in the front garden, either side of the path. */
const GARDEN_FLOWERS: readonly (readonly [number, number])[] = [39, 40, 41, 42].flatMap(
  (x) => [12, 13].map((y) => [x, y] as const),
);

export interface BaseMapDefinition {
  readonly width: number;
  readonly height: number;
  readonly layers: MapLayers;
  readonly collision: readonly boolean[][];
  readonly terrain: readonly Material[][];
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
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtT',
    'TTTTTTTTTTTTTTTTTTTTTT............TTTTTTT....TTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTT............TTTTTTT....TTTTTTTTTTTTTTTTTTT',
    'TtTTTTtTTTTtTTTTTtTTTT............TTTtTTT....TTTTtTTTTTtTTTTtTTT',
    'TTT..........................................................TTT',
    'TTT...........................................FFFFFFF........TTT',
    'TtTMMMMMMMMMMM................................F.....F........TTT',
    'TTTMMMMMMMMMMM................................F.....F........TTT',
    'TTTMMMMMMMMMMM................................F.....F........TTT',
    'TtTMMMMMMMMMMM,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,.F.....F........TTT',
    'TTTMMMMMMMMMMM,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,.FFFFFFF........TTT',
    'TTTMMMMMMMMMMM,,,,....MMMMMMMMMMMMM..........................TTT',
    'TtTMMMMMMMMMMM,,,,....MMMMMMMMMMMMM..........................TTT',
    'TTTMMMMMMMMMMM,,,,....MMMMMMMMMMMMM..........................TTT',
    'WWWMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMdddddddddddddTTT',
    'WWWMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM~~~~~~~~~~~~~TTT',
    'WWWMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM~~~~~~~~~~~~~TTT',
    'WWWWWWWWWWWWWWWWWWWWWWMMMMMMMMMMMMMMMMMMMMMMMMMM~~~~~~~~~~~~~WWW',
    'WWWWWWWWWWWWWWWWWWWWWWMMMMMMMMMMMMMMMMMMMMMMMMMMWWWWWWWWWWWMMWWW',
    'WWWWWWWWWWWWWWWWWWWWWWMMMMMMMMMMMMMMMMMMMMMMMMMMWWWWWWWWWWWMMWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMMMMMMMMMMMMMMMMMMMWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWMMMMMMMMMMMMMMMMMMMMMWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
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
  map.plant(30, 17, 'crateStack');

  // The waterfront (`landmarks.ts`): the ferry a raid goes out on, tied up
  // beside the jetty; the warehouses along the east quay; Vermilion's long
  // pier running out to the S.S. Anne.
  map.plant(26, 20, 'shipPier');
  // The working quay: posts along the edge to tie up to, and what came off
  // the boats stacked outside the warehouses.
  for (const x of [23, 35, 44]) {
    map.plant(x, 21, 'mooringPost');
  }
  map.plant(46, 17, 'crateTower');
  map.plant(33, 17, 'sack');
  map.plant(34, 17, 'barrelPair');
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
  map.plant(19, 17, 'barrelPair');
  map.plant(21, 17, 'mooringPost');

  // THE RAID ARENA's forecourt: a pair of statues on the way up from the
  // quay, as every Gym in Kanto has, with the forecourt in front of the door
  // left open so the yard walks straight across to it, its colours hung either side of
  // the building, and its sign. The Gym backs onto lawn because FireRed drew
  // the grass behind it into its roof.
  map.plant(6, 15, 'gymStatue');
  map.plant(10, 15, 'gymStatue');
  map.plant(3, 11, 'bannerPair');
  map.plant(12, 11, 'bannerPair');
  map.plant(ARENA_SIGN.x, ARENA_SIGN.y, 'homeSign');

  // THE BOLTHOLE's front garden: its sign beside the path to the step, and
  // FireRed's red flowers either side of it.
  map.plant(HOME_SIGN.x, HOME_SIGN.y, 'homeSign');
  for (const [x, y] of GARDEN_FLOWERS) {
    map.plant(x, y, 'gardenFlowers');
  }

  // HARBOUR SQUARE, in the middle of the yard: a paved square round a
  // fountain, with the keepers' path running along the top of it and the
  // quay along the bottom, so it is crossed on the way to everything.
  map.plant(27, 14, 'stoneFountain');
  map.plant(SQUARE_MAP.x, SQUARE_MAP.y, 'townMap');

  // THE GREEN, past the Day-Care: a fountain to meet at, a bench, flowers and
  // its sign.
  map.plant(56, 9, 'roundFountain');
  map.plant(56, 13, 'bench');
  map.plant(GREEN_SIGN.x, GREEN_SIGN.y, 'homeSign');
  for (const [x, y] of [[54, 8], [60, 8], [54, 9], [60, 9]] as const) {
    map.plant(x, y, 'gardenFlowers');
  }

  // And what the player has built. Planted last, so a fixture is the last word
  // on its own tiles exactly as a landmark is on a raid map.
  for (const fixture of standingFixtures(builtUpgradeIds)) {
    for (const prop of fixture.props) {
      map.plant(prop.x, prop.y, prop.name);
    }
  }

  return map;
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
  };
  built.set(key, definition);
  return definition;
}
