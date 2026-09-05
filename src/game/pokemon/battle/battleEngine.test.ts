import { describe, expect, it } from 'vitest';
import { MoveCategory } from '../MoveBase';
import { Pokemon } from '../Pokemon';
import { PokemonType } from '../PokemonType';
import { EMBER, THUNDER_SHOCK, VINE_WHIP } from '../moves';
import { BULBASAUR, CHARMANDER, PIKACHU, SQUIRTLE } from '../species';
import { createBattleState, resolveTurn } from './battleEngine';
import { calculateDamage } from './damage';
import { getTypeEffectiveness } from './typeChart';

const maximumRandom = (): number => 1;

describe('Gen-1 type effectiveness', () => {
  it('multiplies dual-type weaknesses and resistances', () => {
    expect(getTypeEffectiveness(PokemonType.Fire, [PokemonType.Grass, PokemonType.Poison])).toBe(2);
    expect(getTypeEffectiveness(PokemonType.Electric, [PokemonType.Water, PokemonType.Flying])).toBe(4);
    expect(getTypeEffectiveness(PokemonType.Grass, [PokemonType.Fire])).toBe(0.5);
    expect(getTypeEffectiveness(PokemonType.Normal, [PokemonType.Ghost])).toBe(0);
  });
});

describe('damage calculation', () => {
  it('uses the appropriate stats, STAB, effectiveness, and injected random modifier', () => {
    const charmander = new Pokemon(CHARMANDER, 10);
    const bulbasaur = new Pokemon(BULBASAUR, 10);

    const emberDamage = calculateDamage(charmander, bulbasaur, EMBER, maximumRandom);
    const vineWhipDamage = calculateDamage(bulbasaur, charmander, VINE_WHIP, maximumRandom);

    expect(emberDamage).toEqual({ damage: 18, isStab: true, typeEffectiveness: 2 });
    expect(vineWhipDamage).toEqual({ damage: 5, isStab: true, typeEffectiveness: 0.5 });
  });

  it('does not damage with status moves', () => {
    const attacker = new Pokemon(CHARMANDER, 10);
    const defender = new Pokemon(BULBASAUR, 10);
    const growl = attacker.moves.find((move) => move.base.category === MoveCategory.Status);

    expect(growl).toBeDefined();
    expect(calculateDamage(attacker, defender, growl!.base, maximumRandom).damage).toBe(0);
  });
});

describe('battle turn resolution', () => {
  it('resolves attacks by speed without mutating the source Pokemon', () => {
    const charmander = new Pokemon(CHARMANDER, 10);
    const bulbasaur = new Pokemon(BULBASAUR, 10);
    const state = createBattleState(charmander, bulbasaur);

    const result = resolveTurn(state, 2, maximumRandom);

    expect(result.events.slice(0, 3)).toMatchObject([
      { type: 'used-move', user: 'player', move: 'Ember' },
      { type: 'effectiveness', multiplier: 2 },
      { type: 'used-move', user: 'enemy' },
    ]);
    expect(result.state.enemy.currentHp).toBe(bulbasaur.maxHp - 18);
    expect(result.state.player.currentHp).toBe(charmander.maxHp - 5);
    expect(result.state.player.moves[2]?.pp).toBe(EMBER.pp - 1);
    expect(charmander.currentHp).toBe(charmander.maxHp);
    expect(charmander.moves[2]?.pp).toBe(EMBER.pp);
  });

  it('ends the battle immediately when the faster enemy causes a faint', () => {
    const squirtle = new Pokemon(SQUIRTLE, 10);
    const pikachu = new Pokemon(PIKACHU, 10);
    const initialState = createBattleState(squirtle, pikachu);
    const state = { ...initialState, player: { ...initialState.player, currentHp: 1 } };

    const result = resolveTurn(state, 0, maximumRandom);

    expect(result.state.outcome).toBe('defeat');
    expect(result.state.player.currentHp).toBe(0);
    expect(result.events).toMatchObject([
      { type: 'used-move', user: 'enemy', move: THUNDER_SHOCK.name },
      { type: 'effectiveness', multiplier: 2 },
      { type: 'fainted', user: 'player', name: 'Squirtle' },
    ]);
  });
});
