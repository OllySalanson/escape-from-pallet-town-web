import { describe, expect, it } from 'vitest';
import { MoveBase, MoveCategory, MoveCharge, MoveTarget } from '../MoveBase';
import { Move } from '../Move';
import { Pokemon } from '../Pokemon';
import { PokemonBase } from '../PokemonBase';
import { PokemonType } from '../PokemonType';
import {
  AGILITY,
  BITE,
  BODY_SLAM,
  DOUBLE_EDGE,
  DOUBLE_SLAP,
  DOUBLE_TEAM,
  METAL_CLAW,
  QUICK_ATTACK,
  SMOKESCREEN,
  SOLAR_BEAM,
  SYNTHESIS,
  TACKLE,
  THUNDER_WAVE,
} from '../moves';
import { BULBASAUR, CHARMANDER, JIGGLYPUFF, PIDGEY, PIKACHU, SQUIRTLE } from '../species';
import { createBattleState, lockedMove, resolveTurn, rollHitCount, type BattleEvent } from './battleEngine';
import { PrimaryStatus } from './status';
import { stagedAccuracy } from './statStages';

/**
 * What a move can now *say about itself*, and what the resolver does with it.
 *
 * Every one of these was unrepresentable before: a `MoveBase` was eight fields,
 * and the one status a move could inflict was found by matching its **name**
 * against a table of four strings inside `applyMove`. Nothing here names a move
 * in the engine - each behaviour is a data row on the move and a branch that
 * reads the row.
 *
 * No Phaser, as with the rest of the engine's tests: `resolveTurn` is pure and
 * returns `{ state, events }`, and that is the whole reason this file can exist.
 */

/**
 * A random source addressed by draw number, so a test can pin the one roll it
 * is about and leave the rest on a value that hits, does not crit and rolls the
 * middle of the damage spread. A turn draws in a fixed order - the enemy's move
 * choice, then for each side in turn order its accuracy, its critical roll, its
 * damage roll, and then one roll per secondary - so the index of the roll a test
 * cares about is stated beside it.
 */
const at = (overrides: Readonly<Record<number, number>>, fallback = 0.5): (() => number) => {
  let index = 0;
  return () => overrides[index++] ?? fallback;
};
const always = (): number => 0;
const never = (): number => 0.999999;

/** Every `used-move` line one side put out, in order. */
const movesUsedBy = (events: readonly BattleEvent[], user: 'player' | 'enemy'): string[] =>
  events
    .filter((event): event is Extract<BattleEvent, { type: 'used-move' }> => event.type === 'used-move')
    .filter((event) => event.user === user)
    .map((event) => event.move);

const moveOrder = (events: readonly BattleEvent[]): ('player' | 'enemy')[] =>
  events
    .filter((event): event is Extract<BattleEvent, { type: 'used-move' }> => event.type === 'used-move')
    .map((event) => event.user);

const types = (events: readonly BattleEvent[]): string[] => events.map((event) => event.type);
const find = <T extends BattleEvent['type']>(
  events: readonly BattleEvent[],
  type: T,
): Extract<BattleEvent, { type: T }> | undefined =>
  events.find((event): event is Extract<BattleEvent, { type: T }> => event.type === type);

/**
 * A Pokemon holding exactly the moves this test is about, in this order.
 *
 * Passing no moves gives a Pokemon that cannot act: `chooseEnemyMove` returns
 * null before it draws, so the turn is the player's alone and the draw numbers
 * above start at the player's accuracy roll. That is how a test about what one
 * move does keeps a second Pokemon's turn out of its arithmetic.
 */
const armed = (species: typeof BULBASAUR, level: number, ...moves: readonly MoveBase[]): Pokemon => {
  const pokemon = new Pokemon(species, level);
  pokemon.moves.splice(0, pokemon.moves.length, ...moves.map((move) => new Move(move)));
  return pokemon;
};

describe('the move data model', () => {
  it('normalizes every optional into something the resolver never has to guard', () => {
    expect(TACKLE.priority).toBe(0);
    expect(TACKLE.alwaysHits).toBe(false);
    expect(TACKLE.target).toBe(MoveTarget.Foe);
    expect(TACKLE.hits).toBeNull();
    expect(TACKLE.critStage).toBe(0);
    expect(TACKLE.effects.boosts).toEqual([]);
    expect(TACKLE.secondaries).toEqual([]);
    expect(TACKLE.hasEffects).toBe(false);
  });

  it('gives a secondary the move’s own target unless it names one', () => {
    // Bite's flinch lands on whoever was bitten; Metal Claw's Attack raise lands
    // on the user, which is the whole reason `MoveTarget` was ported.
    expect(BITE.secondaries[0]).toMatchObject({ chance: 30, flinch: true, target: MoveTarget.Foe });
    expect(METAL_CLAW.secondaries[0]).toMatchObject({ chance: 10, target: MoveTarget.Self });
    expect(METAL_CLAW.secondaries[0]?.boosts).toEqual([{ stat: 'attack', stages: 1 }]);
  });
});

describe('status declared on the move', () => {
  it('inflicts what the move says it inflicts, with no name in the engine', () => {
    const paralyser = new MoveBase({
      name: 'Nothing The Engine Has Heard Of',
      type: PokemonType.Normal,
      power: 0,
      accuracy: 100,
      pp: 10,
      category: MoveCategory.Status,
      effects: { status: PrimaryStatus.Paralysis },
    });
    const player = armed(PIKACHU, 20, paralyser);
    const result = resolveTurn(createBattleState(player, armed(PIDGEY, 5, TACKLE)), 0, always);

    expect(result.state.enemy.primaryStatus).toBe(PrimaryStatus.Paralysis);
  });

  it('respects type immunity, which the name-matching table never did', () => {
    // Thunder Wave is Electric, so a Ground type is immune - and used to be
    // paralysed anyway, because the status branch never asked the type chart
    // the damage branch was already asking. Nothing shipped is Ground, so this
    // is asserted against a made-up defender rather than a species.
    const diglett = new Pokemon(
      new PokemonBase({
        id: 'ground-thing',
        dexId: 0,
        name: 'Ground Thing',
        primaryType: PokemonType.Ground,
        baseStats: { hp: 40, attack: 40, defense: 40, spAttack: 40, spDefense: 40, speed: 40 },
        learnset: [{ level: 1, move: TACKLE }],
        frontSprite: '',
        backSprite: '',
      }),
      10,
    );
    const player = armed(PIKACHU, 20, THUNDER_WAVE);

    const result = resolveTurn(createBattleState(player, diglett), 0, always);

    expect(result.state.enemy.primaryStatus).toBeNull();
    expect(find(result.events, 'effectiveness')?.multiplier).toBe(0);
  });
});

describe('effect chance', () => {
  it('rolls each secondary on its own, and lands it on the roll that passes', () => {
    const player = armed(JIGGLYPUFF, 40, BODY_SLAM);
    const enemy = armed(PIDGEY, 40, TACKLE);
    // Pidgey outruns Jigglypuff, so the player acts second: draw 7 is its
    // Body Slam's one secondary, and 30 is the chance on it.
    const landed = resolveTurn(createBattleState(player, enemy), 0, at({ 7: 0.29 }));

    expect(landed.state.enemy.primaryStatus).toBe(PrimaryStatus.Paralysis);
  });

  it('does not land it on the roll that fails, and nothing else changes', () => {
    const player = armed(JIGGLYPUFF, 40, BODY_SLAM);
    const enemy = armed(PIDGEY, 40, TACKLE);
    const missed = resolveTurn(createBattleState(player, enemy), 0, at({ 7: 0.31 }));

    expect(missed.state.enemy.primaryStatus).toBeNull();
    expect(types(missed.events)).toContain('used-move');
  });
});

describe('a stat stage on the user', () => {
  it('raises the user’s own stat, which every boost used to be unable to do', () => {
    const player = armed(PIKACHU, 40, AGILITY);
    const result = resolveTurn(createBattleState(player, armed(PIDGEY, 5, TACKLE)), 0, always);

    expect(result.state.player.statStages.speed).toBe(2);
    expect(result.state.enemy.statStages.speed).toBe(0);
    expect(find(result.events, 'stat-stage-changed')).toMatchObject({ user: 'player', stat: 'speed', stages: 2 });
  });

  it('lands a secondary on the user when the secondary says so', () => {
    const player = armed(CHARMANDER, 30, METAL_CLAW);
    const enemy = armed(PIDGEY, 30, TACKLE);
    // Charmander outruns Pidgey, so it acts first and draw 4 is its secondary.
    const result = resolveTurn(createBattleState(player, enemy), 0, at({ 4: 0.05 }));

    expect(result.state.player.statStages.attack).toBe(1);
  });
});

describe('accuracy and evasion', () => {
  it('uses generation III’s own 3/(3-n) ladder, not the damage one', () => {
    // +1 accuracy is 4/3, not the damage table's 1.5.
    expect(stagedAccuracy(75, 1, 0)).toBeCloseTo(100);
    expect(stagedAccuracy(100, 0, 1)).toBeCloseTo(75);
    expect(stagedAccuracy(100, 0, 6)).toBeCloseTo(100 / 3);
    expect(stagedAccuracy(100, 6, 6)).toBeCloseTo(100);
  });

  it('lowers the target’s accuracy and raises the user’s evasion', () => {
    const smoker = armed(CHARMANDER, 30, SMOKESCREEN);
    const smoked = resolveTurn(createBattleState(smoker, armed(PIDGEY, 5, TACKLE)), 0, always);
    expect(smoked.state.enemy.statStages.accuracy).toBe(-1);

    const dodger = armed(PIKACHU, 30, DOUBLE_TEAM);
    const dodged = resolveTurn(createBattleState(dodger, armed(PIDGEY, 5, TACKLE)), 0, always);
    expect(dodged.state.player.statStages.evasion).toBe(1);
  });

  it('makes a move miss that would have hit at the printed accuracy', () => {
    const player = armed(PIDGEY, 30, TACKLE);
    const enemy = armed(PIDGEY, 5, TACKLE);
    const fresh = createBattleState(player, enemy);
    // Tackle is 100 accurate here; at -4 accuracy it is 100 / (7/3) = 42.9.
    const blinded = {
      ...fresh,
      player: { ...fresh.player, statStages: { ...fresh.player.statStages, accuracy: -4 } },
    };
    const result = resolveTurn(blinded, 0, at({}, 0.5));

    expect(types(result.events)).toContain('missed');
  });

  it('skips the roll entirely for a move that always hits', () => {
    const player = armed(PIKACHU, 30, AGILITY);
    const fresh = createBattleState(player, armed(PIDGEY, 5, TACKLE));
    const blinded = {
      ...fresh,
      player: { ...fresh.player, statStages: { ...fresh.player.statStages, accuracy: -6 } },
    };

    expect(types(resolveTurn(blinded, 0, never).events)).not.toContain('missed');
  });
});

describe('multi-hit', () => {
  it('hits two to five times on generation III’s weighting, not evenly', () => {
    expect(rollHitCount(DOUBLE_SLAP, () => 0)).toBe(2);
    expect(rollHitCount(DOUBLE_SLAP, () => 0.374)).toBe(2);
    expect(rollHitCount(DOUBLE_SLAP, () => 0.376)).toBe(3);
    expect(rollHitCount(DOUBLE_SLAP, () => 0.76)).toBe(4);
    expect(rollHitCount(DOUBLE_SLAP, () => 0.9)).toBe(5);
    expect(rollHitCount(TACKLE, () => 0.5)).toBe(1);
  });

  it('reports the hits it landed and totals their damage into one line', () => {
    const player = armed(JIGGLYPUFF, 40, DOUBLE_SLAP);
    const enemy = armed(PIDGEY, 40, TACKLE);
    // Draw 5 is the hit count: 0.5 falls in the three-hit band.
    const result = resolveTurn(createBattleState(player, enemy), 0, at({ 5: 0.5 }));

    const hits = find(result.events, 'multi-hit');
    expect(hits?.hits).toBeGreaterThan(1);
    // One `used-move` line carrying the whole total, not one line per hit.
    expect(movesUsedBy(result.events, 'player')).toEqual(['Double Slap']);
    const used = result.events.find(
      (event): event is Extract<BattleEvent, { type: 'used-move' }> =>
        event.type === 'used-move' && event.user === 'player',
    );
    expect(used?.damage).toBe(enemy.maxHp - result.state.enemy.currentHp);
  });

  it('stops early when the target falls, rather than hitting a fainted Pokemon', () => {
    const player = armed(JIGGLYPUFF, 50, DOUBLE_SLAP);
    const enemy = armed(PIDGEY, 3, TACKLE);
    const result = resolveTurn(createBattleState(player, enemy), 0, at({ 5: 0.9 }));

    expect(result.state.outcome).toBe('victory');
    expect(find(result.events, 'multi-hit')).toBeUndefined();
  });
});

describe('recoil, drain and healing', () => {
  it('charges the user a third of what Double-Edge dealt', () => {
    const player = armed(JIGGLYPUFF, 40, DOUBLE_EDGE);
    const enemy = armed(PIDGEY, 90);
    const result = resolveTurn(createBattleState(player, enemy), 0, at({}));

    const dealt = enemy.maxHp - result.state.enemy.currentHp;
    const paid = find(result.events, 'recoil');
    expect(dealt).toBeGreaterThan(0);
    expect(paid?.damage).toBe(Math.floor(dealt / 3));
    expect(result.state.player.currentHp).toBe(player.maxHp - (paid?.damage ?? 0));
  });

  it('heals half the damage dealt for a drain move', () => {
    // Nothing in this roster learns one by level in FRLG, so the drain share is
    // asserted on the model rather than on a shipped move.
    const absorb = new MoveBase({
      name: 'Absorb',
      type: PokemonType.Grass,
      power: 20,
      accuracy: 100,
      pp: 20,
      category: MoveCategory.Special,
      drain: 0.5,
    });
    const player = armed(BULBASAUR, 40, absorb);
    const enemy = armed(PIDGEY, 90);
    const fresh = createBattleState(player, enemy);
    const hurt = { ...fresh, player: { ...fresh.player, currentHp: 1 } };

    const result = resolveTurn(hurt, 0, at({}));

    const dealt = enemy.maxHp - result.state.enemy.currentHp;
    expect(find(result.events, 'drained')?.amount).toBe(Math.floor(dealt / 2));
    expect(result.state.player.currentHp).toBe(1 + Math.floor(dealt / 2));
  });

  it('restores half of the user’s maximum HP, and says so when there is nothing to restore', () => {
    const player = armed(BULBASAUR, 40, SYNTHESIS);
    const fresh = createBattleState(player, armed(PIDGEY, 5));
    const hurt = { ...fresh, player: { ...fresh.player, currentHp: 1 } };

    const healed = resolveTurn(hurt, 0, always);
    expect(find(healed.events, 'healed')?.amount).toBe(Math.floor(player.maxHp / 2));

    const wasted = resolveTurn(fresh, 0, always);
    expect(types(wasted.events)).toContain('heal-failed');
    expect(wasted.state.player.currentHp).toBe(player.maxHp);
  });
});

describe('priority', () => {
  it('moves first against a faster Pokemon, which Speed alone could not do', () => {
    // Pidgey outruns Bulbasaur at every level, so the order is never in doubt.
    const slow = armed(BULBASAUR, 20, QUICK_ATTACK);
    const fast = armed(PIDGEY, 20, TACKLE);
    const result = resolveTurn(createBattleState(slow, fast), 0, at({}));

    expect(moveOrder(result.events)[0]).toBe('player');
  });

  it('outranks a Quick Claw, which only ever broke a tie inside its own bracket', () => {
    const slow = armed(BULBASAUR, 20, QUICK_ATTACK);
    const fast = armed(PIDGEY, 20, TACKLE);
    fast.giveHeldItem('quick-claw');
    // Draw 1 is the enemy's claw, and it fires - and still does not get in
    // front of a priority move.
    const result = resolveTurn(createBattleState(slow, fast), 0, at({ 1: 0 }));

    expect(moveOrder(result.events)[0]).toBe('player');
  });
});

describe('flinch', () => {
  it('takes the turn of whoever had not moved yet', () => {
    // Squirtle's Bite, flinching a slower Bulbasaur before it acts.
    const biter = armed(SQUIRTLE, 30, BITE);
    const victim = armed(BULBASAUR, 20, TACKLE);
    // Squirtle at 30 outruns a level-20 Bulbasaur and does not knock it out.
    // Draw 4 is Bite's one secondary, and 30 is the chance on it.
    const result = resolveTurn(createBattleState(biter, victim), 0, at({ 4: 0.29 }));

    expect(types(result.events)).toContain('flinched');
    expect(moveOrder(result.events)).toEqual(['player']);
  });

  it('is cleared at the top of every turn, so it can never last two', () => {
    const biter = armed(SQUIRTLE, 30, BITE);
    const victim = armed(BULBASAUR, 20, TACKLE);
    const first = resolveTurn(createBattleState(biter, victim), 0, at({ 4: 0.29 }));

    expect(first.state.enemy.flinching).toBe(false);
  });
});

describe('two-turn moves', () => {
  it('spends a turn charging, then fires the same move without being asked', () => {
    const player = armed(BULBASAUR, 50, SOLAR_BEAM, TACKLE);
    const enemy = armed(PIDGEY, 50, TACKLE);
    const first = resolveTurn(createBattleState(player, enemy), 0, at({}));

    expect(types(first.events)).toContain('charging');
    expect(first.state.enemy.currentHp).toBe(enemy.maxHp);
    expect(first.state.player.moves[0]?.pp).toBe(SOLAR_BEAM.pp - 1);
    // The choice is no longer the player's, and `BattleScene` asks exactly this.
    expect(lockedMove(first.state, 'player')).toBe(0);

    // The second turn is driven with a *different* move index; the charge wins.
    const second = resolveTurn(first.state, 1, at({}));

    expect(movesUsedBy(second.events, 'player')).toEqual(['Solar Beam']);
    expect(second.state.enemy.currentHp).toBeLessThan(enemy.maxHp);
    // The charge turn paid the PP; the firing turn does not pay it twice.
    expect(second.state.player.moves[0]?.pp).toBe(SOLAR_BEAM.pp - 1);
    expect(lockedMove(second.state, 'player')).toBeNull();
  });

  it('loses the turn after a move that has to recharge', () => {
    const hyperBeam = new MoveBase({
      name: 'Hyper Beam',
      type: PokemonType.Normal,
      power: 150,
      accuracy: 90,
      pp: 5,
      category: MoveCategory.Physical,
      charge: MoveCharge.Recharge,
    });
    const player = armed(JIGGLYPUFF, 50, hyperBeam, TACKLE);
    const enemy = armed(PIDGEY, 100);
    const first = resolveTurn(createBattleState(player, enemy), 0, at({}));

    expect(first.state.enemy.currentHp).toBeLessThan(enemy.maxHp);
    expect(lockedMove(first.state, 'player')).toBe(0);

    const second = resolveTurn(first.state, 1, at({}));

    expect(types(second.events)).toContain('recharging');
    // The recharge is spent, so it can never cost two turns in a row.
    expect(lockedMove(second.state, 'player')).toBeNull();
  });
});

describe('raised critical-hit rate', () => {
  it('crits on a roll a stage-0 move would not have', () => {
    const razor = new MoveBase({
      name: 'Razor Test',
      type: PokemonType.Normal,
      power: 55,
      accuracy: 100,
      pp: 25,
      category: MoveCategory.Physical,
      critStage: 1,
    });
    const plain = new MoveBase({ ...razorInit(razor), critStage: 0 });
    const enemy = () => armed(PIDGEY, 90);
    // Draw 1 is the critical roll: 0.10 is inside 12.5% and outside 6.25%.
    const rollSet = () => at({ 1: 0.1 });

    const sharp = resolveTurn(createBattleState(armed(PIKACHU, 30, razor), enemy()), 0, rollSet());
    const blunt = resolveTurn(createBattleState(armed(PIKACHU, 30, plain), enemy()), 0, rollSet());

    expect(types(sharp.events)).toContain('critical-hit');
    expect(types(blunt.events)).not.toContain('critical-hit');
  });
});

function razorInit(move: MoveBase) {
  return {
    name: move.name,
    type: move.type,
    power: move.power,
    accuracy: move.accuracy,
    pp: move.pp,
    category: move.category,
  };
}
