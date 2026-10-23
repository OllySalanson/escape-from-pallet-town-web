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
 * One door has no room behind it: the Raid Arena's opens straight onto the
 * raid's loadout, and it is the only way into a raid.
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
 * `arena` is the raid itself: the Raid Arena's door opens preparation straight
 * away, and it is the only way into a raid. `lab` is Oak's room, where the
 * contract board and the wall map are read.
 */
export type BaseScreen = 'lab' | 'arena' | 'stash' | 'workshop' | 'trader';

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
  /**
   * Whether the door opens onto a room with somebody in it (`rooms.ts`), or
   * straight onto its screen. The Raid Arena is the one that opens straight
   * onto its screen (the captain, 2026-10-23: "you go into it and then that's
   * when the loadout screen goes"), because a raid is the thing a player
   * walks over to it for, every time.
   */
  readonly opens: 'room' | 'screen';
}

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
    opens: 'screen',
  },
  {
    id: 'pokemon-centre',
    screen: 'stash',
    name: 'POKÉMON CENTER',
    building: { prop: 'pokemonCentre', x: 17, y: 7 },
    tiles: [{ x: 19, y: 11 }],
    returnTo: { x: 19, y: 12 },
    opens: 'room',
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
    opens: 'room',
  },
  {
    id: 'brocks-workshop',
    screen: 'workshop',
    name: 'BROCK’S WORKSHOP',
    building: { prop: 'workshop', x: 30, y: 8 },
    tiles: [{ x: 31, y: 11 }],
    returnTo: { x: 31, y: 12 },
    opens: 'room',
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
    opens: 'room',
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
    opens: 'room',
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
