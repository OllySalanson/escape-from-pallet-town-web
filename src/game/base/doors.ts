import type { Direction, GridPosition } from '../movement/gridMovement';
import type { CastCharacterDesignId } from '../world/characterDesigns';
import type { BasePropName } from './baseTileset';

/**
 * The four places in the base, who keeps each one, and how you get in.
 *
 * A screen is a room now. What was a list of four cards on a lobby is four
 * buildings round a yard, and choosing one is walking to it - so the door and
 * the screen behind it are authored together here, and the scene only has to
 * ask which door a tile belongs to.
 *
 * Two ways in, always, and that is deliberate rather than generous. **Stepping
 * onto a doorway opens it**, the way a door works in the games this is dressed
 * as; and **speaking to the keeper opens it too**, because a figure standing in
 * the yard is what says which building is which, and walking up to somebody and
 * pressing the key is the one verb this game has always had. Neither costs a
 * line of dialogue first: the base is walked through many times an hour, and a
 * keypress that only says hello is a toll by the fourth raid.
 *
 * The quay has no door because a quay has none: Bill is the way in, standing by
 * his crates at the head of the jetty the boat is tied to.
 *
 * All four are drawn from their own sheets (`world/characterDesigns.ts`), which
 * is the same art the screens behind their doors put a face on - so the person
 * in the yard and the person on the screen are one piece of art at one scale.
 */

/** Which screen a door opens. `HubScene` is the one place these are rendered. */
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
  readonly id: string;
  readonly screen: BaseScreen;
  /**
   * The name over it, which is also the name of the screen behind it. A
   * building captioned one thing opening onto a screen headed another reads as
   * two places, so `HubScene.heading` says the same words.
   */
  readonly name: string;
  /** Omitted by the quay, which is open air. */
  readonly building?: BaseBuilding;
  /**
   * Every tile that opens it. A doorway cut two cells wide opens from either,
   * because a player walking at a building should not have to find the middle
   * of it. Empty where there is no door - see the quay.
   */
  readonly tiles: readonly GridPosition[];
  /** Where the player is put down when they come back out. */
  readonly returnTo: GridPosition;
  readonly keeper: BaseKeeper;
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
    keeper: {
      id: 'oak',
      name: 'PROFESSOR OAK',
      design: 'prof-oak',
      position: { x: 15, y: 12 },
      facing: 'down',
    },
  },
  {
    id: 'pokemon-centre',
    screen: 'stash',
    name: 'POKÉMON CENTER',
    building: { prop: 'pokemonCentre', x: 9, y: 7 },
    tiles: [{ x: 11, y: 11 }],
    returnTo: { x: 11, y: 12 },
    keeper: {
      id: 'nurse-joy',
      name: 'NURSE JOY',
      design: 'nurse-joy',
      position: { x: 10, y: 12 },
      facing: 'down',
    },
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
    keeper: {
      id: 'brock',
      name: 'BROCK',
      design: 'brock',
      position: { x: 23, y: 12 },
      facing: 'down',
    },
  },
  {
    id: 'the-quay',
    screen: 'trader',
    name: 'BILL’S QUAY',
    tiles: [],
    returnTo: { x: 14, y: 17 },
    keeper: {
      id: 'bill',
      name: 'BILL',
      design: 'bill',
      position: { x: 14, y: 16 },
      facing: 'right',
    },
  },
];

export function doorAt(tile: GridPosition): BaseDoor | undefined {
  return BASE_DOORS.find((door) =>
    door.tiles.some((doorway) => doorway.x === tile.x && doorway.y === tile.y),
  );
}

export function keeperAt(tile: GridPosition): BaseDoor | undefined {
  return BASE_DOORS.find(
    (door) => door.keeper.position.x === tile.x && door.keeper.position.y === tile.y,
  );
}
