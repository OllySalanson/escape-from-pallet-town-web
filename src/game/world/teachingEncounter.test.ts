import { describe, expect, it } from 'vitest';
import { Pokemon } from '../pokemon';
import { BULBASAUR, CHARMANDER, PIDGEY, SQUIRTLE, getSpeciesById } from '../pokemon/species';
import { createBattleState, resolveTurn, type BattleState } from '../pokemon/battle/battleEngine';
import { getTypeEffectiveness } from '../pokemon/battle/typeChart';
import { createSeededRng } from '../run/rng';
import type { ActiveRunSession } from '../run/RunSession';
import { FIRST_CONTRACT } from '../run/runGeneration';
import { PALLET_TALL_GRASS } from '../pokemon/encounters';
import {
  TEACHING_ENCOUNTER,
  consumeTeachingEncounter,
  hasTeachingEncounter,
} from './teachingEncounter';

const firstContractSession = (): ActiveRunSession =>
  ({ plan: { contract: FIRST_CONTRACT } }) as unknown as ActiveRunSession;

const bestDamagingMove = (state: BattleState): number => {
  const defenderTypes = [
    state.enemy.pokemon.base.primaryType,
    ...(state.enemy.pokemon.base.secondaryType ? [state.enemy.pokemon.base.secondaryType] : []),
  ];
  let best = 0;
  let bestScore = -1;
  state.player.moves.forEach((move, index) => {
    if (move.pp <= 0 || move.base.power <= 0) {
      return;
    }
    const score = move.base.power * getTypeEffectiveness(move.base.type, defenderTypes);
    if (score > bestScore) {
      bestScore = score;
      best = index;
    }
  });
  return best;
};

/** Plays the whole fight out, always attacking, until someone faints. */
const playOut = (starter: typeof BULBASAUR, random: () => number): BattleState => {
  let state = createBattleState(
    new Pokemon(starter, 5),
    new Pokemon(getSpeciesById(TEACHING_ENCOUNTER.speciesId)!, TEACHING_ENCOUNTER.level),
  );
  for (let turn = 0; turn < 40 && state.outcome === 'active'; turn += 1) {
    state = resolveTurn(state, bestDamagingMove(state), random).state;
  }
  return state;
};

const winRate = (starter: typeof BULBASAUR, seed: number, trials = 500): number => {
  const rng = createSeededRng(seed);
  let wins = 0;
  for (let trial = 0; trial < trials; trial += 1) {
    if (playOut(starter, () => rng.next()).outcome === 'victory') {
      wins += 1;
    }
  }
  return wins / trials;
};

describe('teaching encounter', () => {
  it('replaces only the first grass roll of a first-contract raid', () => {
    const session = firstContractSession();

    expect(hasTeachingEncounter(session)).toBe(true);
    expect(consumeTeachingEncounter(session)).toEqual(TEACHING_ENCOUNTER);
    expect(hasTeachingEncounter(session)).toBe(false);
    expect(consumeTeachingEncounter(session)).toBeNull();
  });

  it('leaves later raids and sessionless battles on the ordinary encounter roll', () => {
    expect(consumeTeachingEncounter(undefined)).toBeNull();
    expect(consumeTeachingEncounter({} as ActiveRunSession)).toBeNull();
    expect(
      consumeTeachingEncounter({
        plan: { contract: FIRST_CONTRACT },
        teachingEncounterUsed: true,
      } as unknown as ActiveRunSession),
    ).toBeNull();
  });

  it('is weaker than every starter, unlike the grass table it replaces', () => {
    const teacher = new Pokemon(getSpeciesById(TEACHING_ENCOUNTER.speciesId)!, TEACHING_ENCOUNTER.level);

    for (const starter of [BULBASAUR, CHARMANDER, SQUIRTLE]) {
      const player = new Pokemon(starter, 5);
      expect(player.level).toBeGreaterThan(teacher.level);
      expect(player.maxHp).toBeGreaterThan(teacher.maxHp);
    }

    // Even on the rebalanced table a first roll can still land above the
    // starter's own level, which is what the authored fight replaces.
    const aboveStarterWeight = PALLET_TALL_GRASS.entries
      .filter((entry) => entry.maxLevel > 5)
      .reduce((total, entry) => total + entry.weight, 0);
    expect(aboveStarterWeight).toBeGreaterThan(0);
  });

  it('is won by all three starters at both extremes of the damage roll', () => {
    for (const starter of [BULBASAUR, CHARMANDER, SQUIRTLE]) {
      // 0 rolls a critical hit for both sides and the minimum damage spread;
      // 0.999 rolls neither. Both ends still end in a win.
      expect(playOut(starter, () => 0).outcome).toBe('victory');
      expect(playOut(starter, () => 0.999).outcome).toBe('victory');
    }
  });

  it('leaves no starter meaningfully behind the others across many fights', () => {
    const rates = [BULBASAUR, CHARMANDER, SQUIRTLE].map((starter) => winRate(starter, 0x5eed));

    for (const rate of rates) {
      expect(rate).toBeGreaterThan(0.85);
    }
    // Parity: the three starters must not be separated by more than a sliver.
    expect(Math.max(...rates) - Math.min(...rates)).toBeLessThan(0.15);
  });

  it('teaches with one attack and no hidden effects', () => {
    const teacher = new Pokemon(getSpeciesById(TEACHING_ENCOUNTER.speciesId)!, TEACHING_ENCOUNTER.level);

    expect(teacher.base).toBe(PIDGEY);
    expect(teacher.moves.map((move) => move.base.name)).toEqual(['Tackle']);
    expect(teacher.moves.every((move) => move.base.boosts.length === 0)).toBe(true);
  });
});
