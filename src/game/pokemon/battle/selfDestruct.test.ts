import { describe, expect, it } from 'vitest';
import { MoveBase } from '../MoveBase';
import { Move } from '../Move';
import { Pokemon } from '../Pokemon';
import type { PokemonBase } from '../PokemonBase';
import { TACKLE } from '../moves';
import { MOVE_CATALOGUE } from '../moveCatalogue';
import { getSpeciesById } from '../species';
import { bestDamagingMove } from '../../world/bestPlay';
import { createBattleState, resolveTurn, type BattleEvent } from './battleEngine';

/**
 * Self-Destruct and Explosion are FireRed's `EFFECT_EXPLOSION`: the user
 * faints for the blow, hit or miss, and the target's Defense is halved for it.
 * They came out of the import as plain 200- and 250-power hits reading "No side
 * effect.", so a Geodude or a Voltorb could throw the biggest number in the
 * game every turn and stay standing.
 */
const SELF_DESTRUCT = MOVE_CATALOGUE['self-destruct'];
const EXPLOSION = MOVE_CATALOGUE.explosion;

const species = (id: string): PokemonBase => {
  const found = getSpeciesById(id);
  if (!found) throw new Error(`no ${id}`);
  return found;
};

/** A Pokemon holding exactly these moves; none at all stands it still. */
const armed = (id: string, level: number, ...moves: readonly MoveBase[]): Pokemon => {
  const pokemon = new Pokemon(species(id), level);
  pokemon.moves.splice(0, pokemon.moves.length, ...moves.map((move) => new Move(move)));
  return pokemon;
};

/** Draws by number; the rest hit, do not crit and roll mid-spread. */
const at = (overrides: Readonly<Record<number, number>>, fallback = 0.5): (() => number) => {
  let index = 0;
  return () => overrides[index++] ?? fallback;
};

const fainted = (events: readonly BattleEvent[]): string[] =>
  events.filter((event) => event.type === 'fainted').map((event) => event.user);

describe('Self-Destruct and Explosion', () => {
  it('say what they cost in the move list, rather than "No side effect."', () => {
    for (const move of [SELF_DESTRUCT, EXPLOSION]) {
      expect(move.userFaints).toBe(true);
      expect(move.description).toContain('The user faints.');
      expect(move.description).not.toContain('No side effect');
    }
  });

  it('faint the user after the blow lands', () => {
    const geodude = armed('geodude', 25, SELF_DESTRUCT);
    const target = armed('snorlax', 60);
    const result = resolveTurn(createBattleState(geodude, target), 0, at({}));

    expect(result.state.enemy.currentHp).toBeLessThan(target.maxHp);
    expect(result.state.enemy.currentHp).toBeGreaterThan(0);
    expect(result.state.player.currentHp).toBe(0);
    expect(fainted(result.events)).toEqual(['player']);
  });

  it('faint the user on a miss too', () => {
    const voltorb = armed('voltorb', 30, EXPLOSION);
    const target = armed('snorlax', 60);
    // A 100-accuracy move only misses through a stage: the target is at +6
    // evasion, every roll is at the top of its range, and it knows no move.
    const state = createBattleState(voltorb, target);
    const dodging = { ...state, enemy: { ...state.enemy, statStages: { ...state.enemy.statStages, evasion: 6 } } };
    const result = resolveTurn(dodging, 0, at({}, 0.9999));

    expect(result.events.some((event) => event.type === 'missed')).toBe(true);
    expect(result.state.enemy.currentHp).toBe(target.maxHp);
    expect(result.state.player.currentHp).toBe(0);
  });

  it('halve the target’s Defense for the hit', () => {
    const plain = new MoveBase({
      name: SELF_DESTRUCT.name,
      type: SELF_DESTRUCT.type,
      power: SELF_DESTRUCT.power,
      accuracy: SELF_DESTRUCT.accuracy,
      pp: SELF_DESTRUCT.pp,
      category: SELF_DESTRUCT.category,
    });
    const dealt = (move: MoveBase): number => {
      const user = armed('geodude', 30, move);
      const target = armed('onix', 60);
      const result = resolveTurn(createBattleState(user, target), 0, at({}));
      return target.maxHp - result.state.enemy.currentHp;
    };

    expect(dealt(SELF_DESTRUCT)).toBeGreaterThan(dealt(plain) * 1.7);
  });

  it('are a last resort for the measured play, never its opening swing', () => {
    const both = createBattleState(armed('geodude', 25, SELF_DESTRUCT, TACKLE), armed('pidgey', 10));
    expect(bestDamagingMove(both)).toBe(1);

    const alone = createBattleState(armed('geodude', 25, SELF_DESTRUCT), armed('pidgey', 10));
    expect(bestDamagingMove(alone)).toBe(0);
  });
});
