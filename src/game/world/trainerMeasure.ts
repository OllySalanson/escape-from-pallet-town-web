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
import type { WeatherId } from '../pokemon/battle/weather';
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

export interface TrainerBattleResult {
  readonly won: boolean;
  /**
   * The share of the party's own maximum HP still standing at the end. It is
   * what says whether a fight was a rung or a mauling: two fights won at the
   * same rate can leave a party at 60% and at 6%, and the hunter ladder is
   * pitched on "a win costing a third to a half". Zero on a loss.
   */
  readonly healthLeft: number;
}

/** One whole trainer fight, played to the end. The engine sends the next enemy in. */
export function playTrainerBattle(
  party: readonly Pokemon[],
  trainer: TrainerBattle,
  seed: number,
  /** The weather of the place the fight is in, as a raid would supply it. */
  weather: WeatherId | null = null,
): TrainerBattleResult {
  const rng = createSeededRng(seed);
  const random = (): number => rng.next();
  const maximum = party.reduce((total, pokemon) => total + pokemon.maxHp, 0);
  let state = createTrainerBattleState(party[0], trainer, weather);
  let index = 0;
  // A combatant owns its HP while it is out and this harness never writes it
  // back to the Pokemon, so the party's own `currentHp` is not the fight's: the
  // one out is read off the state, everyone already sent out is at zero (this
  // harness only ever replaces a Pokemon that fainted), and everyone still on
  // the bench is untouched. Reading the party object instead reported a wiped
  // team as three quarters healthy.
  const healthLeft = (): number =>
    maximum === 0
      ? 0
      : (state.player.currentHp +
          party.slice(index + 1).reduce((total, pokemon) => total + pokemon.maxHp, 0)) /
        maximum;
  const lost = { won: false, healthLeft: 0 } as const;
  for (let turn = 0; turn < 400 && state.outcome === 'active'; turn += 1) {
    const before = state;
    state = resolveTurn(state, bestMove(state), random).state;
    if (state.player.currentHp === 0 && state.outcome !== 'victory') {
      const next = party.slice(index + 1).findIndex((pokemon) => !pokemon.isFainted);
      if (next < 0) {
        return lost;
      }
      index += 1 + next;
      state = replacePlayerPokemon(state, party[index]).state;
    }
    // A turn that changed nothing - everything out of PP - is a stalemate.
    if (state === before) {
      return lost;
    }
  }
  return state.outcome === 'victory'
    ? { won: true, healthLeft: healthLeft() }
    : lost;
}

/** The share of `trials` this party wins, seeded so the answer never moves. */
export function trainerWinRate(
  party: MeasuredParty,
  trainer: TrainerBattle,
  trials = 200,
  seed = 0x51ede,
  weather: WeatherId | null = null,
): number {
  return trainerMeasure(party, trainer, trials, seed, weather).winRate;
}

/** The same fight, with what winning it cost as well as how often it is won. */
export function trainerMeasure(
  party: MeasuredParty,
  trainer: TrainerBattle,
  trials = 200,
  seed = 0x51ede,
  weather: WeatherId | null = null,
): { readonly winRate: number; readonly healthLeftOnWin: number } {
  let wins = 0;
  let health = 0;
  for (let trial = 0; trial < trials; trial += 1) {
    const result = playTrainerBattle([...party.build()], trainer, seed + trial * 7919, weather);
    if (result.won) {
      wins += 1;
      health += result.healthLeft;
    }
  }
  return { winRate: wins / trials, healthLeftOnWin: wins === 0 ? 0 : health / wins };
}
