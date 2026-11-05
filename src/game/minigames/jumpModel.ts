import { isGrounded, startPokemonJump, stepFrame, VINE_UPSWING_HIGH, type PokemonJumpGame } from './pokemonJump';

/**
 * A model player for POKéMON JUMP, for the tests and the measuring tool
 * (`tools/minigames/measure.mts`): when the moment to jump the coming swing
 * opens, it aims for the middle of it - the frames on which a press still gets
 * everyone over - and misses that by up to `jitter` frames either way, as a
 * person does. How wide that moment is, is how forgiving a team is.
 */

/** Whether pressing on the next frame, and then not again, gets everyone over the coming swing. */
function clearsIfPressed(game: PokemonJumpGame, wait: number): boolean {
  let probe = game;
  for (let frame = 0; frame < wait; frame += 1) {
    probe = stepFrame(probe, false);
    if (probe.over) return false;
  }
  probe = stepFrame(probe, true);
  for (let frame = 0; frame < 120; frame += 1) {
    if (probe.over) return false;
    if (probe.vineState === VINE_UPSWING_HIGH && probe.prevVineState !== VINE_UPSWING_HIGH) return true;
    probe = stepFrame(probe, false);
  }
  return !probe.over;
}

/** A small seeded roll, apart from the game's own. */
function roller(seed: number): () => number {
  let state = (seed * 2654435761) >>> 0;
  return () => {
    state = (Math.imul(state ^ (state >>> 15), 2246822507) + 0x9e3779b9) >>> 0;
    return state / 2 ** 32;
  };
}

/** A whole game played by the model, to its end or `maxFrames`. */
export function modelJumpGame(species: readonly string[], seed: number, jitter: number, maxFrames = 60 * 60 * 6): PokemonJumpGame {
  let game = startPokemonJump(species, seed);
  const roll = roller(seed);
  let planned: number | null = null;
  while (!game.over && game.frame < maxFrames) {
    const ready = game.jumpers.some(isGrounded);
    if (planned === null && ready && clearsIfPressed(game, 0)) {
      // The moment has opened: how long is it, and where in it does a person press?
      let width = 1;
      while (width < 60 && clearsIfPressed(game, width)) width += 1;
      planned = Math.max(0, Math.round((width - 1) / 2 + (roll() * 2 - 1) * jitter));
    }
    let press = false;
    if (planned !== null) {
      if (planned <= 0) {
        press = true;
        planned = null;
      } else {
        planned -= 1;
      }
    }
    game = stepFrame(game, press);
  }
  return game;
}
