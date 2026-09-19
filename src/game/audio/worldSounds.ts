import type { Direction } from '../movement/gridMovement';

/**
 * The overworld's two sounds that are about a *change* rather than an event:
 * each would fire every frame if it were asked the naive question, so each is a
 * small state machine, kept pure so the rule is testable without a scene.
 */

/**
 * Tall grass rustles on the step that enters it and is quiet from then on.
 * Played in a raid, a rustle on every grass step came to four a second down a
 * reed lane: a texture, not a signal.
 */
export function entersTallGrass(fromTallGrass: boolean, toTallGrass: boolean): boolean {
  return toTallGrass && !fromTallGrass;
}

/**
 * Walking into a wall thuds once per push. A held key against a wall asks the
 * movement planner the same blocked question sixty times a second, and the
 * thud belongs to the first of them only; pressing another way, or getting a
 * step in, re-arms it.
 *
 * Returns the direction now being pushed against and whether to thud.
 */
export function nextBump(
  pushingAgainst: Direction | null,
  blockedDirection: Direction | null,
): { readonly pushingAgainst: Direction | null; readonly thud: boolean } {
  if (blockedDirection === null) {
    return { pushingAgainst: null, thud: false };
  }
  return { pushingAgainst: blockedDirection, thud: blockedDirection !== pushingAgainst };
}

/**
 * The hunter is "near" inside this many steps, and stops being near outside the
 * second. It has to sit under `HUNTER_SPAWN_DISTANCE`: the hunter arrives five
 * steps out with a sting of its own, and a threshold at four sounded this one
 * on the very next step, as an echo of the arrival rather than news.
 */
export const HUNTER_NEAR_STEPS = 3;
export const HUNTER_NEAR_RELEASE_STEPS = 6;

/**
 * A pursuit has no sound of its own - anything that tracked it continuously
 * would be music, and the captain has asked for none. What it has is one
 * heartbeat when the hunter closes inside `HUNTER_NEAR_STEPS`, and the gap
 * between the two thresholds is what stops a hunter pacing the player at the
 * boundary from sounding it on every step.
 */
export function nextHunterProximity(
  wasNear: boolean,
  distance: number | null,
): { readonly near: boolean; readonly warn: boolean } {
  if (distance === null) {
    return { near: false, warn: false };
  }
  if (!wasNear && distance <= HUNTER_NEAR_STEPS) {
    return { near: true, warn: true };
  }
  if (wasNear && distance >= HUNTER_NEAR_RELEASE_STEPS) {
    return { near: false, warn: false };
  }
  return { near: wasNear, warn: false };
}
