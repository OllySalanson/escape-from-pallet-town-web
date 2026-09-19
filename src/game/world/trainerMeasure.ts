import { Pokemon } from '../pokemon';
import {
  createTrainerBattleState,
  replacePlayerPokemon,
  resolveTurn,
  type BattleState,
  type TrainerBattle,
} from '../pokemon/battle/battleEngine';
import { getTypeEffectiveness } from '../pokemon/battle/typeChart';
import { MoveCategory } from '../pokemon/MoveBase';
import { getSpeciesById } from '../pokemon/species';
import { createSeededRng } from '../run/rng';

/**
 * What an authored trainer costs, measured over the real engine rather than
 * argued.
 *
 * `encounterMeasure.ts` does this for a table of wild Pokemon; this does it for
 * a whole trainer fight, which is the other half of what a map charges. The
 * player plays it the generous way - always the best damaging move, the next
 * Pokemon in on a faint, never an item and never a switch - so a win rate here
 * is a *ceiling* on how hard the fight is and a floor on how hard it feels.
 *
 * A boss is the one fight a map cannot be finished without, so the two numbers
 * that matter are the ladder (is this boss harder than the one the player met
 * before it) and the spread (can every starter win it, or only one). Both are
 * printed by `tools/trainers/report.mts` and held in `trainerLadder.test.ts`.
 */

/** A party the measurement is run against, rebuilt fresh for every trial. */
export interface MeasuredParty {
  readonly name: string;
  readonly build: () => readonly Pokemon[];
}

export const partyOf = (name: string, ...members: readonly [string, number][]): MeasuredParty => ({
  name,
  build: () => members.map(([speciesId, level]) => new Pokemon(getSpeciesById(speciesId)!, level)),
});

/** The best damaging move against what is in front of you, or the first one. */
function bestMove(state: BattleState): number {
  const types = [
    state.enemy.pokemon.base.primaryType,
    ...(state.enemy.pokemon.base.secondaryType ? [state.enemy.pokemon.base.secondaryType] : []),
  ];
  let best = 0;
  let bestScore = -1;
  state.player.moves.forEach((move, index) => {
    if (move.pp <= 0 || move.base.category === MoveCategory.Status || move.base.power <= 0) {
      return;
    }
    const score = move.base.power * getTypeEffectiveness(move.base.type, types);
    if (score > bestScore) {
      bestScore = score;
      best = index;
    }
  });
  return best;
}

/** One whole trainer fight, played to the end. The engine sends the next enemy in. */
export function playTrainerBattle(
  party: readonly Pokemon[],
  trainer: TrainerBattle,
  seed: number,
): boolean {
  const rng = createSeededRng(seed);
  const random = (): number => rng.next();
  let state = createTrainerBattleState(party[0], trainer);
  let index = 0;
  for (let turn = 0; turn < 400 && state.outcome === 'active'; turn += 1) {
    const before = state;
    state = resolveTurn(state, bestMove(state), random).state;
    if (state.player.currentHp === 0 && state.outcome !== 'victory') {
      const next = party.slice(index + 1).findIndex((pokemon) => !pokemon.isFainted);
      if (next < 0) {
        return false;
      }
      index += 1 + next;
      state = replacePlayerPokemon(state, party[index]);
    }
    // A turn that changed nothing - everything out of PP - is a stalemate.
    if (state === before) {
      return false;
    }
  }
  return state.outcome === 'victory';
}

/** The share of `trials` this party wins, seeded so the answer never moves. */
export function trainerWinRate(
  party: MeasuredParty,
  trainer: TrainerBattle,
  trials = 200,
  seed = 0x51ede,
): number {
  let wins = 0;
  for (let trial = 0; trial < trials; trial += 1) {
    if (playTrainerBattle([...party.build()], trainer, seed + trial * 7919)) {
      wins += 1;
    }
  }
  return wins / trials;
}
