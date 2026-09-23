import { PLAYER_ACTOR, type Cutscene, type CutsceneAction } from '../cutscene/cutscene';
import type { Direction, GridPosition } from '../movement/gridMovement';
import type { TrainerApproach } from './trainerApproach';

/**
 * Every authored cutscene in the game, built from the actions in
 * `../cutscene/cutscene.ts`.
 *
 * They are functions rather than constants because a beat is always about
 * where two figures happen to be standing this second - the same reason
 * `jointGateCaption()` is a function. What is authored is the *sequence*: which
 * beats, in what order, for how long.
 *
 * Both of the two live cutscenes are a figure catching the player, and both are
 * free of the raid clock for the reason `advanceRunClock()` already gives - a
 * `pendingTrainerBattle` is set before either plays, because the challenge that
 * announces a fight is the fight's first beat rather than the world's last.
 */

/**
 * Whether a mark over `actor` would be drawn on the player's own head.
 *
 * The mark is seated a tile's height above the figure it belongs to and is
 * drawn above every figure, so an actor standing *directly below* the player
 * puts its exclamation squarely over the player's face - where it reads as the
 * player's own surprise, and hides them besides. A caption with nowhere clear
 * to sit is hidden rather than drawn over something (`labelPlacement.ts`), and
 * a mark is held to the same rule: in that one geometry the beat goes without
 * it. It is one tile of ink, and no player misses what was never raised.
 */
function markWouldCoverThePlayer(actor: GridPosition, player: GridPosition): boolean {
  return actor.x === player.x && actor.y === player.y + 1;
}

const OPPOSITE: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

/**
 * The trainer approach's timings, which a played watch settled on:
 *
 * - `APPROACH_ALERT_MS`: long enough to read the mark and see who it is over,
 *   short enough that the player has not yet reached for a key. Under about
 *   400ms the mark is gone before the eye finds it; over 700ms it is a stall.
 * - `APPROACH_STEP_MS`: a tile every 110ms, quicker than the player's own step,
 *   because the trainer is coming *for* them. The longest authored watch is
 *   five tiles, so the whole walk is at most ~0.45s and the whole beat under a
 *   second - an event, not an interruption. At the player's pace the walk reads
 *   as a stroll, and the drama of being run down is lost.
 * - `APPROACH_SETTLE_MS`: held on the closing tile before a word is said, so
 *   the arrival lands.
 */
export const APPROACH_ALERT_MS = 500;
export const APPROACH_STEP_MS = 110;
export const APPROACH_SETTLE_MS = 120;

/**
 * The beat between a watch catching the player and the trainer speaking.
 *
 * A watch used to hand the player straight to the trainer's intro line, so the
 * fight arrived out of nowhere from a figure ten tiles off. The beat is the
 * tutorial's own: the player turns to look, an exclamation mark goes up, a
 * breath, and the trainer walks to *one tile short of the player* before a word
 * is said.
 *
 * `approach` is null when the player is not in the straight run the trainer
 * faces, which a watch can never produce - the degenerate cutscene is the turn
 * and the line, and is what the trainer's own lines were before any of this.
 */
export function trainerApproachCutscene(
  trainerId: string,
  trainer: GridPosition,
  facing: Direction,
  player: GridPosition,
  lines: readonly string[],
  approach: TrainerApproach | null,
): Cutscene {
  const path = approach?.path ?? [];
  const arrival = path[path.length - 1] ?? trainer;
  // The mark goes up where the trainer *starts*, which is only ever the
  // player's own tile-above when they were caught on the nearest watched tile.
  const marked = !markWouldCoverThePlayer(trainer, player);
  return {
    id: `trainer-approach:${trainerId}`,
    actors: {
      [PLAYER_ACTOR]: { ...player, facing: OPPOSITE[facing] },
      [trainerId]: { ...trainer, facing },
    },
    actions: [
      // The player turns first: being caught is looking up at whoever caught you.
      { kind: 'turn', actor: PLAYER_ACTOR, facing: OPPOSITE[facing] },
      { kind: 'sound', effect: 'trainerSpotted' },
      marked
        ? { kind: 'emote', actor: trainerId, emote: 'spotted', durationMs: APPROACH_ALERT_MS }
        : { kind: 'wait', durationMs: APPROACH_ALERT_MS },
      ...(path.length > 0
        ? [{ kind: 'move', actor: trainerId, path, stepMs: APPROACH_STEP_MS } as CutsceneAction]
        : []),
      { kind: 'wait', durationMs: APPROACH_SETTLE_MS },
      { kind: 'say', lines, about: [arrival] },
    ],
  };
}

/**
 * The hunter's timings. Shorter than the trainer's on both ends: the hunter has
 * been on screen and closing for minutes, so the mark is a confirmation rather
 * than an introduction, and the breath before "FOUND YOU." is the length of a
 * hand landing on a shoulder.
 */
export const CATCH_ALERT_MS = 380;
export const CATCH_SETTLE_MS = 160;

/**
 * Being caught by the hunter.
 *
 * This is the raid's own failure, and until now it had no beat at all: the
 * hunter stepped onto the tile beside the player and a box said FOUND YOU.,
 * with the player still facing whichever way they had been running and the
 * hunter still facing the way it was drawn when it arrived. Nobody looked at
 * anybody. It is the one moment in a raid that a player will replay in their
 * head, and it was the one moment with nothing to see.
 *
 * It is authored as the trainer approach's twin with the walk taken out - the
 * hunter has already done its walking, tile by tile, for the whole raid - which
 * is what makes it the second user of this machinery rather than a second copy
 * of it: the turn, the mark, the breath, the line.
 */
export function hunterCatchCutscene(
  hunterId: string,
  hunter: GridPosition,
  player: GridPosition,
  playerFacing: Direction,
  lines: readonly string[],
): Cutscene {
  const towardsPlayer = bearingFrom(hunter, player) ?? 'down';
  return {
    id: 'hunter-catch',
    actors: {
      [PLAYER_ACTOR]: { ...player, facing: playerFacing },
      [hunterId]: { ...hunter, facing: towardsPlayer },
    },
    actions: [
      // Both figures look at each other, which is the whole of the staging: the
      // hunter has never once turned its head in a raid before this.
      { kind: 'turn', actor: hunterId, facing: towardsPlayer },
      { kind: 'turn', actor: PLAYER_ACTOR, facing: OPPOSITE[towardsPlayer] },
      { kind: 'sound', effect: 'hunterContact' },
      markWouldCoverThePlayer(hunter, player)
        ? { kind: 'wait', durationMs: CATCH_ALERT_MS }
        : { kind: 'emote', actor: hunterId, emote: 'spotted', durationMs: CATCH_ALERT_MS },
      { kind: 'wait', durationMs: CATCH_SETTLE_MS },
      { kind: 'say', lines, about: [hunter] },
    ],
  };
}

/** The way from one tile to a neighbour, or null when they are not neighbours. */
export function bearingFrom(from: GridPosition, to: GridPosition): Direction | null {
  if (to.x === from.x && to.y === from.y - 1) {
    return 'up';
  }
  if (to.x === from.x && to.y === from.y + 1) {
    return 'down';
  }
  if (to.y === from.y && to.x === from.x - 1) {
    return 'left';
  }
  if (to.y === from.y && to.x === from.x + 1) {
    return 'right';
  }
  return null;
}
