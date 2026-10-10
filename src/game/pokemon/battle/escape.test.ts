import { describe, expect, it } from 'vitest';
import { Pokemon } from '../Pokemon';
import { BULBASAUR, CHARMANDER, PIDGEY } from '../species';
import { createBattleState } from './battleEngine';
import { attemptWildEscape, getWildEscapeChance, wildEscapeChanceFor } from './escape';

// FireRed's `TryRunFromBattle` (pret/pokefirered, src/battle_main.c): at least as
// fast always escapes; slower rolls `floor(mine * 128 / theirs) + 30 * runTries`
// against a byte.
describe('getWildEscapeChance', () => {
  it('always escapes between equally fast Pokemon', () => {
    expect(getWildEscapeChance(20, 20, 0)).toBe(1);
  });

  it('always escapes when the runner is faster, by any margin', () => {
    expect(getWildEscapeChance(8, 6, 0)).toBe(1);
    expect(getWildEscapeChance(21, 20, 0)).toBe(1);
    expect(getWildEscapeChance(500, 1, 0)).toBe(1);
  });

  it('gives the slower runner floor(128 * mine / theirs) of 256 on the first attempt', () => {
    expect(getWildEscapeChance(10, 30, 0)).toBe(42 / 256);
    expect(getWildEscapeChance(12, 16, 0)).toBe(96 / 256);
    expect(getWildEscapeChance(19, 20, 0)).toBe(121 / 256);
  });

  it('adds 30 of 256 for every attempt already spent, up to certainty', () => {
    const chances = [0, 1, 2, 3, 4, 5].map((attempts) => getWildEscapeChance(12, 16, attempts));

    expect(chances).toEqual([96, 126, 156, 186, 216, 246].map((value) => value / 256));
    expect(getWildEscapeChance(12, 16, 6)).toBe(1);
  });

  it('never wraps back down as FireRed`s u8 does, so the slowest still gets away by the tenth try', () => {
    const chances = Array.from({ length: 12 }, (_, attempts) => getWildEscapeChance(1, 500, attempts));

    expect(chances[0]).toBe(0);
    chances.slice(1).forEach((chance, index) => {
      expect(chance).toBeGreaterThanOrEqual(chances[index]);
    });
    expect(chances[8]).toBe(240 / 256);
    expect(chances[9]).toBe(1);
    expect(chances.at(-1)).toBe(1);
  });
});

describe('wildEscapeChanceFor', () => {
  it('lets a level-5 Charmander (Speed 8) always run from a level-3 Pidgey (Speed 6) - playtest 45', () => {
    const state = createBattleState(new Pokemon(CHARMANDER, 5), new Pokemon(PIDGEY, 3));

    expect(state.player.pokemon.stats.speed).toBe(8);
    expect(state.enemy.pokemon.stats.speed).toBe(6);
    expect(wildEscapeChanceFor(state.player, state.enemy, 0)).toBe(1);
    expect(attemptWildEscape(state.player, state.enemy, 0, () => 0.999999).escaped).toBe(true);
  });

  it('reads the plain Speed stat, as FireRed does, not a staged one', () => {
    const state = createBattleState(new Pokemon(CHARMANDER, 12), new Pokemon(BULBASAUR, 10));
    const slowed = { ...state.player, statStages: { ...state.player.statStages, speed: -6 } };

    expect(wildEscapeChanceFor(slowed, state.enemy, 0)).toBe(1);
  });
});

describe('attemptWildEscape', () => {
  // A level-20 Pidgey (Speed 16) outruns a level-12 Charmander (Speed 12).
  const state = createBattleState(new Pokemon(CHARMANDER, 12), new Pokemon(PIDGEY, 20));

  it('reports the same chance it rolls against, so the command label cannot drift', () => {
    const attempt = attemptWildEscape(state.player, state.enemy, 0, () => 0.99);

    expect(attempt.chance).toBe(wildEscapeChanceFor(state.player, state.enemy, 0));
    expect(attempt.chance).toBe(96 / 256);
    expect(attempt.escaped).toBe(false);
  });

  it('escapes on a roll under the chance', () => {
    expect(attemptWildEscape(state.player, state.enemy, 0, () => 0).escaped).toBe(true);
  });

  it('always escapes once the attempt bonus has carried the chance to certainty', () => {
    expect(attemptWildEscape(state.player, state.enemy, 6, () => 0.999999).escaped).toBe(true);
  });
});
