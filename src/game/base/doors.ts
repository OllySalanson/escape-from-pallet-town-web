import type { Direction, GridPosition } from '../movement/gridMovement';
import type { CastCharacterDesignId } from '../world/characterDesigns';
import type { BasePropName } from './baseTileset';

/**
 * The four buildings in the base, and how you get into each.
 *
 * A screen is behind a room now, and the room is behind a door. What was a
 * list of four cards on a lobby is four buildings round a yard: walking onto a
 * doorway takes the player inside (`rooms.ts`), where the keeper stands and
 * the thing the player built is on show, and the keeper's screen is one key
 * from the door mat. So the door and the room behind it are authored together
 * - a door names its room by sharing its id - and the scene only has to ask
 * which door a tile belongs to.
 *
 * Nobody stands in the yard any more. The four keepers used to wait outside
 * their own doors because there was nowhere else for them to be; they are
 * inside now, behind their counters, which is where a player walking in looks
 * for them. Bill has a door for the first time: his cottage stands at the head
 * of the jetty the boat ties up to, because the first thing a raid that went
 * well wants is him.
 */

/** Which screen a room's keeper opens. `HubScene` is the one place these are rendered. */
export type BaseScreen = 'raid' | 'stash' | 'workshop' | 'trader';

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
  readonly screen: BaseScreen;
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

export const BASE_DOORS: readonly BaseDoor[] = [
  {
    id: 'oaks-lab',
    screen: 'raid',
    name: 'OAK’S LAB',
    building: { prop: 'oakLab', x: 15, y: 8 },
    tiles: [
      { x: 16, y: 11 },
      { x: 17, y: 11 },
    ],
    returnTo: { x: 16, y: 12 },
  },
  {
    id: 'pokemon-centre',
    screen: 'stash',
    name: 'POKÉMON CENTER',
    building: { prop: 'pokemonCentre', x: 9, y: 7 },
    tiles: [{ x: 11, y: 11 }],
    returnTo: { x: 11, y: 12 },
  },
  {
    id: 'brocks-workshop',
    screen: 'workshop',
    name: 'BROCK’S WORKSHOP',
    building: { prop: 'workshop', x: 20, y: 7 },
    tiles: [
      { x: 21, y: 11 },
      { x: 22, y: 11 },
    ],
    returnTo: { x: 21, y: 12 },
  },
  {
    id: 'bills-cottage',
    screen: 'trader',
    name: 'BILL’S COTTAGE',
    // On the yard's edge beside the jetty, with its door on the quay: four
    // steps from where the boat puts a raid down.
    building: { prop: 'billsCottage', x: 17, y: 13 },
    tiles: [{ x: 18, y: 15 }],
    returnTo: { x: 18, y: 16 },
  },
];

export function doorAt(tile: GridPosition): BaseDoor | undefined {
  return BASE_DOORS.find((door) =>
    door.tiles.some((doorway) => doorway.x === tile.x && doorway.y === tile.y),
  );
}

export function doorNamed(id: string): BaseDoor | undefined {
  return BASE_DOORS.find((door) => door.id === id);
}
