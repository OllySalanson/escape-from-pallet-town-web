import { describe, expect, it } from 'vitest';
import { Pokemon } from '../Pokemon';
import { BULBASAUR, CHARMANDER } from '../species';
import { createBattleState } from './battleEngine';
import {
  WILD_ESCAPE_MINIMUM_CHANCE,
  attemptWildEscape,
  getWildEscapeChance,
  wildEscapeChanceFor,
} from './escape';

describe('getWildEscapeChance', () => {
  it('is an even coin flip between equally fast Pokemon', () => {
    expect(getWildEscapeChance(20, 20, 0)).toBe(0.5);
  });

  it('rewards the faster Pokemon and punishes the slower one', () => {
    expect(getWildEscapeChance(30, 10, 0)).toBeCloseTo(0.75);
    expect(getWildEscapeChance(10, 30, 0)).toBeCloseTo(0.25);
  });

  it('never drops below the floor, however outclassed the runner is', () => {
    expect(getWildEscapeChance(1, 500, 0)).toBe(WILD_ESCAPE_MINIMUM_CHANCE);
  });

  it('reaches certainty within five attempts, so a failed escape is never a trap', () => {
    const chances = [0, 1, 2, 3, 4].map((attempts) => getWildEscapeChance(1, 500, attempts));

    chances.forEach((chance, attempts) => {
      expect(chance).toBeCloseTo(Math.min(1, 0.25 + attempts * 0.2));
      expect(chance).toBeGreaterThan(chances[attempts - 1] ?? 0);
    });
    expect(chances.at(-1)).toBe(1);
  });
});

describe('attemptWildEscape', () => {
  const state = createBattleState(new Pokemon(CHARMANDER, 12), new Pokemon(BULBASAUR, 10));

  it('reports the same chance it rolls against, so the command label cannot drift', () => {
    const attempt = attemptWildEscape(state.player, state.enemy, 0, () => 0.99);

    expect(attempt.chance).toBe(wildEscapeChanceFor(state.player, state.enemy, 0));
    expect(attempt.escaped).toBe(false);
  });

  it('escapes on a roll under the chance', () => {
    expect(attemptWildEscape(state.player, state.enemy, 0, () => 0).escaped).toBe(true);
  });

  it('always escapes once the attempt bonus has carried the chance to certainty', () => {
    expect(attemptWildEscape(state.player, state.enemy, 4, () => 0.999999).escaped).toBe(true);
  });
});
