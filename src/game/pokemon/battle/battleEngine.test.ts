import { describe, expect, it } from 'vitest';
import { MoveBase, MoveCategory } from '../MoveBase';
import { Pokemon, experienceForLevel } from '../Pokemon';
import { PokemonType } from '../PokemonType';
import {
  BITE,
  EMBER,
  GROWL,
  METAL_CLAW,
  POISON_POWDER,
  SING,
  SUPER_SONIC,
  TACKLE,
  TAIL_WHIP,
  THUNDER_WAVE,
} from '../moves';
import { BULBASAUR, BUTTERFREE, CHARMANDER, JIGGLYPUFF, PIDGEY, PIKACHU, SQUIRTLE } from '../species';
import {
  attemptCatch,
  chooseEnemyMove,
  createBattleState,
  createTrainerBattleState,
  getCatchChance,
  persistCombatantToPokemon,
  refreshCombatantAfterLevelUp,
  replacePlayerPokemon,
  resolveCatchAttempt,
  resolveEnemyTurn,
  resolveTurn,
} from './battleEngine';
import { PrimaryStatus } from './status';
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
  PokemonType.Dark,
  PokemonType.Steel,
] as const;

/**
 * Generation III's whole chart for the seventeen types this game has, attacker
 * rows and defender columns in the order above.
 *
 * This is a second, independently typed copy of `typeChart.ts`'s matrix, so a
 * mistyped cell in either one fails here rather than in a battle.
 *
 * The chart used to be fifteen wide, under a comment asserting that "fifteen
 * types is the whole chart for the original 151". **That is true of generation
 * I only.** Dark and Steel arrived in generation II and are live in
 * FireRed/LeafGreen: Magnemite and Magneton are Electric/Steel, and twelve Dark
 * and Steel moves are learnt by level by fifty of the 151 - Charmander's Metal
 * Claw and Squirtle's Bite among them. Fairy is the one of the modern three
 * that really is later (generation VI), so it stays out and this is seventeen.
 *
 * Fifteen of these rows are `PokemonBase.cs`'s matrix with three cells put
 * right, which the captain ruled on 2026-09-19 should happen when the roster
 * grew: Water into Electric, Grass into Electric and Electric into Ice were all
 * 2x there and are 1x in canon. The two new rows and two new columns are
 * generation III's, back-dated from PokeAPI's type damage relations rather than
 * copied from a modern chart - which matters in two cells a modern chart gets
 * differently: **Dark into Steel and Ghost into Steel are 0.5x here**, raised to
 * neutral in generation VI.
 */
const generationThreeTypeMatrix: readonly (readonly number[])[] = [
  //        nor  fir  wat  ele  gra  ice  fig  poi  gro  fly  psy  bug  roc  gho  dra  dar  ste
  /* nor */ [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.5, 0, 1, 1, 0.5],
  /* fir */ [1, 0.5, 0.5, 1, 2, 2, 1, 1, 1, 1, 1, 2, 0.5, 1, 0.5, 1, 2],
  /* wat */ [1, 2, 0.5, 1, 0.5, 1, 1, 1, 2, 1, 1, 1, 2, 1, 0.5, 1, 1],
  /* ele */ [1, 1, 2, 0.5, 0.5, 1, 1, 1, 0, 2, 1, 1, 1, 1, 0.5, 1, 1],
  /* gra */ [1, 0.5, 2, 1, 0.5, 1, 1, 0.5, 2, 0.5, 1, 0.5, 2, 1, 0.5, 1, 0.5],
  /* ice */ [1, 0.5, 0.5, 1, 2, 0.5, 1, 1, 2, 2, 1, 1, 1, 1, 2, 1, 0.5],
  /* fig */ [2, 1, 1, 1, 1, 2, 1, 0.5, 1, 0.5, 0.5, 0.5, 2, 0, 1, 2, 2],
  /* poi */ [1, 1, 1, 1, 2, 1, 1, 0.5, 0.5, 1, 1, 1, 0.5, 0.5, 1, 1, 0],
  /* gro */ [1, 2, 1, 2, 0.5, 1, 1, 2, 1, 0, 1, 0.5, 2, 1, 1, 1, 2],
  /* fly */ [1, 1, 1, 0.5, 2, 1, 2, 1, 1, 1, 1, 2, 0.5, 1, 1, 1, 0.5],
  /* psy */ [1, 1, 1, 1, 1, 1, 2, 2, 1, 1, 0.5, 1, 1, 1, 1, 0, 0.5],
  /* bug */ [1, 0.5, 1, 1, 2, 1, 0.5, 0.5, 1, 0.5, 2, 1, 1, 0.5, 1, 2, 0.5],
  /* roc */ [1, 2, 1, 1, 1, 2, 0.5, 1, 0.5, 2, 1, 2, 1, 1, 1, 1, 0.5],
  /* gho */ [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 2, 1, 0.5, 0.5],
  /* dra */ [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 0.5],
  /* dar */ [1, 1, 1, 1, 1, 1, 0.5, 1, 1, 1, 2, 1, 1, 2, 1, 0.5, 0.5],
  /* ste */ [1, 0.5, 0.5, 0.5, 1, 2, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 0.5],
];

describe('generation III type-chart regression', () => {
  it('matches every value in the canonical 17 by 17 matrix', () => {
    for (const [attackerIndex, attackingType] of typeOrder.entries()) {
      for (const [defenderIndex, defendingType] of typeOrder.entries()) {
        expect(getTypeEffectiveness(attackingType, [defendingType])).toBe(
          generationThreeTypeMatrix[attackerIndex]?.[defenderIndex],
        );
      }
    }
  });

  it('multiplies dual-type matchups and treats an absent defender type as neutral', () => {
    expect(getTypeEffectiveness(PokemonType.Electric, [PokemonType.Water, PokemonType.Flying])).toBe(4);
    expect(getTypeEffectiveness(PokemonType.Fire, [PokemonType.Grass, PokemonType.Poison])).toBe(2);
    expect(getTypeEffectiveness(PokemonType.Fire, [])).toBe(1);
  });

  it('covers every type in both directions, so none falls off the chart', () => {
    expect(typeOrder).toHaveLength(17);
    expect(generationThreeTypeMatrix).toHaveLength(17);
    for (const row of generationThreeTypeMatrix) {
      expect(row).toHaveLength(17);
    }
    // A type missing from the chart's own order resolves to index -1 and would
    // silently read a neighbouring row. Every type in the enum must be in it.
    for (const type of Object.values(PokemonType)) {
      expect(typeOrder).toContain(type);
    }
  });

  it('keeps Dark and Steel on generation III values rather than a modern chart', () => {
    // Generation VI raised both of these to neutral. This game is generation III.
    expect(getTypeEffectiveness(PokemonType.Dark, [PokemonType.Steel])).toBe(0.5);
    expect(getTypeEffectiveness(PokemonType.Ghost, [PokemonType.Steel])).toBe(0.5);
    // The matchups that put Dark and Steel in the game in the first place.
    expect(getTypeEffectiveness(PokemonType.Dark, [PokemonType.Psychic])).toBe(2);
    expect(getTypeEffectiveness(PokemonType.Psychic, [PokemonType.Dark])).toBe(0);
    expect(getTypeEffectiveness(PokemonType.Steel, [PokemonType.Rock])).toBe(2);
    expect(getTypeEffectiveness(PokemonType.Poison, [PokemonType.Steel])).toBe(0);
    // Magnemite and Magneton are Electric/Steel in generation III, so a Ground
    // move against one is 2x for the Electric half and 2x again for the Steel.
    expect(getTypeEffectiveness(PokemonType.Ground, [PokemonType.Electric, PokemonType.Steel])).toBe(4);
  });

  it('prices the two Dark and Steel moves a starter actually carries', () => {
    // Metal Claw is Steel and Physical; Bite is Dark and Special. Generation III
    // decides physical against special by the move's *type*, so a modern dex
    // disagrees about Bite - the per-move split is generation IV.
    expect(METAL_CLAW.type).toBe(PokemonType.Steel);
    expect(METAL_CLAW.category).toBe(MoveCategory.Physical);
    expect(BITE.type).toBe(PokemonType.Dark);
    expect(BITE.category).toBe(MoveCategory.Special);

    // Charmander's own Metal Claw against another Fire type: Steel resists Fire.
    expect(getTypeEffectiveness(METAL_CLAW.type, [CHARMANDER.primaryType])).toBe(0.5);
    // Squirtle's Bite is neutral into everything this roster fields, which is
    // the honest state of a seventeen-type chart with no Psychic or Ghost in it.
    expect(getTypeEffectiveness(BITE.type, [BULBASAUR.primaryType, BULBASAUR.secondaryType!])).toBe(1);
  });
});

describe('damage calculation', () => {
  it('applies the standard 1.5x STAB multiplier', () => {
    const charmander = new Pokemon(CHARMANDER, 10);
    const bulbasaur = new Pokemon(BULBASAUR, 10);

    const emberDamage = calculateDamage(charmander, bulbasaur, EMBER, maximumRandom);

    expect(emberDamage).toEqual({
      damage: 20,
      recoil: 0,
      isStab: true,
      isCritical: false,
      typeEffectiveness: 2,
      abilityNotes: [],
    });
  });

  it('calculates a non-STAB physical move with exact fixed rolls', () => {
    const charmander = new Pokemon(CHARMANDER, 10);
    const bulbasaur = new Pokemon(BULBASAUR, 10);

    expect(calculateDamage(charmander, bulbasaur, TACKLE, maximumRandom)).toEqual({
      damage: 7,
      recoil: 0,
      isStab: false,
      isCritical: false,
      typeEffectiveness: 1,
      // No abilities were passed, so none were read: this is the formula on its own.
      abilityNotes: [],
    });
  });

  it('selects attack and defense for physical moves, special attack and defense for special moves', () => {
    const physicalFireMove = new MoveBase({
      name: EMBER.name,
      type: EMBER.type,
      power: EMBER.power,
      accuracy: EMBER.accuracy,
      pp: EMBER.pp,
      category: MoveCategory.Physical,
    });
    const charmander = new Pokemon(CHARMANDER, 10);
    const bulbasaur = new Pokemon(BULBASAUR, 10);

    expect(calculateDamage(charmander, bulbasaur, physicalFireMove, maximumRandom).damage).toBe(22);
    expect(calculateDamage(charmander, bulbasaur, EMBER, maximumRandom).damage).toBe(20);
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

    expect(criticalDamage).toMatchObject({ isCritical: true, damage: 40, typeEffectiveness: 2 });
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

  it('raises the damage a landed Tail Whip lets through, the mirror of Growl', () => {
    const opening = createBattleState(new Pokemon(SQUIRTLE, 5), new Pokemon(BULBASAUR, 5));
    // The enemy is held to Tackle so its own Growl cannot mask the change.
    const state = {
      ...opening,
      enemy: { ...opening.enemy, moves: [{ base: TACKLE, pp: TACKLE.pp }] },
    };
    const tailWhipIndex = state.player.moves.findIndex((move) => move.base === TAIL_WHIP);
    expect(tailWhipIndex).toBeGreaterThanOrEqual(0);

    const lowered = resolveTurn(state, tailWhipIndex, maximumRandom);

    expect(lowered.events).toContainEqual({
      type: 'stat-stage-changed',
      user: 'enemy',
      name: 'Bulbasaur',
      stat: 'defense',
      stages: -1,
    });
    expect(
      calculateDamage(
        lowered.state.player.pokemon,
        lowered.state.enemy.pokemon,
        TACKLE,
        maximumRandom,
        lowered.state.player.statStages,
        lowered.state.enemy.statStages,
      ).damage,
    ).toBeGreaterThan(
      calculateDamage(state.player.pokemon, state.enemy.pokemon, TACKLE, maximumRandom).damage,
    );
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

    expect(result.events.slice(0, 2)).toMatchObject([
      { type: 'used-move', user: 'player', move: 'Ember' },
      { type: 'effectiveness', multiplier: 2 },
    ]);
    expect(result.events.some((event) => event.type === 'used-move' && event.user === 'enemy')).toBe(
      true,
    );
    expect(result.state.enemy.currentHp).toBe(bulbasaur.maxHp - 20);
    // Ember leaves Bulbasaur on 4 of 24, which is inside the third that turns
    // Overgrow on, so the Vine Whip that answers is 1.5x rather than 5 HP. The
    // pinch ability is exactly this: the last of a Pokemon's health is its
    // most dangerous.
    expect(result.state.player.currentHp).toBe(charmander.maxHp - 8);
    expect(
      result.events.some((event) => event.type === 'ability' && event.effect === 'powered-up'),
    ).toBe(true);
    expect(result.state.player.moves[2]?.pp).toBe(EMBER.pp - 1);
    expect(charmander.currentHp).toBe(charmander.maxHp);
    expect(charmander.moves[2]?.pp).toBe(EMBER.pp);
  });

  it('reports the same-type bonus on a damaging hit so its 1.5x is visible', () => {
    const charmander = new Pokemon(CHARMANDER, 10);
    const result = resolveTurn(createBattleState(charmander, new Pokemon(BULBASAUR, 10)), 2, maximumRandom);
    const [ember] = result.events.filter(
      (event) => event.type === 'used-move' && event.move === 'Ember',
    );

    expect(ember).toMatchObject({ type: 'used-move', isStab: true });
    // Scratch is Normal on a Fire attacker, so it must not claim the bonus.
    const scratch = resolveTurn(createBattleState(charmander, new Pokemon(BULBASAUR, 10)), 0, maximumRandom)
      .events.find((event) => event.type === 'used-move' && event.move === 'Scratch');
    expect(scratch).toMatchObject({ isStab: false });
  });

  /**
   * Playtest 3, B6b: at 2 HP, "Foe BULBASAUR used TACKLE! -5 HP". The line
   * promises the HP the hit cost, and a hit cannot cost more than was there.
   */
  it('reports the HP a finishing hit took rather than the damage it rolled', () => {
    const bulbasaur = new Pokemon(BULBASAUR, 10);
    bulbasaur.takeDamage(bulbasaur.maxHp - 2);
    const result = resolveTurn(createBattleState(new Pokemon(CHARMANDER, 10), bulbasaur), 0, maximumRandom);
    const scratch = result.events.find((event) => event.type === 'used-move' && event.move === 'Scratch');

    expect(scratch).toMatchObject({ damage: 2 });
    expect(result.state.enemy.currentHp).toBe(0);
  });

  it('does not narrate type effectiveness for a move that deals no damage', () => {
    // Poison Powder is Poison and Bulbasaur is part Grass, so the old code
    // announced "It's super effective!" for a status move that dealt nothing.
    const butterfree = new Pokemon(BUTTERFREE, 12);
    const powderIndex = butterfree.moves.findIndex((move) => move.base === POISON_POWDER);
    const result = resolveTurn(createBattleState(butterfree, new Pokemon(BULBASAUR, 10)), powderIndex, maximumRandom);
    // Butterfree is faster, so its own action is everything before the reply.
    const enemyReplyIndex = result.events.findIndex(
      (event) => event.type === 'used-move' && event.user === 'enemy',
    );
    const powderEvents = result.events.slice(0, enemyReplyIndex);

    expect(powderEvents[0]).toMatchObject({ type: 'used-move', move: 'Poison Powder' });
    // Butterfree's Compound Eyes introduces itself once, after the move it aimed.
    expect(powderEvents[1]).toMatchObject({ type: 'ability', effect: 'sharpened' });
    expect(powderEvents.filter((event) => event.type === 'effectiveness')).toEqual([]);
    expect(powderEvents.some((event) => event.type === 'status-applied')).toBe(true);
  });

  it('identifies same-species attack targets and preserves their independent HP deltas', () => {
    const player = new Pokemon(BULBASAUR, 10);
    const enemy = new Pokemon(BULBASAUR, 10);
    const result = resolveTurn(createBattleState(player, enemy), 2, maximumRandom);
    const attacks = result.events.filter((event) => event.type === 'used-move');

    expect(attacks).toHaveLength(2);
    const [playerAttack, enemyAttack] = attacks;
    if (!playerAttack || !enemyAttack || playerAttack.damage === undefined || enemyAttack.damage === undefined) {
      throw new Error('Expected both Bulbasaur attacks to have damage metadata.');
    }
    expect(playerAttack).toMatchObject({ user: 'player', target: 'enemy', name: 'Bulbasaur' });
    expect(enemyAttack).toMatchObject({ user: 'enemy', target: 'player', name: 'Bulbasaur' });
    expect(result.state.enemy.currentHp).toBe(enemy.maxHp - playerAttack.damage);
    expect(result.state.player.currentHp).toBe(player.maxHp - enemyAttack.damage);
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

    const switchedState = replacePlayerPokemon(state, pidgey).state;
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
        moves: state.enemy.moves.map((move, index) => ({ ...move, pp: index === 2 ? 1 : 0 })),
      },
    };

    expect(chooseEnemyMove(constrainedState.enemy, maximumRandom)).toBe(2);

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
    expect(result.state.player.moves[0]?.pp).toBe(9);
  });

  it('does not spend PP when a status prevents an action', () => {
    const initial = createBattleState(new Pokemon(CHARMANDER, 10), new Pokemon(BULBASAUR, 10));
    const state = { ...initial, player: { ...initial.player, primaryStatus: PrimaryStatus.Paralysis } };
    const result = resolveTurn(state, 0, () => 0);

    expect(result.events).toContainEqual({
      type: 'status-prevented',
      user: 'player',
      name: 'Charmander',
      status: PrimaryStatus.Paralysis,
    });
    expect(result.state.player.moves[0]?.pp).toBe(state.player.moves[0]?.pp);
  });

  it('persists bounded PP for the active party member across a switch or battle return', () => {
    const player = new Pokemon(CHARMANDER, 10);
    const initial = createBattleState(player, new Pokemon(BULBASAUR, 10));
    const afterTurn = resolveTurn(initial, 0, maximumRandom).state;
    const initialPp = initial.player.moves[0]?.pp;
    if (initialPp === undefined) {
      throw new Error('Charmander should have a first move.');
    }

    persistCombatantToPokemon(afterTurn.player);
    expect(player.moves[0]?.pp).toBe(afterTurn.player.moves[0]?.pp);

    const pidgey = new Pokemon(PIDGEY, 10);
    const switched = replacePlayerPokemon(afterTurn, pidgey).state;
    const afterSwitch = resolveEnemyTurn(switched, maximumRandom).state;
    persistCombatantToPokemon(afterSwitch.player);
    persistCombatantToPokemon(afterTurn.player);
    expect(player.moves[0]?.pp).toBe(initialPp - 1);
    expect(pidgey.moves[0]?.pp).toBe(afterSwitch.player.moves[0]?.pp);
  });
});

describe('catching', () => {
  it('raises catch chance as HP falls and for qualifying status and ball modifiers', () => {
    expect(getCatchChance(100, 100, null)).toBe(0.2);
    expect(getCatchChance(1, 100, null)).toBeCloseTo(0.794);
    expect(getCatchChance(100, 100, PrimaryStatus.Paralysis)).toBeCloseTo(0.35);
    expect(getCatchChance(100, 100, PrimaryStatus.Sleep)).toBeCloseTo(0.45);
    expect(getCatchChance(100, 100, PrimaryStatus.Sleep, 2)).toBeCloseTo(0.9);
    expect(getCatchChance(0, 100, PrimaryStatus.Sleep, 2)).toBe(0.95);
  });

  it('uses pinned boundary rolls and produces classic shake counts', () => {
    const state = createBattleState(new Pokemon(CHARMANDER, 10), new Pokemon(BULBASAUR, 10));
    const fullHealthEnemy = state.enemy;

    expect(attemptCatch(fullHealthEnemy, () => 0.199999)).toMatchObject({ caught: true, shakes: 3 });
    expect(attemptCatch(fullHealthEnemy, () => 0.2)).toMatchObject({ caught: false, shakes: 2 });
    expect(attemptCatch(fullHealthEnemy, () => 1)).toMatchObject({ caught: false, shakes: 0 });
  });

  it('marks a successful catch as a battle-ending outcome', () => {
    const state = createBattleState(new Pokemon(CHARMANDER, 10), new Pokemon(BULBASAUR, 10));
    const result = resolveCatchAttempt(state, () => 0);

    expect(result.state.outcome).toBe('caught');
    expect(result.events).toEqual([
      { type: 'ball-thrown', name: 'Bulbasaur' },
      { type: 'catch-shake', count: 1 },
      { type: 'catch-shake', count: 2 },
      { type: 'catch-shake', count: 3 },
      { type: 'caught', name: 'Bulbasaur' },
    ]);
  });

  it('lets the enemy act after a failed catch', () => {
    const state = createBattleState(new Pokemon(CHARMANDER, 10), new Pokemon(BULBASAUR, 10));
    const failedCatch = resolveCatchAttempt(state, () => 1);
    const enemyTurn = resolveEnemyTurn(failedCatch.state, maximumRandom);

    expect(failedCatch.state.outcome).toBe('active');
    expect(failedCatch.events.at(-1)).toEqual({ type: 'broke-free', name: 'Bulbasaur' });
    expect(enemyTurn.events.some((event) => event.type === 'used-move' && event.user === 'enemy')).toBe(true);
  });
});

describe('trainer battles', () => {
  const trainer = () => ({
    id: 'test-trainer',
    name: 'TESTER',
    party: [new Pokemon(BULBASAUR, 5), new Pokemon(PIDGEY, 5)],
    defeatText: 'Not bad!',
  });

  it('sends out the next trainer Pokemon after a faint', () => {
    const state = createTrainerBattleState(new Pokemon(CHARMANDER, 10), trainer());
    const weakened = { ...state, enemy: { ...state.enemy, currentHp: 1 } };

    const result = resolveTurn(weakened, 2, maximumRandom);

    expect(result.state.outcome).toBe('active');
    expect(result.state.enemy.pokemon.base.name).toBe('Pidgey');
    expect(result.state.enemyPartyIndex).toBe(1);
    expect(result.events).toContainEqual({ type: 'enemy-sent-out', name: 'Pidgey' });
  });

  it('wins only after the trainer party is exhausted', () => {
    const initial = createTrainerBattleState(new Pokemon(CHARMANDER, 10), trainer());
    const first = resolveTurn({ ...initial, enemy: { ...initial.enemy, currentHp: 1 } }, 2, maximumRandom);
    const final = resolveTurn({ ...first.state, enemy: { ...first.state.enemy, currentHp: 1 } }, 2, maximumRandom);

    expect(final.state.outcome).toBe('victory');
    expect(final.events.some((event) => event.type === 'enemy-sent-out')).toBe(false);
  });

  it('rejects capture attempts against trainer Pokemon', () => {
    const state = createTrainerBattleState(new Pokemon(CHARMANDER, 10), trainer());

    expect(resolveCatchAttempt(state, () => 0)).toEqual({
      state,
      events: [{ type: 'catch-disabled' }],
    });
  });

  it('reports defeat when a trainer Pokemon wipes the active player', () => {
    const initial = createTrainerBattleState(new Pokemon(PIDGEY, 5), trainer());
    const state = {
      ...initial,
      player: { ...initial.player, currentHp: 1 },
      enemy: { ...initial.enemy, moves: [{ base: TACKLE, pp: TACKLE.pp }] },
    };

    expect(resolveEnemyTurn(state, maximumRandom).state.outcome).toBe('defeat');
  });
});

describe('first-starter battle fairness', () => {
  it('gives a fresh Bulbasaur a damaging, neutral route through an early wild battle', () => {
    const player = new Pokemon(BULBASAUR, 5);
    const opponent = new Pokemon(BULBASAUR, 5);
    const tackleIndex = player.moves.findIndex((move) => move.base === TACKLE);

    expect(tackleIndex).toBeGreaterThanOrEqual(0);

    let state = createBattleState(player, opponent);
    for (let turn = 0; turn < 20 && state.outcome === 'active'; turn += 1) {
      state = resolveTurn(state, tackleIndex, maximumRandom).state;
    }

    expect(state.outcome).toBe('victory');
    expect(state.player.currentHp).toBeGreaterThan(0);
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

describe('a combatant refreshed after a level-up', () => {
  /** A Squirtle on the far side of level 7, where it learns Water Gun. */
  const levelledSquirtle = () => {
    const squirtle = new Pokemon(SQUIRTLE, 6);
    const combatant = createBattleState(squirtle, new Pokemon(PIDGEY, 5)).player;
    const previousMaxHp = squirtle.maxHp;
    squirtle.gainExperience(experienceForLevel(7) - squirtle.experience);
    return { squirtle, combatant, previousMaxHp };
  };

  it('adds the move learned on the way at full PP and leaves the older moves as they were', () => {
    const { combatant, previousMaxHp } = levelledSquirtle();
    const spent = {
      ...combatant,
      moves: combatant.moves.map((move, index) => (index === 0 ? { ...move, pp: 3 } : move)),
    };

    const refreshed = refreshCombatantAfterLevelUp(spent, previousMaxHp);

    expect(refreshed.moves.map(({ base, pp }) => `${base.name} ${pp}`)).toEqual([
      'Tackle 3',
      'Tail Whip 30',
      'Growl 30',
      'Water Gun 25',
    ]);
  });

  it('keeps the status, its counters and the stat stages the battle earned', () => {
    const { combatant, previousMaxHp } = levelledSquirtle();
    const fought = {
      ...combatant,
      primaryStatus: PrimaryStatus.Poison,
      sleepTurns: 2,
      confusionTurns: 3,
      statStages: applyStatBoost(createStatStages(), { stat: 'attack', stages: -2 }),
    };

    const refreshed = refreshCombatantAfterLevelUp(fought, previousMaxHp);

    expect(refreshed.primaryStatus).toBe(PrimaryStatus.Poison);
    expect(refreshed.sleepTurns).toBe(2);
    expect(refreshed.confusionTurns).toBe(3);
    expect(refreshed.statStages).toEqual(fought.statStages);
  });

  it('adds exactly the HP the raised maximum brought, and never more than the maximum', () => {
    const { combatant, previousMaxHp } = levelledSquirtle();

    expect(previousMaxHp).toBe(18);
    expect(combatant.pokemon.maxHp).toBe(20);
    expect(refreshCombatantAfterLevelUp({ ...combatant, currentHp: 7 }, previousMaxHp).currentHp).toBe(9);
    expect(refreshCombatantAfterLevelUp({ ...combatant, currentHp: 19 }, previousMaxHp).currentHp).toBe(20);
  });

  it('leaves a fainted combatant fainted, because a level is not a revive', () => {
    const { combatant, previousMaxHp } = levelledSquirtle();

    expect(refreshCombatantAfterLevelUp({ ...combatant, currentHp: 0 }, previousMaxHp).currentHp).toBe(0);
  });

  it('follows the Pokemon when a fifth move pushes the oldest one out', () => {
    const { squirtle, combatant, previousMaxHp } = levelledSquirtle();
    // What `learnMovesAtLevel` does when a new move arrives on a full set of
    // four. No shipped learnset is that long yet, so this is the rule rather
    // than a reproduction of one.
    squirtle.moves.shift();

    const refreshed = refreshCombatantAfterLevelUp(combatant, previousMaxHp);

    expect(refreshed.moves.map(({ base }) => base.name)).toEqual([
      'Tail Whip',
      'Growl',
      'Water Gun',
    ]);
  });
});
