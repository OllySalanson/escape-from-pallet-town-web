import { describe, expect, it } from 'vitest';
import { MoveBase, MoveCategory } from '../MoveBase';
import { Pokemon } from '../Pokemon';
import { PokemonType } from '../PokemonType';
import { EMBER, TACKLE } from '../moves';
import { BULBASAUR, CHARMANDER, PIDGEY, PIKACHU } from '../species';
import { chooseEnemyMove, createBattleState, resolveTurn } from './battleEngine';
import { calculateDamage } from './damage';
import { getTypeEffectiveness } from './typeChart';

const maximumRandom = (): number => 1;

const typeOrder = [
  PokemonType.Normal,
  PokemonType.Fire,
  PokemonType.Water,
  PokemonType.Electric,
  PokemonType.Grass,
  PokemonType.Ice,
  PokemonType.Fighting,
  PokemonType.Poison,
  PokemonType.Ground,
  PokemonType.Flying,
  PokemonType.Psychic,
  PokemonType.Bug,
  PokemonType.Rock,
  PokemonType.Ghost,
  PokemonType.Dragon,
] as const;

// PokemonBase.cs, attacker rows and defender columns in the order above.
const unityTypeMatrix: readonly (readonly number[])[] = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.5, 0, 1],
  [1, 0.5, 0.5, 1, 2, 2, 1, 1, 1, 1, 1, 2, 0.5, 1, 0.5],
  [1, 2, 0.5, 2, 0.5, 1, 1, 1, 2, 1, 1, 1, 2, 1, 0.5],
  [1, 1, 2, 0.5, 0.5, 2, 1, 1, 0, 2, 1, 1, 1, 1, 0.5],
  [1, 0.5, 2, 2, 0.5, 1, 1, 0.5, 2, 0.5, 1, 0.5, 2, 1, 0.5],
  [1, 0.5, 0.5, 1, 2, 0.5, 1, 1, 2, 2, 1, 1, 1, 1, 2],
  [2, 1, 1, 1, 1, 2, 1, 0.5, 1, 0.5, 0.5, 0.5, 2, 0, 1],
  [1, 1, 1, 1, 2, 1, 1, 0.5, 0.5, 1, 1, 1, 0.5, 0.5, 1],
  [1, 2, 1, 2, 0.5, 1, 1, 2, 1, 0, 1, 0.5, 2, 1, 1],
  [1, 1, 1, 0.5, 2, 1, 2, 1, 1, 1, 1, 2, 0.5, 1, 1],
  [1, 1, 1, 1, 1, 1, 2, 2, 1, 1, 0.5, 1, 1, 1, 1],
  [1, 0.5, 1, 1, 2, 1, 0.5, 0.5, 1, 0.5, 2, 1, 1, 0.5, 1],
  [1, 2, 1, 1, 1, 2, 0.5, 1, 0.5, 2, 1, 2, 1, 1, 1],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 2, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2],
];

describe('Unity type-chart regression', () => {
  it('matches every value in the canonical 15 by 15 matrix', () => {
    for (const [attackerIndex, attackingType] of typeOrder.entries()) {
      for (const [defenderIndex, defendingType] of typeOrder.entries()) {
        expect(getTypeEffectiveness(attackingType, [defendingType])).toBe(
          unityTypeMatrix[attackerIndex]?.[defenderIndex],
        );
      }
    }
  });

  it('multiplies dual-type matchups and treats an absent defender type as neutral', () => {
    expect(getTypeEffectiveness(PokemonType.Electric, [PokemonType.Water, PokemonType.Flying])).toBe(4);
    expect(getTypeEffectiveness(PokemonType.Fire, [PokemonType.Grass, PokemonType.Poison])).toBe(2);
    expect(getTypeEffectiveness(PokemonType.Fire, [])).toBe(1);
  });
});

describe('damage calculation', () => {
  it('reports STAB while retaining the current unmultiplied damage result', () => {
    const charmander = new Pokemon(CHARMANDER, 10);
    const bulbasaur = new Pokemon(BULBASAUR, 10);

    const emberDamage = calculateDamage(charmander, bulbasaur, EMBER, maximumRandom);

    expect(emberDamage).toEqual({
      damage: 13,
      isStab: true,
      isCritical: false,
      typeEffectiveness: 2,
    });
  });

  it('calculates a non-STAB physical move with exact fixed rolls', () => {
    const charmander = new Pokemon(CHARMANDER, 10);
    const bulbasaur = new Pokemon(BULBASAUR, 10);

    expect(calculateDamage(charmander, bulbasaur, TACKLE, maximumRandom)).toEqual({
      damage: 7,
      isStab: false,
      isCritical: false,
      typeEffectiveness: 1,
    });
  });

  it('selects attack and defense for physical moves, special attack and defense for special moves', () => {
    const physicalFireMove = new MoveBase({ ...EMBER, category: MoveCategory.Physical });
    const charmander = new Pokemon(CHARMANDER, 10);
    const bulbasaur = new Pokemon(BULBASAUR, 10);

    expect(calculateDamage(charmander, bulbasaur, physicalFireMove, maximumRandom).damage).toBe(14);
    expect(calculateDamage(charmander, bulbasaur, EMBER, maximumRandom).damage).toBe(13);
  });

  it('does not damage with status moves', () => {
    const attacker = new Pokemon(CHARMANDER, 10);
    const defender = new Pokemon(BULBASAUR, 10);
    const growl = attacker.moves.find((move) => move.base.category === MoveCategory.Status);

    expect(growl).toBeDefined();
    expect(calculateDamage(attacker, defender, growl!.base, maximumRandom).damage).toBe(0);
  });

  it('uses the configured 6.25 percent critical chance and 2x multiplier', () => {
    const attacker = new Pokemon(CHARMANDER, 10);
    const defender = new Pokemon(BULBASAUR, 10);
    const rolls = [0.0625, 1];
    const criticalDamage = calculateDamage(attacker, defender, EMBER, () => rolls.shift() ?? 1);

    expect(criticalDamage).toMatchObject({ isCritical: true, damage: 27, typeEffectiveness: 2 });
  });

  it('scales damage with attacker level', () => {
    const defender = new Pokemon(BULBASAUR, 10);

    expect(calculateDamage(new Pokemon(CHARMANDER, 5), defender, TACKLE, maximumRandom).damage).toBe(4);
    expect(calculateDamage(new Pokemon(CHARMANDER, 20), defender, TACKLE, maximumRandom).damage).toBe(15);
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
    expect(result.state.enemy.currentHp).toBe(bulbasaur.maxHp - 13);
    expect(result.state.player.currentHp).toBe(charmander.maxHp - 3);
    expect(result.state.player.moves[2]?.pp).toBe(EMBER.pp - 1);
    expect(charmander.currentHp).toBe(charmander.maxHp);
    expect(charmander.moves[2]?.pp).toBe(EMBER.pp);
  });

  it('ends the battle immediately when the faster enemy causes a faint', () => {
    const pidgey = new Pokemon(PIDGEY, 10);
    const pikachu = new Pokemon(PIKACHU, 10);
    const initialState = createBattleState(pidgey, pikachu);
    const state = {
      ...initialState,
      player: { ...initialState.player, currentHp: 1 },
      enemy: { ...initialState.enemy, moves: [initialState.enemy.moves[0]] },
    };

    const result = resolveTurn(state, 0, maximumRandom);

    expect(result.state.outcome).toBe('defeat');
    expect(result.state.player.currentHp).toBe(0);
    expect(result.events).toMatchObject([
      { type: 'used-move', user: 'enemy', move: TACKLE.name },
      { type: 'fainted', user: 'player', name: 'Pidgey' },
    ]);
  });

  it('selects only legal enemy moves and decrements PP for each combatant', () => {
    const state = createBattleState(new Pokemon(CHARMANDER, 10), new Pokemon(BULBASAUR, 10));
    const constrainedState = {
      ...state,
      player: { ...state.player, moves: [state.player.moves[0]] },
      enemy: {
        ...state.enemy,
        moves: state.enemy.moves.map((move, index) => ({ ...move, pp: index === 1 ? 1 : 0 })),
      },
    };

    expect(chooseEnemyMove(constrainedState.enemy, maximumRandom)).toBe(1);

    const result = resolveTurn(constrainedState, 0, maximumRandom);
    expect(result.events).toMatchObject([
      { type: 'used-move', user: 'player' },
      { type: 'used-move', user: 'enemy', move: 'Growl' },
    ]);
    expect(result.state.player.moves[0]?.pp).toBe(state.player.moves[0].pp - 1);
    expect(result.state.enemy.moves[1]?.pp).toBe(0);
  });

  it('resolves the faster combatant first for a fixed speed pair', () => {
    const state = createBattleState(new Pokemon(PIDGEY, 10), new Pokemon(PIKACHU, 10));
    const result = resolveTurn(state, 0, maximumRandom);

    expect(result.events.filter((event) => event.type === 'used-move')).toMatchObject([
      { user: 'enemy', move: 'Thunder Wave' },
      { user: 'player', move: TACKLE.name },
    ]);
  });

  it('reports a miss when the accuracy roll fails', () => {
    const inaccurateMove = new MoveBase({
      name: 'Risky Strike',
      type: PokemonType.Normal,
      power: 40,
      accuracy: 50,
      pp: 10,
      category: MoveCategory.Physical,
    });
    const initial = createBattleState(new Pokemon(CHARMANDER, 10), new Pokemon(BULBASAUR, 10));
    const state = { ...initial, player: { ...initial.player, moves: [{ base: inaccurateMove, pp: 10 }] } };
    const result = resolveTurn(state, 0, () => 0.999999);

    expect(result.events).toContainEqual({ type: 'missed', user: 'player' });
    expect(result.state.enemy.currentHp).toBe(state.enemy.currentHp);
  });
});
