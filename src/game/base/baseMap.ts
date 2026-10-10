import type { GridPosition } from '../movement/gridMovement';
import { MapSketch } from '../world/mapGrid';
import { buildMapLayers, type MapLayers } from '../world/tiles';
import type { Material } from '../world/tileset/materials';
import { BASE_TILESET, type BasePropName } from './baseTileset';
import { BASE_DOORS } from './doors';
import { standingFixtures } from './fixtures';

/**
 * THE HARBOUR - the one map in the game nobody is hunting you on.
 *
 * (Every building on it can be walked into: see `rooms.ts`.)
 *
 * The lobby used to be a list of four cards. This is the same four places as a
 * town you walk around: Oak's Lab for the raid, the Pokémon Center for the
 * team, Brock's Workshop for the base, and the quay where Bill takes what you
 * dragged home. Everything the screens do is untouched - what changed is that
 * you reach one by walking to its door instead of choosing its row.
 *
 * It is small on purpose and the size is the design. A player re-kits between
 * raids many times an hour, so the walk has to stay a pleasure rather than
 * become a corridor: the three doors sit in one row across the head of one
 * yard, the quay is below it, and nothing is more than **seven steps** from
 * where the player is put down (`baseMap.test.ts` holds that, with every
 * fixture built and every keeper standing). At 150ms a tile that is about a
 * second. The room the map does have goes sideways, into the frontage the
 * things you build stand on - the west side for the healing machines and the
 * ward, the east for the mast, the quay for the lockers and the lamp house.
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

export const BASE_MAP_WIDTH = 35;
export const BASE_MAP_HEIGHT = 21;

/** What the screens call this place, on the way out of every one of them. */
export const BASE_PLACE_NAME = 'The Harbour';

/**
 * Where the player stands when they walk in off the title screen: the middle of
 * the yard, with all three doors in view and two steps from Oak's.
 */
export const BASE_SPAWN: GridPosition = { x: 16, y: 13 };

/**
 * And where a raid puts them down: the head of the jetty their boat is tied to,
 * facing up the yard. Coming home is the one moment the base is meant to be
 * looked at rather than crossed, and it lands the player beside Bill, who is
 * the first thing a raid that went well wants.
 */
export const BASE_LANDING: GridPosition = { x: 16, y: 17 };

/** Something on a post that says something when faced: a board, a house's sign. */
export interface BaseSign {
  readonly x: number;
  readonly y: number;
  readonly lines: readonly string[];
}

/**
 * The harbour's own board, on the quay where the boat ties up, because that is
 * where a player who has just come home is standing.
 */
export const NOTICE_BOARD: BaseSign = {
  x: 14,
  y: 15,
  lines: [
    `${BASE_PLACE_NAME.toUpperCase()} - what the raids are run out of.`,
    'OAK kits you out. JOY patches the team up. BROCK builds onto the base, and BILL takes what you drag home.',
    'THE BOLTHOLE, at the end of the row, is yours.',
  ],
};

/** The sign in THE BOLTHOLE's front garden, beside the path up to the step. */
export const HOME_SIGN: BaseSign = {
  x: 27,
  y: 12,
  lines: ['THE BOLTHOLE', 'Home. Nobody hunts you here.'],
};

export const BASE_SIGNS: readonly BaseSign[] = [NOTICE_BOARD, HOME_SIGN];

/** FireRed's red flowers in the front garden, either side of the path. */
const GARDEN_FLOWERS: readonly (readonly [number, number])[] = [28, 29, 30, 31].flatMap(
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
 * the buildings stand on, the trodden earth of the yard in front of them, the
 * stone quay, and the water. Earth for the yard and stone for the quay because
 * the two have to tell each other apart at a glance - paving on this sheet is a
 * flat pale slab with nothing in it, and a yard drawn in it read as a blank
 * grey rectangle across the middle of the base. `t` is a tree, and every one of
 * them stands inside the wood so that no crown hangs over ground anybody can
 * stand on. The first row of them stands three rows down rather than two: the
 * top of a crown is drawn in the row above its tree (`PropDefinition.brim`),
 * and a tree any higher has the edge of the map slice it flat.
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
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTTtTT',
    'TTT......TTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTT......TTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TtT......TTtTTTtTTTtTTTtTTTtTTTTTTT',
    'TTT...........TTTTTTTTTTT.......TTT',
    'TTT...........T....T....T.......TTT',
    'TtT...........T....T....T.......TTT',
    'TTT...........T....T....T.......TTT',
    'TTT...,,,,,,,,,,,,,,,,,,,.......TTT',
    'TtT...,,,,,,,,,,,,,,,,,,,.......TTT',
    'TTT...,,,,,,,,,,,,,,,,,,,.......TTT',
    'TTT...,,,,,,,,,,,,,,,,,,,.......TtT',
    'WWWMMMMMMMMMMMMMMMMMMMMMMMMMMMMMWWW',
    'WWWMMMMMMMMMMMMMMMMMMMMMMMMMMMMMWWW',
    'WWWMMMMMMMMMMMMMMMMMMMMMMMMMMMMMWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
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
  map.plant(15, 17, 'jetty');
  map.plant(17, 17, 'jetty');
  map.plant(12, 15, 'crateStack');
  map.plant(14, 15, 'noticeBoard');
  map.plant(22, 15, 'barrelPair');
  map.plant(24, 15, 'mooringPost');

  // THE BOLTHOLE's front garden: its sign beside the path to the step, and
  // FireRed's red flowers either side of it.
  map.plant(HOME_SIGN.x, HOME_SIGN.y, 'homeSign');
  for (const [x, y] of GARDEN_FLOWERS) {
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
