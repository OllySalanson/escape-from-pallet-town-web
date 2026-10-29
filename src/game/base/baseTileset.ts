import { withDoorway, type PropDefinition, type TilesetCatalogue } from '../world/tileset/catalogue';
import { pieceTile, BASE_SHEET_SOURCE } from './baseSheet';
import {
  FLOOD_TOWN_TILESET,
  type FloodTownPropName,
} from '../world/tileset/floodTownTileset';
import { KANTO_TILESET } from '../world/tileset/kantoTileset';
import { TOWN_PROPS, TOWN_SHEET_SOURCE } from '../world/tileset/townSheet';
import { TILE_ANIMATION_SOURCE } from '../world/tileAnimation';
import {
  RAID_ARENA_BANNERS,
  RAID_ARENA_BUILDING,
  RAID_ARENA_RUNNER,
  RAID_ARENA_RUNNER_FOOT,
  RAID_ARENA_RUNNER_HEAD,
  RAID_ARENA_SHEET_SOURCE,
  RAID_ARENA_STATUE,
} from './raidArenaSheet';

/**
 * The base is drawn on the same sheet the four raid maps are, with its
 * buildings opened up.
 *
 * A door is the one part of a building that is ground. The shared props are
 * solid edge to edge - they were authored as scenery for maps nobody goes
 * inside - so the base names its own three with the doorway cut out of them,
 * and the player walks into the dark of the opening exactly as they do in the
 * games this is dressed as. A prop is the last word on its own tiles
 * (`buildMapLayers`), so that is the whole of it: no second collision list, and
 * the door cannot drift from the art it is drawn in.
 *
 * Which cell is the doorway was read off the sheet rather than guessed - the
 * shop front's is two cells wide and dead centre, the house's is one cell under
 * its arch, and the boathouse's is the pair under its own.
 */
export type BasePropName =
  | FloodTownPropName
  | 'raidArena'
  | 'arenaBanners'
  | 'arenaRunnerHead'
  | 'arenaRunner'
  | 'arenaRunnerFoot'
  | 'gymStatue'
  | 'oakLab'
  | 'pokemonCentre'
  | 'workshop'
  | 'billsCottage'
  | 'bolthole'
  | 'boutique'
  | 'homeSign'
  | 'gardenFlowers'
  | 'raidFerry'
  | 'ssAnne'
  | 'shipPier'
  | 'warehouses'
  | 'roundFountain'
  | 'townMap';

/**
 * Bill's cottage: a little blue-roofed FireRed house, cut onto the base's own
 * sheet (`scripts/cut-frlg-base.mjs`). The sheet draws its door at the east
 * end; it stands here drawn left for right, so the door is at the end nearest
 * the jetty and the walk from the boat to Bill is four steps rather than eight.
 * FireRed's houses are lit from straight above, so nothing reads backwards.
 */
function mirroredCottage(): PropDefinition {
  const width = 5;
  const height = 3;
  const door = { x: 1, y: 2 };
  return {
    label: 'cottage',
    width,
    height,
    cells: Array.from({ length: width * height }, (_cell, index) => {
      const x = index % width;
      const y = Math.floor(index / width);
      return {
        tile: pieceTile('cottage', width - 1 - x, y),
        solid: !(x === door.x && y === door.y),
        flipX: true,
      };
    }),
  };
}

/**
 * Brock's workshop: a corrugated-iron shed from the FireRed buildings sheet,
 * cut onto the base's own sheet (`scripts/cut-frlg-base.mjs`). It used to be
 * the CC0 sheet's barn, which is only ever drawn from behind - a roof and a
 * blank end wall - so the workshop stood with its back to the yard and a
 * doorway cut into a wall with no door in it.
 */
function workshopShed(): PropDefinition {
  const width = 4;
  const height = 4;
  const door = { x: 1, y: 3 };
  return {
    label: 'workshop',
    width,
    height,
    cells: Array.from({ length: width * height }, (_cell, index) => {
      const x = index % width;
      const y = Math.floor(index / width);
      return { tile: pieceTile('workshop', x, y), solid: !(x === door.x && y === door.y) };
    }),
  };
}

/**
 * A thing that stands in the water: solid in every cell except the ones named,
 * which are the deck or the walkway you stand on. A prop is the last word on
 * its own tiles, so a cell of a ship left walkable is a cell of the sea you
 * could walk out onto - the cut pieces were authored to stand on land, where
 * that did not matter.
 */
function afloat(
  prop: PropDefinition,
  walked: readonly (readonly [number, number])[] = [],
  under: readonly (readonly [number, number])[] = [],
): PropDefinition {
  const open = new Set(walked.map(([x, y]) => y * prop.width + x));
  const roofed = new Set(under.map(([x, y]) => y * prop.width + x));
  return {
    ...prop,
    cells: prop.cells.map((cell, ordinal) =>
      roofed.has(ordinal)
        ? { ...cell, solid: false, canopy: true, walkedUnder: true }
        : { ...cell, solid: !open.has(ordinal) },
    ),
  };
}

export const BASE_TILESET: TilesetCatalogue<BasePropName> = {
  ...FLOOD_TOWN_TILESET,
  // THE COVE's beach is a shoreline, so it draws its surf where it meets the
  // sea and nowhere else: against the green above it and the quay beside it
  // it simply carries on, and the sea gives up its earth bank to it - FireRed
  // draws a beach's waterline in the sand, not under it.
  materials: {
    ...FLOOD_TOWN_TILESET.materials,
    beach: { ...FLOOD_TOWN_TILESET.materials.beach, joins: ['grass', 'turf', 'stone', 'sand', 'earth', 'paving', 'tree', 'hedge'] },
    water: {
      ...FLOOD_TOWN_TILESET.materials.water,
      joins: [...(FLOOD_TOWN_TILESET.materials.water.joins ?? []), 'beach'],
    },
  },
  sources: [
    ...FLOOD_TOWN_TILESET.sources,
    BASE_SHEET_SOURCE.source,
    TOWN_SHEET_SOURCE.source,
    // THE RAID ARENA's own front, its banners and its runner (`raidArenaSheet.ts`).
    RAID_ARENA_SHEET_SOURCE.source,
    // The frames the harbour's sea, surf and flowers move through (`world/tileAnimation.ts`).
    TILE_ANIMATION_SOURCE.source,
  ],
  props: {
    ...FLOOD_TOWN_TILESET.props,
    // 7x5. THE RAID ARENA: Saffron's Gym from FireRed's own town - a Gym is
    // the one building Kanto puts up to fight in, which is what a raid is -
    // made its own by `scripts/draw-raid-arena.mjs`: RAID where the plate said
    // GYM, a badge reading ARENA across the door, the door lit and flags on
    // the roof. Its door is open where the Gym's was.
    raidArena: RAID_ARENA_BUILDING,
    // Its colours either side of the forecourt, and the red runner from its
    // door down between the statues, which is walked on.
    arenaBanners: RAID_ARENA_BANNERS,
    arenaRunnerHead: RAID_ARENA_RUNNER_HEAD,
    arenaRunner: RAID_ARENA_RUNNER,
    arenaRunnerFoot: RAID_ARENA_RUNNER_FOOT,
    // FireRed's own Gym statue, which stands either side of every Gym's door -
    // with RAID on its plinth where it said GYM.
    gymStatue: RAID_ARENA_STATUE,
    // 4x4. The shop front, which is the one building on the FireRed sheet and
    // the only one that reads as an institution rather than as somebody's home.
    oakLab: withDoorway(FLOOD_TOWN_TILESET.props.building, [
      [1, 3],
      [2, 3],
    ]),
    // 5x5: FireRed's own Pokemon Center, red roof and all, with its door open.
    // It used to be the CC0 sheet's timber house - the one building in a
    // FireRed harbour that came from a different game.
    pokemonCentre: KANTO_TILESET.props.pokemonCenterDoor,
    // 4x4. A FireRed shed under a corrugated roof, with its plank door at the
    // west end - the end nearest the lab, so the walk to it stays seven steps.
    workshop: workshopShed(),
    billsCottage: mirroredCottage(),
    // 5x5. THE BOLTHOLE: a FireRed house with window boxes either side of its
    // step, which is the one thing in the harbour that says somebody lives
    // there. Its door is at the west end, the end nearest the yard.
    bolthole: withDoorway(KANTO_TILESET.props.houseFlowers, [[1, 3]]),
    // 5x4. THE HARBOUR BOUTIQUE: Vermilion's Pokémon Fan Club under its
    // green awning, the one building in Kanto that reads as a shopfront.
    boutique: withDoorway(TOWN_PROPS.fanClub, [[1, 3]]),
    // FireRed's own wooden sign, which says whose house a house is.
    homeSign: KANTO_TILESET.props.signTown,
    // FireRed's red flowers, walked through as FireRed's are.
    gardenFlowers: KANTO_TILESET.props.flowers,
    // 4x4. FireRed's Seagallop, the ferry to the islands, tied up at the
    // jetty: the boat every raid goes out on and comes home in.
    raidFerry: afloat(TOWN_PROPS.seagallop),
    // 8x4. The S.S. Anne, moored at the end of the long pier.
    ssAnne: afloat(TOWN_PROPS.ssAnne),
    // 7x8. Vermilion's own pier: the two bollard towers on the quay with a
    // rope between them, the awning the walkway passes under, and the walkway
    // running out over the water - and only the walkway walked, because its
    // sides are sea.
    shipPier: afloat(
      TOWN_PROPS.pier,
      [
        ...[0, 1].flatMap((y) => [3, 4].map((x) => [x, y] as const)),
        ...[4, 5, 6, 7].flatMap((y) => [2, 3, 4].map((x) => [x, y] as const)),
      ],
      [2, 3].flatMap((y) => [2, 3, 4].map((x) => [x, y] as const)),
    ),
    // 10x4. Fuchsia's brick terrace, which on a quay is a row of warehouses.
    warehouses: TOWN_PROPS.brickRow,
    // 3x4. Celadon's round fountain, for THE GREEN, so it is not the same
    // fountain as HARBOUR SQUARE's.
    roundFountain: TOWN_PROPS.roundFountain,
    // FireRed's town map board, which says where everything is.
    townMap: TOWN_PROPS.townMap,
  },
};
