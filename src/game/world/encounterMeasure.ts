import { Pokemon } from '../pokemon';
import { createBattleState, resolveTurn, type BattleState } from '../pokemon/battle/battleEngine';
import { getTypeEffectiveness } from '../pokemon/battle/typeChart';
import type { WildEncounterTable } from '../pokemon/encounters';
import { getSpeciesById } from '../pokemon/species';
import { MoveCategory } from '../pokemon/MoveBase';
import { createSeededRng } from '../run/rng';
import type { WeatherId } from '../pokemon/battle/weather';

/**
 * What a table costs, measured over the real engine rather than argued.
 *
 * A wild fight is played out with the partner always using its best damaging
 * move, which is generous to the player (no item, no switch, no flee) and so
 * a floor on how hard a place is, not a ceiling. `tools/encounters/report.mts`
 * prints these per place and `districtEncounters.test.ts` holds them.
 */
export interface TableMeasure {
  /** Encounter-weighted mean level of what is met. */
  readonly meanLevel: number;
  /** Share of encounters strictly above the partner's own level. */
  readonly aboveShare: number;
  /** Chance the partner wins a single encounter, weighted by the table. */
  readonly winRate: number;
  /** The single worst encounter for the partner and its chance of winning it. */
  readonly worst: { readonly speciesId: string; readonly level: number; readonly winRate: number };
}

const bestMove = (state: BattleState): number => {
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
};

/** The chance `partner` at `partnerLevel` beats one wild `speciesId` at `level`. */
export function winRateAgainst(
  partnerSpeciesId: string,
  partnerLevel: number,
  speciesId: string,
  level: number,
  trials = 200,
  seed = 0x5eed,
  /** The weather of the place this fight is in, as a raid would supply it. */
  weather: WeatherId | null = null,
): number {
  const rng = createSeededRng(seed);
  const random = (): number => rng.next();
  let wins = 0;
  for (let trial = 0; trial < trials; trial += 1) {
    let state = createBattleState(
      new Pokemon(getSpeciesById(partnerSpeciesId)!, partnerLevel),
      new Pokemon(getSpeciesById(speciesId)!, level),
      weather,
    );
    for (let turn = 0; turn < 60 && state.outcome === 'active'; turn += 1) {
      state = resolveTurn(state, bestMove(state), random).state;
    }
    if (state.outcome === 'victory') {
      wins += 1;
    }
  }
  return wins / trials;
}

export function measureTable(
  table: WildEncounterTable,
  partnerSpeciesId: string,
  partnerLevel: number,
  trials = 200,
  weather: WeatherId | null = null,
): TableMeasure {
  const total = table.entries.reduce((sum, entry) => sum + entry.weight, 0);
  let meanLevel = 0;
  let above = 0;
  let winRate = 0;
  let worst: TableMeasure['worst'] = { speciesId: '', level: 0, winRate: 2 };
  for (const entry of table.entries) {
    const share = entry.weight / total;
    const levels = entry.maxLevel - entry.minLevel + 1;
    for (let level = entry.minLevel; level <= entry.maxLevel; level += 1) {
      const each = share / levels;
      const rate = winRateAgainst(
        partnerSpeciesId,
        partnerLevel,
        entry.speciesId,
        level,
        trials,
        0x5eed,
        weather,
      );
      meanLevel += level * each;
      winRate += rate * each;
      if (level > partnerLevel) {
        above += each;
      }
      if (rate < worst.winRate) {
        worst = { speciesId: entry.speciesId, level, winRate: rate };
      }
    }
  }
  return { meanLevel, aboveShare: above, winRate, worst };
}
