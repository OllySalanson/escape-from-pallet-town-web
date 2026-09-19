import { Pokemon } from '../pokemon';
import {
  createTrainerBattleState,
  replacePlayerPokemon,
  resolveEnemyTurn,
  resolveTurn,
  type TrainerBattle,
} from '../pokemon/battle/battleEngine';
import { getSpeciesById } from '../pokemon/species';
import type { WeatherId } from '../pokemon/battle/weather';
import { createSeededRng } from '../run/rng';
import { bestDamagingMove } from './bestPlay';

/**
 * What an authored trainer costs, measured over the real engine rather than
 * argued.
 *
 * `encounterMeasure.ts` does this for a table of wild Pokemon; this does it for
 * a whole trainer fight, which is the other half of what a map charges. The
 * player plays it the generous way - always the best damaging move, the next
 * Pokemon in on a faint, never a switch - so a win rate here is a *ceiling* on
 * how hard the fight is and a floor on how hard it feels.
 *
 * A boss is the one fight a map cannot be finished without, so the two numbers
 * that matter are the ladder (is this boss harder than the one the player met
 * before it) and the spread (can every starter win it, or only one). Both are
 * printed by `tools/trainers/report.mts` and held in `trainerLadder.test.ts`.
 *
 * The one thing it will play if asked is the pack: see `potions` below.
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

/**
 * A Potion, as the catalogue has it. The number is repeated rather than read
 * off `items.ts` because this harness must stay free of the bag, the loadout
 * and everything else a raid carries: it is a fight and a pack, nothing more.
 */
const POTION_HP = 20;
/**
 * How low the Pokemon is let get before the pack is opened, and how much of a
 * Potion must not be wasted to be worth a turn. A player who drinks at a
 * scratch throws the raid's medicine away; one who waits for the red loses to
 * the next hit. Between those, the exact threshold moves a measured win rate
 * by a point or two and nothing here is pitched that finely.
 */
const DRINK_BELOW = 0.42;
const DRINK_WORTH = 0.45;

export interface TrainerBattleResult {
  readonly won: boolean;
  /**
   * The share of the party's own maximum HP still standing at the end. It is
   * what says whether a fight was a rung or a mauling: two fights won at the
   * same rate can leave a party at 60% and at 6%, and the hunter ladder is
   * pitched on "a win costing a third to a half". Zero on a loss.
   */
  readonly healthLeft: number;
  /** Potions drunk out of the pack, which is the other half of what a win cost. */
  readonly potionsUsed: number;
}

/**
 * One whole trainer fight, played to the end. The engine sends the next enemy in.
 *
 * `potions` is how many Potions the raid pack is carrying, and zero - the
 * default - is the bare fight the boss ladder is measured in. It is not a
 * refinement: a trainer standing on a route is paid for in supplies as much as
 * in health, and a toll measured with an empty pack is measured against a
 * player who does not exist. A fresh save deploys with three (`MINIMUM_SUPPLIES`
 * in `stash/Stash.ts`), and a Potion costs the turn it is drunk in, which the
 * Pokemon across the field spends hitting you - exactly as `battleItems.ts`
 * charges it in a real fight.
 */
export function playTrainerBattle(
  party: readonly Pokemon[],
  trainer: TrainerBattle,
  seed: number,
  /** The weather of the place the fight is in, as a raid would supply it. */
  weather: WeatherId | null = null,
  potions = 0,
): TrainerBattleResult {
  const rng = createSeededRng(seed);
  const random = (): number => rng.next();
  const maximum = party.reduce((total, pokemon) => total + pokemon.maxHp, 0);
  let state = createTrainerBattleState(party[0], trainer, weather);
  let index = 0;
  let left = potions;
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
  const lost = (): TrainerBattleResult => ({
    won: false,
    healthLeft: 0,
    potionsUsed: potions - left,
  });
  for (let turn = 0; turn < 400 && state.outcome === 'active'; turn += 1) {
    const before = state;
    const max = state.player.pokemon.maxHp;
    const wouldRestore = Math.min(POTION_HP, max - state.player.currentHp);
    if (
      left > 0 &&
      state.player.currentHp <= max * DRINK_BELOW &&
      wouldRestore >= max * DRINK_WORTH
    ) {
      left -= 1;
      state = {
        ...state,
        player: { ...state.player, currentHp: Math.min(max, state.player.currentHp + POTION_HP) },
      };
      state = resolveEnemyTurn(state, random).state;
    } else {
      state = resolveTurn(state, bestDamagingMove(state), random).state;
    }
    if (state.player.currentHp === 0 && state.outcome !== 'victory') {
      const next = party.slice(index + 1).findIndex((pokemon) => !pokemon.isFainted);
      if (next < 0) {
        return lost();
      }
      index += 1 + next;
      state = replacePlayerPokemon(state, party[index]).state;
    }
    // A turn that changed nothing - everything out of PP - is a stalemate.
    if (state === before) {
      return lost();
    }
  }
  return state.outcome === 'victory'
    ? { won: true, healthLeft: healthLeft(), potionsUsed: potions - left }
    : lost();
}

/** The share of `trials` this party wins, seeded so the answer never moves. */
export function trainerWinRate(
  party: MeasuredParty,
  trainer: TrainerBattle,
  trials = 200,
  seed = 0x51ede,
  weather: WeatherId | null = null,
  potions = 0,
): number {
  return trainerMeasure(party, trainer, trials, seed, weather, potions).winRate;
}

/** The same fight, with what winning it cost as well as how often it is won. */
export function trainerMeasure(
  party: MeasuredParty,
  trainer: TrainerBattle,
  trials = 200,
  seed = 0x51ede,
  weather: WeatherId | null = null,
  potions = 0,
): {
  readonly winRate: number;
  readonly healthLeftOnWin: number;
  readonly potionsOnWin: number;
} {
  let wins = 0;
  let health = 0;
  let drunk = 0;
  for (let trial = 0; trial < trials; trial += 1) {
    const result = playTrainerBattle(
      [...party.build()],
      trainer,
      seed + trial * 7919,
      weather,
      potions,
    );
    if (result.won) {
      wins += 1;
      health += result.healthLeft;
      drunk += result.potionsUsed;
    }
  }
  return {
    winRate: wins / trials,
    healthLeftOnWin: wins === 0 ? 0 : health / wins,
    potionsOnWin: wins === 0 ? 0 : drunk / wins,
  };
}
