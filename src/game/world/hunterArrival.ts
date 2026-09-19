import { HUNTER_SPAWN_DISTANCE } from './hunter';

/**
 * Whether the hunter's *first* arrival is fair to the player it arrives on.
 *
 * The arrival is a warning sized for someone who is moving: the hunter appears
 * a fixed `HUNTER_SPAWN_DISTANCE` walking steps away and closes as the player
 * walks. A player still parked on the insertion tile - reading the map, the
 * captions, the chips - is not yet playing that game. For them the hunter
 * arrived between the insertion and everything else, and the first two steps
 * they ever took were the ones that put it in contact.
 *
 * So the first arrival waits until the player has walked at least the distance
 * it arrives at. It is a floor on the arrival and never a delay on top of it: a
 * player who set off when the raid began has crossed it long before the spawn
 * delay runs out, and the raid clock keeps its own pressure on one who has not.
 * Steps are counted on the run session because the world scene is rebuilt after
 * every battle and the count has to outlive it.
 */
export const HUNTER_ARRIVAL_MINIMUM_STEPS = HUNTER_SPAWN_DISTANCE;

export const hasPlayerSetOff = (stepsTaken: number | undefined): boolean =>
  (stepsTaken ?? 0) >= HUNTER_ARRIVAL_MINIMUM_STEPS;
