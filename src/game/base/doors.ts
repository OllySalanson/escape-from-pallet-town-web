import { BOUTIQUE_NAME } from '../look/wearables';
import { GREAT_LIBRARY_NAME } from '../library/books';
import type { Direction, GridPosition } from '../movement/gridMovement';
import type { CastCharacterDesignId } from '../world/characterDesigns';
import type { BasePropName } from './baseTileset';

/**
 * The buildings in the base, and how you get into each: the four keepers'
 * and THE BOLTHOLE, the player's own house.
 *
 * A screen is behind a room now, and the room is behind a door. What was a
 * list of four cards on a lobby is four buildings round a yard: walking onto a
 * doorway takes the player inside (`rooms.ts`), where the keeper stands and
 * the thing the player built is on show, and the keeper's screen is one key
 * from the door mat. So the door and the room behind it are authored together
 * - a door names its room by sharing its id - and the scene only has to ask
 * which door a tile belongs to.
 *
 * THE RAID ARENA's opens on the great hall (`arenaHall.ts`), which is the only
 * way into a raid: its trailer plays on the way (`cutscene/arenaIntro.ts`).
 *
 * Nobody stands in the yard any more. The four keepers used to wait outside
 * their own doors because there was nowhere else for them to be; they are
 * inside now, behind their counters, which is where a player walking in looks
 * for them. Bill has a door for the first time: his cottage stands at the head
 * of the jetty the boat ties up to, because the first thing a raid that went
 * well wants is him.
 */

/**
 * Which screen a door leads to. `HubScene` is the one place these are rendered.
 * `arena` is the raid itself: everything before one is done on its floor, and it is the
 * only way into a raid. `lab` is Oak's room, where the contract board and the
 * wall map are read.
 */
export type BaseScreen =
  | 'lab'
  | 'arena'
  | 'stash'
  | 'workshop'
  | 'trader'
  | 'boutique'
  | 'game-corner'
  | 'prizes'
  | 'battle-arena';

export interface BaseKeeper {
  readonly id: string;
  /** What the caption calls them. */
  readonly name: string;
  readonly design: CastCharacterDesignId;
  readonly position: GridPosition;
  readonly facing: Direction;
}

export interface BaseBuilding {
  readonly prop: BasePropName;
  /** Top-left of the prop, as `MapSketch.plant` takes it. */
  readonly x: number;
  readonly y: number;
}

export interface BaseDoor {
  /** Also the id of the room behind it (`rooms.ts`). */
  readonly id: string;
  /** The keeper's screen behind it, or null for the player's own house. */
  readonly screen: BaseScreen | null;
  /**
   * The name over it, which is also the name of the room and the screen behind
   * it. A building captioned one thing opening onto a screen headed another
   * reads as two places, so `HubScene.heading` says the same words.
   */
  readonly name: string;
  readonly building: BaseBuilding;
  /**
   * Every tile that opens it. A doorway cut two cells wide opens from either,
   * because a player walking at a building should not have to find the middle
   * of it.
   */
  readonly tiles: readonly GridPosition[];
  /** Where the player is put down when they come back out. */
  readonly returnTo: GridPosition;
}

/**
 * Where THE BATTLE ARENA stands: FireRed's Fighting Dojo, 6x5, at the head of
 * THE PROMENADE where its garden was, its door at the foot of its middle and
 * its name painted onto its front by `scripts/draw-promenade.mjs`, as THE GAME
 * CORNER's is. A tile clear of the DERBY's board on its west: the board's leg
 * stood against its wall, and the two read as one thing.
 */
export const BATTLE_ARENA_LOT = { x: 65, y: 8, width: 6, height: 5, door: { x: 68, y: 12 } } as const;

export const BASE_DOORS: readonly BaseDoor[] = [
  {
    // The way into every raid: a FireRed Gym on its own stone forecourt at
    // the west end of the harbour, between statues and under its banners. It
    // stands nearest the jetty, because coming home and going back out is the
    // loop the harbour is walked for.
    id: 'raid-arena',
    screen: 'arena',
    name: 'RAID ARENA',
    building: { prop: 'raidArena', x: 5, y: 8 },
    tiles: [{ x: 8, y: 12 }],
    returnTo: { x: 8, y: 13 },
  },
  {
    id: 'pokemon-centre',
    screen: 'stash',
    name: 'POKÉMON CENTER',
    building: { prop: 'pokemonCentre', x: 17, y: 7 },
    tiles: [{ x: 19, y: 11 }],
    returnTo: { x: 19, y: 12 },
  },
  {
    id: 'oaks-lab',
    screen: 'lab',
    name: 'OAK’S LAB',
    building: { prop: 'oakLab', x: 24, y: 8 },
    tiles: [
      { x: 25, y: 11 },
      { x: 26, y: 11 },
    ],
    returnTo: { x: 25, y: 12 },
  },
  {
    id: 'brocks-workshop',
    screen: 'workshop',
    name: 'BROCK’S WORKSHOP',
    building: { prop: 'workshop', x: 30, y: 8 },
    tiles: [{ x: 31, y: 11 }],
    returnTo: { x: 31, y: 12 },
  },
  {
    id: 'bills-cottage',
    screen: 'trader',
    name: 'BILL’S COTTAGE',
    // On the yard's edge beside the jetty, with its door on the quay: four
    // steps from where the boat puts a raid down.
    building: { prop: 'billsCottage', x: 13, y: 15 },
    tiles: [{ x: 14, y: 17 }],
    returnTo: { x: 14, y: 18 },
  },
  {
    // The player's own house, at the end of the row the keepers stand in, with
    // its window boxes and its own patch of garden. It is not on the way to
    // re-kitting, so it is not held to the keepers' walk; it is a stroll up
    // the yard, and in view from the middle of it.
    id: 'bolthole',
    screen: null,
    name: 'THE BOLTHOLE',
    building: { prop: 'bolthole', x: 36, y: 7 },
    tiles: [{ x: 37, y: 10 }],
    // The step between the window boxes.
    returnTo: { x: 37, y: 11 },
  },
  {
    // THE HARBOUR BOUTIQUE (`look/wearables.ts`): Vermilion's Pokémon Fan
    // Club, green awning and all, on the quay front past the warehouses, on
    // their building line, with its door to the water and THE COVE beside it.
    // It was set into the trees at the top of THE GREEN, five rows back from
    // any path: a shop belongs where the trade is (the owner, 14 Nov 2026:
    // "better building placement"). It is not on the way to a raid, so it is
    // not held to the keepers' walk: it is somewhere to go when a raid has paid.
    id: 'boutique',
    screen: 'boutique',
    name: BOUTIQUE_NAME,
    building: { prop: 'boutique', x: 48, y: 14 },
    tiles: [{ x: 49, y: 17 }],
    returnTo: { x: 49, y: 18 },
  },
  {
    // THE GAME CORNER (`gameCorner.ts`), out along THE PROMENADE: Celadon's own,
    // its front lit GAME CORNER. The hall under the purple arch is the arcade,
    // where the cabinets are; the little building beside it is the prize
    // window, which has its own door, as Celadon's prize room is across the
    // street from the Game Corner. Like the boutique it is somewhere to go,
    // not a re-kit stop, so it is held to a walk of its own.
    id: 'game-corner',
    screen: 'game-corner',
    name: 'GAME CORNER',
    building: { prop: 'gameCorner', x: 73, y: 6 },
    tiles: [{ x: 76, y: 10 }],
    returnTo: { x: 76, y: 11 },
  },
  {
    id: 'prize-window',
    screen: 'prizes',
    name: 'PRIZE WINDOW',
    building: { prop: 'prizeWindow', x: 80, y: 6 },
    tiles: [{ x: 81, y: 9 }],
    returnTo: { x: 81, y: 10 },
  },
  {
    // THE GREAT LIBRARY (`../library/`): a portico of its own at the head of
    // THE GREEN, alone in a notch of the wood, its door on the line of the
    // lawn's fountain with two rows of lawn between them, and books that teach
    // the harbour lying open on lecterns inside. It stood east of that line
    // beside the boutique, behind the DERBY's board. Somewhere to go, not a
    // re-kit stop, so it is held to a walk of its own.
    id: 'great-library',
    screen: null,
    name: GREAT_LIBRARY_NAME,
    building: { prop: 'greatLibrary', x: 55, y: 2 },
    tiles: [{ x: 57, y: 5 }],
    returnTo: { x: 57, y: 6 },
  },
  {
    // THE BATTLE ARENA (`../arena/`): Saffron's Fighting Dojo on its lot at the
    // head of THE PROMENADE, its name painted over its door
    // (`scripts/draw-promenade.mjs`). Bouts for sport, chosen at its counter.
    id: 'battle-arena',
    screen: 'battle-arena',
    name: 'BATTLE ARENA',
    building: { prop: 'battleArena', x: BATTLE_ARENA_LOT.x, y: BATTLE_ARENA_LOT.y },
    tiles: [{ x: BATTLE_ARENA_LOT.door.x, y: BATTLE_ARENA_LOT.door.y }],
    returnTo: { x: BATTLE_ARENA_LOT.door.x, y: BATTLE_ARENA_LOT.door.y + 1 },
  },
];

/**
 * The doors that are somewhere to go rather than somewhere a raid re-kits:
 * the boutique and THE GAME CORNER's two. They are held to walks of their own
 * (`baseMap.test.ts`), not the keepers' short stroll.
 */
export const PLACES_TO_GO: readonly string[] = ['boutique', 'game-corner', 'prize-window', 'battle-arena', 'great-library'];

export function doorAt(tile: GridPosition): BaseDoor | undefined {
  return BASE_DOORS.find((door) =>
    door.tiles.some((doorway) => doorway.x === tile.x && doorway.y === tile.y),
  );
}

export function doorNamed(id: string): BaseDoor | undefined {
  return BASE_DOORS.find((door) => door.id === id);
}
