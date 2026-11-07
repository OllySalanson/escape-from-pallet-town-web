import { BERRY_PICKING_EAT_FALL } from './generated/berryPicking';
import {
  fallDelay,
  LEFT,
  MIDDLE,
  reachable,
  RIGHT,
  startBerryPicking,
  stepBerryFrame,
  type BerryPickingGame,
  type Column,
} from './berryPicking';

/**
 * A model player for BERRY PICKING, for the tests and the measuring tool
 * (`tools/minigames/measure.mts`): it watches the berry nearest the ground
 * that it can reach, aims to close on it in the middle of the two drops it is
 * ripe for, and misses that by up to `jitter` frames either way, as a person
 * does. A Doduo reaching for the side it is not turned to turns first. How
 * well a bird does against it is how forgiving the bird is.
 */

/** A small seeded roll, apart from the game's own. */
function roller(seed: number): () => number {
  let state = (seed * 2654435761) >>> 0;
  return () => {
    state = (Math.imul(state ^ (state >>> 15), 2246822507) + 0x9e3779b9) >>> 0;
    return state / 2 ** 32;
  };
}

/** Frames until a falling berry reaches the middle of its ripe window, or null for one that is not coming. */
function framesToMiddle(game: BerryPickingGame, column: Column): number | null {
  const berry = game.columns[column];
  if (berry.state !== 'falling') return null;
  const delay = fallDelay(berry.kind, game.difficulty);
  // The window opens at drop EAT-1 and closes as the berry leaves drop EAT.
  const opens = (BERRY_PICKING_EAT_FALL - 1 - berry.fall) * delay - berry.fallTimer;
  const middle = opens + delay;
  return middle < -delay ? null : middle;
}

/** A whole game played by the model, to its end or `maxFrames`. */
export function modelBerryGame(species: string, seed: number, jitter: number, maxFrames = 60 * 60 * 10): BerryPickingGame {
  let game = startBerryPicking(species);
  const roll = roller(seed);
  let planned: { column: Column; at: number } | null = null;
  while (!game.over && game.frame < maxFrames) {
    let press: Column | null = null;
    if (game.beak === 'free' && game.reach === null && !game.ending) {
      if (!planned || game.columns[planned.column].state !== 'falling') {
        // The berry that wants attention soonest, anywhere.
        const order = ([LEFT, MIDDLE, RIGHT] as Column[])
          .map((column) => ({ column, wait: framesToMiddle(game, column) }))
          .filter((entry): entry is { column: Column; wait: number } => entry.wait !== null)
          .sort((a, b) => a.wait - b.wait);
        const target = order[0];
        if (target) {
          const offset = Math.round((roll() * 2 - 1) * jitter);
          planned = { column: target.column, at: game.frame + Math.max(0, target.wait + offset) };
        }
      }
      if (planned) {
        const turnNeeded = !reachable(game).includes(planned.column);
        if (turnNeeded) {
          press = planned.column;
        } else if (game.frame >= planned.at) {
          press = planned.column;
          planned = null;
        }
      }
    }
    game = stepBerryFrame(game, press);
  }
  return game;
}

