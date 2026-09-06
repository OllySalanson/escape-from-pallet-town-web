import { describe, expect, it } from 'vitest';
import { MoveBase, MoveCategory } from '../MoveBase';
import { Pokemon } from '../Pokemon';
import { PokemonType } from '../PokemonType';
import { EMBER, GROWL, POISON_POWDER, SING, SUPER_SONIC, TACKLE, THUNDER_WAVE } from '../moves';
import { BULBASAUR, BUTTERFREE, CHARMANDER, JIGGLYPUFF, PIDGEY, PIKACHU } from '../species';
import {
  chooseEnemyMove,
  createBattleState,
  replacePlayerPokemon,
  resolveEnemyTurn,
  resolveTurn,
} from './battleEngine';
import { calculateDamage } from './damage';
import { applyStatBoost, createStatStages, getStagedStat } from './statStages';
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

  it('uses a landed stat-lowering move when calculating subsequent damage', () => {
    const state = createBattleState(new Pokemon(CHARMANDER, 10), new Pokemon(BULBASAUR, 10));
    const growlState = {
      ...state,
      enemy: { ...state.enemy, moves: [{ base: GROWL, pp: GROWL.pp }] },
    };
    const lowered = resolveEnemyTurn(growlState, maximumRandom);

    expect(lowered.events).toContainEqual({
      type: 'stat-stage-changed',
      user: 'player',
      name: 'Charmander',
      stat: 'attack',
      stages: -1,
    });
    expect(lowered.state.player.statStages.attack).toBe(-1);
    expect(
      calculateDamage(
        lowered.state.player.pokemon,
        lowered.state.enemy.pokemon,
        TACKLE,
        maximumRandom,
        lowered.state.player.statStages,
        lowered.state.enemy.statStages,
      ).damage,
    ).toBeLessThan(calculateDamage(state.player.pokemon, state.enemy.pokemon, TACKLE, maximumRandom).damage);
  });
});

describe('stat stages', () => {
  it('uses Unity stage multipliers and floors negative-stage results', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((stage) => getStagedStat(10, stage))).toEqual([10, 15, 20, 25, 30, 35, 40]);
    expect([0, -1, -2, -3, -4, -5, -6].map((stage) => getStagedStat(10, stage))).toEqual([10, 6, 5, 4, 3, 2, 2]);
  });

  it('clamps stat boosts between negative and positive six stages', () => {
    const raised = applyStatBoost(createStatStages(), { stat: 'speed', stages: 9 });
    const lowered = applyStatBoost(raised, { stat: 'speed', stages: -20 });

    expect(raised.speed).toBe(6);
    expect(lowered.speed).toBe(-6);
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

  it('allows a healthy replacement and gives the enemy the next move', () => {
    const charmander = new Pokemon(CHARMANDER, 10);
    const pidgey = new Pokemon(PIDGEY, 10);
    const enemy = new Pokemon(BULBASAUR, 10);
    const state = createBattleState(charmander, enemy);

    const switchedState = replacePlayerPokemon(state, pidgey);
    const result = resolveEnemyTurn(switchedState, maximumRandom);

    expect(result.state.player.pokemon).toBe(pidgey);
    expect(result.events[0]).toMatchObject({ type: 'used-move', user: 'enemy' });
    expect(result.state.player.currentHp).toBeLessThan(pidgey.maxHp);
    expect(result.state.enemy.currentHp).toBe(enemy.maxHp);
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
      { type: 'stat-stage-changed', user: 'player', stat: 'attack', stages: -1 },
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

describe('status conditions', () => {
  const enemyAction = (
    primaryStatus: 'poison' | 'burn' | 'paralysis' | 'sleep' | 'freeze' | null,
    random: () => number,
    overrides: Partial<ReturnType<typeof createBattleState>['enemy']> = {},
  ) => {
    const state = createBattleState(new Pokemon(CHARMANDER, 10), new Pokemon(BULBASAUR, 10));
    return resolveEnemyTurn(
      {
        ...state,
        enemy: { ...state.enemy, primaryStatus, moves: [state.enemy.moves[0]], ...overrides },
      },
      random,
    );
  };

  it('applies all wired status moves and refuses duplicate primary or volatile conditions', () => {
    const player = new Pokemon(CHARMANDER, 10);
    const statusMoves = [
      [new Pokemon(BUTTERFREE, 10), POISON_POWDER, 'poison'],
      [new Pokemon(JIGGLYPUFF, 10), SING, 'sleep'],
      [new Pokemon(PIKACHU, 10), THUNDER_WAVE, 'paralysis'],
      [new Pokemon(BULBASAUR, 10), SUPER_SONIC, 'confusion'],
    ] as const;

    for (const [enemy, move, status] of statusMoves) {
      const initial = createBattleState(player, enemy);
      const state = { ...initial, enemy: { ...initial.enemy, moves: [{ base: move, pp: move.pp }] } };
      const applied = resolveEnemyTurn(state, maximumRandom);
      expect(applied.events).toContainEqual({ type: 'status-applied', user: 'player', name: 'Charmander', status });

      const duplicate = resolveEnemyTurn({ ...applied.state, enemy: state.enemy }, maximumRandom);
      expect(duplicate.events).toContainEqual({ type: 'status-already', user: 'player', name: 'Charmander', status });
    }
  });

  it('deals floor(max HP / 8) poison damage after the afflicted Pokemon acts', () => {
    const result = enemyAction('poison', maximumRandom);
    const maxHp = result.state.enemy.pokemon.maxHp;

    expect(result.state.enemy.currentHp).toBe(maxHp - Math.floor(maxHp / 8));
    expect(result.events).toContainEqual({
      type: 'status-damage',
      user: 'enemy',
      name: 'Bulbasaur',
      status: 'poison',
      damage: Math.floor(maxHp / 8),
    });
  });

  it('deals floor(max HP / 16) burn damage without changing attack', () => {
    const result = enemyAction('burn', maximumRandom);
    const maxHp = result.state.enemy.pokemon.maxHp;

    expect(result.state.enemy.currentHp).toBe(maxHp - Math.floor(maxHp / 16));
    expect(result.state.enemy.pokemon.stats.attack).toBe(new Pokemon(BULBASAUR, 10).stats.attack);
  });

  it('uses the pinned 25 percent paralysis roll to prevent an action', () => {
    const result = enemyAction('paralysis', () => 0);

    expect(result.events).toContainEqual({
      type: 'status-prevented',
      user: 'enemy',
      name: 'Bulbasaur',
      status: 'paralysis',
    });
    expect(result.events.some((event) => event.type === 'used-move')).toBe(false);
  });

  it('thaws at 25 percent and otherwise prevents frozen actions', () => {
    const thawed = enemyAction('freeze', (() => {
      const rolls = [0, 0.24, 0, 1, 1];
      return () => rolls.shift() ?? 1;
    })());
    const frozen = enemyAction('freeze', (() => {
      const rolls = [0, 0.25];
      return () => rolls.shift() ?? 1;
    })());

    expect(thawed.events).toContainEqual({ type: 'status-cured', user: 'enemy', name: 'Bulbasaur', status: 'freeze' });
    expect(thawed.events.some((event) => event.type === 'used-move')).toBe(true);
    expect(frozen.events).toContainEqual({ type: 'status-prevented', user: 'enemy', name: 'Bulbasaur', status: 'freeze' });
  });

  it('sleeps for its rolled duration then wakes before acting', () => {
    const sleeping = enemyAction('sleep', maximumRandom, { sleepTurns: 1 });
    const awake = resolveEnemyTurn(sleeping.state, maximumRandom);

    expect(sleeping.state.enemy.sleepTurns).toBe(0);
    expect(sleeping.events).toContainEqual({ type: 'status-prevented', user: 'enemy', name: 'Bulbasaur', status: 'sleep' });
    expect(awake.state.enemy.primaryStatus).toBeNull();
    expect(awake.events).toContainEqual({ type: 'status-cured', user: 'enemy', name: 'Bulbasaur', status: 'sleep' });
    expect(awake.events.some((event) => event.type === 'used-move')).toBe(true);
  });

  it('uses the pinned 50 percent confusion roll for self-damage and clears on expiry', () => {
    const result = enemyAction(null, (() => {
      const rolls = [0, 0.5];
      return () => rolls.shift() ?? 1;
    })(), { confusionTurns: 1 });
    const maxHp = result.state.enemy.pokemon.maxHp;

    expect(result.state.enemy.currentHp).toBe(maxHp - Math.floor(maxHp / 8));
    expect(result.state.enemy.confusionTurns).toBe(0);
    expect(result.events).toContainEqual({
      type: 'confusion-self-hit',
      user: 'enemy',
      name: 'Bulbasaur',
      damage: Math.floor(maxHp / 8),
    });
    expect(result.events).toContainEqual({ type: 'status-cured', user: 'enemy', name: 'Bulbasaur', status: 'confusion' });
  });
});
