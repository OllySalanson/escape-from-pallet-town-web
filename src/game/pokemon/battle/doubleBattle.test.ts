import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MoveBase, MoveCategory, MoveFlag, MoveTarget } from '../MoveBase';
import { Move } from '../Move';
import { Pokemon } from '../Pokemon';
import { PokemonBase, type PokemonBaseInit } from '../PokemonBase';
import { PokemonType } from '../PokemonType';
import { BUBBLE, GROWL, QUICK_ATTACK, RAZOR_LEAF, TACKLE } from '../moves';
import { ALL_SPECIES, BULBASAUR, PIDGEY, PIKACHU, SQUIRTLE, getSpeciesById } from '../species';
import { MOVE_CATALOGUE } from '../moveCatalogue';
import {
  SLOTS_PER_SIDE,
  createTrainerBattleState,
  effectiveWeather,
  engagedSlots,
  isEngaged,
  openingAbilityEvents,
  replacePlayerPokemon,
  resolveTurn,
  slotRef,
  unitAt,
  type BattleEvent,
  type BattleState,
  type TrainerBattle,
} from './battleEngine';
import { SPREAD_DAMAGE_MULTIPLIER } from './damage';
import { WEATHER_MOVE_TURNS, WeatherId } from './weather';
import { createRunTrainerEncounters } from '../../world/trainers';

/**
 * Two Pokemon a side, and what changes when there are.
 *
 * Every case here is one of the things a second body on the field can break:
 * the order four actions are taken in, a move that lands on more than one of
 * them, a rule that must fire once per unit (the weather) against one that must
 * fire once per attacker (an ability that answers a hit), and a Pokemon that
 * falls with its own action still queued. No Phaser: `resolveTurn` is pure and
 * hands back `{ state, events }`, and that is exactly the property a double
 * battle was not allowed to cost.
 */

/** Every roll at its top: no crit, no secondary, the last move, the far slot. */
const maximumRandom = (): number => 1;
/**
 * The middle of every roll: every move lands (nothing here is under 90
 * accurate), nothing crits, no secondary fires. `maximumRandom` misses a
 * 95-accuracy move, which is most of what a spread move is.
 */
const steady = (): number => 0.5;
/** Everything that can fire, fires. */
const always = (): number => 0;
const species = (init: Partial<PokemonBaseInit> & { readonly id: string }): PokemonBase =>
  new PokemonBase({
    id: init.id,
    name: init.name ?? 'Subject',
    primaryType: init.primaryType ?? PokemonType.Normal,
    secondaryType: init.secondaryType,
    baseStats: init.baseStats ?? {
      hp: 60,
      attack: 50,
      defense: 50,
      spAttack: 50,
      spDefense: 50,
      speed: 50,
    },
    learnset: init.learnset ?? [{ level: 1, move: TACKLE }],
    abilityId: init.abilityId ?? null,
  });

const armed = (base: PokemonBase, level: number, ...moves: readonly MoveBase[]): Pokemon => {
  const pokemon = new Pokemon(base, level);
  pokemon.moves.splice(0, pokemon.moves.length, ...moves.map((move) => new Move(move)));
  return pokemon;
};

const stats = (speed: number, hp = 200) => ({
  hp,
  attack: 50,
  defense: 50,
  spAttack: 50,
  spDefense: 50,
  speed,
});

/** A trainer who puts two on the field, with whoever is given to them. */
const pair = (party: readonly Pokemon[], unitCount = 2): TrainerBattle => ({
  id: 'test-pair',
  name: 'TESTERS',
  party,
  unitCount,
  defeatText: 'Both of us, then.',
});

const usedMoves = (
  events: readonly BattleEvent[],
): readonly { user: string; slot: number }[] =>
  events
    .filter((event): event is Extract<BattleEvent, { type: 'used-move' }> => event.type === 'used-move')
    .map((event) => ({ user: event.user, slot: event.slot ?? 0 }));

const spreadHits = (
  events: readonly BattleEvent[],
): Extract<BattleEvent, { type: 'spread-damage' }>[] =>
  events.filter(
    (event): event is Extract<BattleEvent, { type: 'spread-damage' }> =>
      event.type === 'spread-damage',
  );

const of = <T extends BattleEvent['type']>(
  events: readonly BattleEvent[],
  type: T,
): Extract<BattleEvent, { type: T }>[] =>
  events.filter((event): event is Extract<BattleEvent, { type: T }> => event.type === type);

/** Puts one move in a slot's hands without touching the Pokemon underneath. */
const holding = (state: BattleState, ref: ReturnType<typeof slotRef>, move: MoveBase): BattleState => {
  const combatant = unitAt(state, ref)!;
  const replaced = { ...combatant, moves: [{ base: move, pp: move.pp }] };
  return ref.side === 'player'
    ? ref.slot === 0
      ? { ...state, player: replaced }
      : { ...state, playerPartner: replaced }
    : ref.slot === 0
      ? { ...state, enemy: replaced }
      : { ...state, enemyPartner: replaced };
};

describe('whether a battle is a double at all', () => {
  it('fields two a side when the trainer asks for two and the player has two', () => {
    const state = createTrainerBattleState(
      new Pokemon(BULBASAUR, 10),
      pair([new Pokemon(PIDGEY, 10), new Pokemon(PIKACHU, 10)]),
      null,
      new Pokemon(SQUIRTLE, 10),
    );

    expect(state.unitCount).toBe(SLOTS_PER_SIDE);
    expect(state.playerPartner?.pokemon.base).toBe(SQUIRTLE);
    expect(state.enemyPartner?.pokemon.base).toBe(PIKACHU);
    expect(state.enemyPartyIndex).toBe(0);
    expect(state.enemyPartnerPartyIndex).toBe(1);
    expect(state.enemySentOut).toBe(2);
  });

  it('is a single battle when the player has nobody to field beside the lead', () => {
    const state = createTrainerBattleState(
      new Pokemon(BULBASAUR, 10),
      pair([new Pokemon(PIDGEY, 10), new Pokemon(PIKACHU, 10)]),
    );

    // Generation III's own rule, and the only fair one here: a lone starter
    // facing two would be given one action a turn against two.
    expect(state.unitCount).toBe(1);
    expect(state.playerPartner).toBeNull();
    expect(state.enemyPartner).toBeNull();
    expect(state.enemySentOut).toBe(1);
  });

  it('refuses a partner who has already fainted', () => {
    const spare = new Pokemon(SQUIRTLE, 10);
    spare.currentHp = 0;
    const state = createTrainerBattleState(
      new Pokemon(BULBASAUR, 10),
      pair([new Pokemon(PIDGEY, 10), new Pokemon(PIKACHU, 10)]),
      null,
      spare,
    );

    expect(state.unitCount).toBe(1);
  });

  it('is a single battle when the trainer has only one Pokemon to field', () => {
    const state = createTrainerBattleState(
      new Pokemon(BULBASAUR, 10),
      pair([new Pokemon(PIDGEY, 10)]),
      null,
      new Pokemon(SQUIRTLE, 10),
    );

    expect(state.unitCount).toBe(1);
  });
});

describe('the order four actions are taken in', () => {
  const FAST = species({ id: 'fast', name: 'Fast', baseStats: stats(200) });
  const BRISK = species({ id: 'brisk', name: 'Brisk', baseStats: stats(150) });
  const STEADY = species({ id: 'steady', name: 'Steady', baseStats: stats(100) });
  const SLOW = species({ id: 'slow', name: 'Slow', baseStats: stats(10) });

  /** Four different Speeds, one per slot, so the order is only about Speed. */
  const mixedField = (): BattleState =>
    createTrainerBattleState(
      armed(FAST, 10, TACKLE),
      pair([armed(STEADY, 10, TACKLE), armed(BRISK, 10, TACKLE)]),
      null,
      armed(SLOW, 10, TACKLE),
    );

  it('sorts by Speed across both sides before either side gets a second action', () => {
    const result = resolveTurn(
      mixedField(),
      [
        { slot: 0, moveIndex: 0 },
        { slot: 1, moveIndex: 0 },
      ],
      steady,
    );

    // Speed alone, ignoring which side anybody is on: 200, 150, 100, 10.
    expect(usedMoves(result.events)).toEqual([
      { user: 'player', slot: 0 },
      { user: 'enemy', slot: 1 },
      { user: 'enemy', slot: 0 },
      { user: 'player', slot: 1 },
    ]);
  });

  it('puts a priority move in front of everything faster than it', () => {
    const state = holding(mixedField(), slotRef('player', 1), QUICK_ATTACK);
    const result = resolveTurn(
      state,
      [
        { slot: 0, moveIndex: 0 },
        { slot: 1, moveIndex: 0 },
      ],
      steady,
    );

    expect(usedMoves(result.events)[0]).toEqual({ user: 'player', slot: 1 });
  });

  it('breaks a true Speed tie the same way every time: the player, then the lead', () => {
    const level = (): BattleState =>
      createTrainerBattleState(
        armed(FAST, 10, TACKLE),
        pair([armed(FAST, 10, TACKLE), armed(FAST, 10, TACKLE)]),
        null,
        armed(FAST, 10, TACKLE),
      );
    const order = usedMoves(
      resolveTurn(
        level(),
        [
          { slot: 0, moveIndex: 0 },
          { slot: 1, moveIndex: 0 },
        ],
        steady,
      ).events,
    );

    // Not a coin, on purpose: the boss ladder and both encounter harnesses are
    // numbers measured over this engine, and a coin here would move them.
    expect(order).toEqual([
      { user: 'player', slot: 0 },
      { user: 'player', slot: 1 },
      { user: 'enemy', slot: 0 },
      { user: 'enemy', slot: 1 },
    ]);
  });
});

describe('a move that hits both foes', () => {
  const BYSTANDER = species({ id: 'bystander', name: 'Bystander', baseStats: stats(10) });
  const field = (): BattleState =>
    createTrainerBattleState(
      armed(BULBASAUR, 20, RAZOR_LEAF),
      pair([armed(BYSTANDER, 10, TACKLE), armed(BYSTANDER, 10, TACKLE)]),
      null,
      armed(BYSTANDER, 10, TACKLE),
    );

  it('names itself once and then says what it took off each of them', () => {
    const result = resolveTurn(field(), [{ slot: 0, moveIndex: 0 }], steady);
    const named = of(result.events, 'used-move').filter((event) => event.user === 'player');
    const hits = spreadHits(result.events);

    expect(named).toHaveLength(1);
    expect(named[0]).toMatchObject({ move: 'Razor Leaf', spread: true });
    // The naming line carries no damage: there is no one figure it could be.
    expect(named[0].damage).toBeUndefined();
    expect(hits.map((hit) => hit.targetSlot ?? 0)).toEqual([0, 1]);
    expect(hits.every((hit) => hit.damage > 0)).toBe(true);
  });

  it("pays the same same-type bonus to both, because the bonus is the attacker's", () => {
    const hits = spreadHits(resolveTurn(field(), [{ slot: 0, moveIndex: 0 }], steady).events);

    // Effectiveness and the damage roll are the target's business and vary;
    // the same-type bonus is a fact about the attacker and the move, so it
    // cannot.
    expect(hits.map((hit) => hit.isStab)).toEqual([true, true]);
  });

  it('is halved while it is hitting two and whole once only one is standing', () => {
    const both = spreadHits(resolveTurn(field(), [{ slot: 0, moveIndex: 0 }], steady).events);

    const alone = field();
    const emptied: BattleState = { ...alone, enemyPartner: { ...alone.enemyPartner!, currentHp: 0 } };
    const single = of(
      resolveTurn(emptied, [{ slot: 0, moveIndex: 0 }], steady).events,
      'used-move',
    ).find((event) => event.user === 'player');

    expect(single?.damage).toBeGreaterThan(both[0].damage);
    // Generation III's spread halving, read back off the two figures rather
    // than off the constant alone.
    expect(both[0].damage / (single?.damage ?? 1)).toBeCloseTo(SPREAD_DAMAGE_MULTIPLIER, 1);
  });

  it('lands a status move on both of them', () => {
    const state = holding(field(), slotRef('player', 0), GROWL);
    const result = resolveTurn(state, [{ slot: 0, moveIndex: 0 }], steady);

    expect(
      of(result.events, 'stat-stage-changed')
        .filter((event) => event.user === 'enemy')
        .map((event) => event.slot ?? 0),
    ).toEqual([0, 1]);
    expect(unitAt(result.state, slotRef('enemy', 0))?.statStages.attack).toBe(-1);
    expect(unitAt(result.state, slotRef('enemy', 1))?.statStages.attack).toBe(-1);
  });

  it('rolls its secondary separately for each target it hit', () => {
    // At a chance that always lands, what this pins is that the roll happens
    // for both of them rather than once for the move - a secondary applied at
    // the move level would reach whichever target the code happened to be
    // holding. The independence of the two rolls is only visible at a chance
    // that sometimes lands, and a seeded sequence that far into a turn pins the
    // draw order rather than the rule.
    const SOUR_SPRAY = new MoveBase({
      name: 'Sour Spray',
      type: PokemonType.Water,
      power: 20,
      accuracy: 100,
      pp: 30,
      category: MoveCategory.Special,
      target: MoveTarget.BothFoes,
      secondaries: [{ chance: 100, boosts: [{ stat: 'speed', stages: -1 }] }],
    });
    const state = holding(field(), slotRef('player', 0), SOUR_SPRAY);
    const result = resolveTurn(state, [{ slot: 0, moveIndex: 0 }], steady);

    expect(
      of(result.events, 'stat-stage-changed')
        .filter((event) => event.user === 'enemy' && event.stat === 'speed')
        .map((event) => event.slot ?? 0),
    ).toEqual([0, 1]);
  });
});

describe('a rule that fires once per unit against one that fires once per hit', () => {
  const ROCKY = species({
    id: 'rocky',
    name: 'Rocky',
    primaryType: PokemonType.Normal,
    baseStats: stats(50),
  });

  it('charges the weather once for each unit on the field, not once per attacker', () => {
    const state = createTrainerBattleState(
      armed(ROCKY, 10, TACKLE),
      pair([armed(ROCKY, 10, TACKLE), armed(ROCKY, 10, TACKLE)]),
      WeatherId.Sandstorm,
      armed(ROCKY, 10, TACKLE),
    );
    const result = resolveTurn(
      state,
      [
        { slot: 0, moveIndex: 0 },
        { slot: 1, moveIndex: 0 },
      ],
      maximumRandom,
    );

    // Four units acted; the sandstorm is charged four times and no more. It is
    // the field's turn, taken once after everybody has acted.
    expect(of(result.events, 'weather-damage')).toHaveLength(4);
    expect(
      of(result.events, 'weather-damage').map((event) => `${event.user}${event.slot ?? 0}`).sort(),
    ).toEqual(['enemy0', 'enemy1', 'player0', 'player1']);
  });

  it('spends the weather clock once a turn however many units are on the field', () => {
    // A move brings weather on for WEATHER_MOVE_TURNS *turns*, and a double
    // battle has four actions in a turn. Charged per action it would have
    // lapsed in two and a half.
    const RAINMAKER = new MoveBase({
      name: 'Rainmaker',
      type: PokemonType.Water,
      power: 0,
      accuracy: 100,
      pp: 5,
      category: MoveCategory.Status,
      target: MoveTarget.Self,
      effects: { weather: WeatherId.Rain },
    });
    const PLAIN = species({ id: 'plain', name: 'Plain', baseStats: stats(50) });
    let state = createTrainerBattleState(
      armed(PLAIN, 10, RAINMAKER, TACKLE),
      pair([armed(PLAIN, 10, TACKLE), armed(PLAIN, 10, TACKLE)]),
      null,
      armed(PLAIN, 10, TACKLE),
    );
    state = resolveTurn(
      state,
      [
        { slot: 0, moveIndex: 0 },
        { slot: 1, moveIndex: 0 },
      ],
      steady,
    ).state;
    expect(state.weather).toEqual({ id: WeatherId.Rain, turnsRemaining: WEATHER_MOVE_TURNS - 1 });

    state = resolveTurn(
      state,
      [
        { slot: 0, moveIndex: 1 },
        { slot: 1, moveIndex: 0 },
      ],
      steady,
    ).state;
    expect(state.weather?.turnsRemaining).toBe(WEATHER_MOVE_TURNS - 2);
  });

  it('pays a Pokemon its end-of-turn gear once a turn however many are on the field', () => {
    const state = createTrainerBattleState(
      armed(BULBASAUR, 20, TACKLE),
      pair([armed(PIDGEY, 10, TACKLE), armed(PIDGEY, 10, TACKLE)]),
      null,
      armed(SQUIRTLE, 20, TACKLE),
    );
    state.player.pokemon.heldItemId = 'leftovers';
    state.playerPartner!.pokemon.heldItemId = 'leftovers';
    const hurt: BattleState = {
      ...state,
      player: { ...state.player, currentHp: 5 },
      playerPartner: { ...state.playerPartner!, currentHp: 5 },
    };
    const result = resolveTurn(
      hurt,
      [
        { slot: 0, moveIndex: 0 },
        { slot: 1, moveIndex: 0 },
      ],
      maximumRandom,
    );

    // Two holders, two actions, two meals - and never four, which is what a
    // rule hung off the turn rather than off the action would have paid.
    expect(of(result.events, 'gear-heal')).toHaveLength(2);
  });
});

describe('a Pokemon that falls in the middle of a turn', () => {
  const GLASS = species({ id: 'glass', name: 'Glass', baseStats: stats(10, 1) });
  const HEAVY = species({ id: 'heavy', name: 'Heavy', baseStats: stats(200, 300) });

  const glassField = (): BattleState =>
    createTrainerBattleState(
      armed(HEAVY, 30, TACKLE),
      pair([armed(GLASS, 5, TACKLE), armed(GLASS, 5, TACKLE)]),
      null,
      armed(HEAVY, 30, TACKLE),
    );

  it('does not take the action it had queued', () => {
    const result = resolveTurn(
      glassField(),
      [
        { slot: 0, moveIndex: 0, target: slotRef('enemy', 0) },
        { slot: 1, moveIndex: 0, target: slotRef('enemy', 1) },
      ],
      maximumRandom,
    );

    // Both of the player's are faster than both of the enemy's and both
    // knock one out, so neither of the enemy's ever swings.
    expect(usedMoves(result.events).filter((used) => used.user === 'enemy')).toEqual([]);
    expect(result.state.outcome).toBe('victory');
  });

  it('is re-aimed at whoever is still standing when the one aimed at has gone', () => {
    // Both of the player's aim at the same glass Pokemon. The first knocks it
    // out; the second finds the slot empty and takes the other one instead.
    const result = resolveTurn(
      glassField(),
      [
        { slot: 0, moveIndex: 0, target: slotRef('enemy', 0) },
        { slot: 1, moveIndex: 0, target: slotRef('enemy', 0) },
      ],
      maximumRandom,
    );

    expect(of(result.events, 'no-target')).toEqual([]);
    expect(result.state.outcome).toBe('victory');
  });

  it('says so when the move it had queued has nobody left to land on', () => {
    // One foe, two of the player's: the second swings into an empty field.
    const state = createTrainerBattleState(
      armed(HEAVY, 30, TACKLE),
      pair([armed(GLASS, 5, TACKLE), armed(GLASS, 5, TACKLE)]),
      null,
      armed(HEAVY, 30, TACKLE),
    );
    const onlyOne: BattleState = { ...state, enemyPartner: null, enemySentOut: 2 };
    const result = resolveTurn(
      onlyOne,
      [
        { slot: 0, moveIndex: 0, target: slotRef('enemy', 0) },
        { slot: 1, moveIndex: 0, target: slotRef('enemy', 0) },
      ],
      maximumRandom,
    );

    // The battle is over before the second swing, so the turn simply stops -
    // which is the same rule a single battle has always had.
    expect(result.state.outcome).toBe('victory');
    expect(usedMoves(result.events)).toHaveLength(1);
  });
});

describe('a trainer with more Pokemon than slots', () => {
  const GLASS = species({ id: 'glass', name: 'Glass', baseStats: stats(10, 1) });
  const HEAVY = species({ id: 'heavy', name: 'Heavy', baseStats: stats(200, 300) });

  it('sends the next one into the slot that emptied and fights on with the other', () => {
    const state = createTrainerBattleState(
      armed(HEAVY, 30, TACKLE),
      pair([armed(GLASS, 5, TACKLE), armed(HEAVY, 5, TACKLE), armed(GLASS, 5, TACKLE)]),
      null,
      armed(GLASS, 5, TACKLE),
    );
    const result = resolveTurn(
      state,
      [{ slot: 0, moveIndex: 0, target: slotRef('enemy', 0) }],
      maximumRandom,
    );

    expect(of(result.events, 'enemy-sent-out').map((event) => event.slot ?? 0)).toEqual([0]);
    expect(result.state.enemyPartyIndex).toBe(2);
    expect(result.state.enemyPartnerPartyIndex).toBe(1);
    expect(result.state.enemySentOut).toBe(3);
    expect(result.state.outcome).toBe('active');
    expect(engagedSlots(result.state, 'enemy')).toHaveLength(2);
  });

  it('is beaten only once nothing is left standing on it', () => {
    const state = createTrainerBattleState(
      armed(HEAVY, 30, TACKLE),
      pair([armed(GLASS, 5, TACKLE), armed(GLASS, 5, TACKLE)]),
      null,
      armed(HEAVY, 30, TACKLE),
    );
    const half: BattleState = {
      ...state,
      enemyPartner: { ...state.enemyPartner!, currentHp: 0 },
    };
    const result = resolveTurn(
      half,
      [{ slot: 0, moveIndex: 0, target: slotRef('enemy', 0) }],
      maximumRandom,
    );

    expect(result.state.outcome).toBe('victory');
  });
});

describe('the player losing a slot', () => {
  const GLASS = species({ id: 'glass', name: 'Glass', baseStats: stats(10, 1) });
  const HEAVY = species({ id: 'heavy', name: 'Heavy', baseStats: stats(200, 300) });

  const oneDown = (): BattleState => {
    const state = createTrainerBattleState(
      armed(GLASS, 5, TACKLE),
      pair([armed(HEAVY, 30, TACKLE), armed(HEAVY, 30, TACKLE)]),
      null,
      armed(HEAVY, 30, TACKLE),
    );
    return { ...state, player: { ...state.player, currentHp: 0 } };
  };

  it('goes on being a battle while the other slot is standing', () => {
    const state = oneDown();

    expect(state.outcome).toBe('active');
    expect(isEngaged(unitAt(state, slotRef('player', 0)))).toBe(false);
    expect(isEngaged(unitAt(state, slotRef('player', 1)))).toBe(true);
  });

  it('takes a replacement into the slot that emptied and leaves the other alone', () => {
    const state = oneDown();
    const standing = state.playerPartner!.pokemon;
    const switched = replacePlayerPokemon(state, new Pokemon(SQUIRTLE, 10), 0);

    expect(switched.state.player.pokemon.base).toBe(SQUIRTLE);
    expect(switched.state.playerPartner?.pokemon).toBe(standing);
    expect(switched.state.outcome).toBe('active');
  });
});

describe('what a single battle still means', () => {
  it('reads a bare move index as the lead aiming at the lead', () => {
    const state = createTrainerBattleState(
      new Pokemon(BULBASAUR, 10),
      pair([new Pokemon(PIDGEY, 10)], 1),
    );
    const numbered = resolveTurn(state, 0, maximumRandom);
    const listed = resolveTurn(state, [{ slot: 0, moveIndex: 0 }], maximumRandom);

    expect(numbered.events).toEqual(listed.events);
  });

  it('puts no slot on an event about the lead', () => {
    const state = createTrainerBattleState(
      new Pokemon(BULBASAUR, 10),
      pair([new Pokemon(PIDGEY, 10)], 1),
    );
    const result = resolveTurn(state, 0, maximumRandom);

    // Absent means the lead, so a single battle's log is exactly the log it was
    // before there were slots at all.
    expect(result.events.every((event) => !('slot' in event) || event.slot === undefined)).toBe(true);
  });
});

describe('a move nobody shipped that hits everything', () => {
  it('leaves `all-other-pokemon` out on purpose', () => {
    // Earthquake, Explosion, Magnitude and Self-Destruct are the four that also
    // hit your own partner, and none of them is in this game. A target nothing
    // uses is a rule nothing tests, so `MoveTarget` has two foe-facing values.
    expect(Object.values(MoveTarget)).toEqual(['foe', 'both-foes', 'self']);
  });

  it('keeps a spread move a spread move in a single battle, which changes nothing', () => {
    const state = createTrainerBattleState(
      armed(BULBASAUR, 20, RAZOR_LEAF),
      pair([armed(PIDGEY, 10, TACKLE)], 1),
    );
    const result = resolveTurn(state, 0, steady);

    expect(spreadHits(result.events)).toEqual([]);
    expect(of(result.events, 'used-move')[0].spread).toBeUndefined();
  });
});

describe('the move flags a double battle does not change', () => {
  it('still reads contact off the move rather than off the number of targets', () => {
    expect(RAZOR_LEAF.target).toBe(MoveTarget.BothFoes);
    expect(TACKLE.flags).toContain(MoveFlag.Contact);
    expect(RAZOR_LEAF.category).toBe(MoveCategory.Special);
  });
});

describe('where the one authored double battle is', () => {
  it('is Warden Holt, and nobody else asks for two', () => {
    const doubles = createRunTrainerEncounters().filter(
      (encounter) => (encounter.trainer.unitCount ?? 1) > 1,
    );

    // One, deliberately. A double battle is two decisions a turn, and the only
    // fight in a five-minute raid that can charge that is a boss holding the
    // last door - see the note beside her in `trainers.ts`.
    expect(doubles.map((encounter) => encounter.trainer.id)).toEqual([
      'floodplain-orchard-warden-holt',
    ]);
    expect(doubles[0].bossId).toBeDefined();
  });

  it('costs a player who brought one Pokemon nothing at all', () => {
    const holt = createRunTrainerEncounters().find(
      (encounter) => encounter.trainer.id === 'floodplain-orchard-warden-holt',
    )!.trainer;
    const alone = createTrainerBattleState(new Pokemon(BULBASAUR, 14), holt);

    // The engine refuses the second slot when the player has nobody for it, so
    // the fight a lone starter walks into is the fight it always was.
    expect(alone.unitCount).toBe(1);
    expect(alone.enemyPartner).toBeNull();
  });
});

describe('what a spread move puts in the log', () => {
  const BYSTANDER = species({ id: 'bystander2', name: 'Bystander', baseStats: stats(10) });
  const field = (): BattleState =>
    createTrainerBattleState(
      armed(BULBASAUR, 20, GROWL),
      pair([armed(BYSTANDER, 10, TACKLE), armed(BYSTANDER, 10, TACKLE)]),
      null,
      armed(BYSTANDER, 10, TACKLE),
    );

  it('says nothing per target about a move that takes no HP from anybody', () => {
    const result = resolveTurn(field(), [{ slot: 0, moveIndex: 0 }], steady);

    // A Growl that hits two used to put "Foe X was unharmed" up twice before
    // the two lines that say what it actually did. Four presses, no news.
    expect(spreadHits(result.events)).toEqual([]);
    expect(
      of(result.events, 'stat-stage-changed')
        .filter((event) => event.user === 'enemy')
        .map((event) => event.slot ?? 0),
    ).toEqual([0, 1]);
  });
});

describe('a move a Pokemon uses on itself', () => {
  it('lands its own boost on nobody when it missed', () => {
    // Reachable only because the accuracy roll now reads the user's own evasion
    // for a self-targeted move rather than the foe's. Whether the effects land
    // is read off what the move actually reached, so a miss is a miss whoever
    // it was aimed at.
    const FLIGHTY = new MoveBase({
      name: 'Flighty',
      type: PokemonType.Normal,
      power: 0,
      accuracy: 1,
      pp: 10,
      category: MoveCategory.Status,
      target: MoveTarget.Self,
      effects: { boosts: [{ stat: 'speed', stages: 2 }] },
    });
    const PLAIN = species({ id: 'plain2', name: 'Plain', baseStats: stats(50) });
    const state = createTrainerBattleState(
      armed(PLAIN, 10, FLIGHTY),
      pair([armed(PLAIN, 10, TACKLE), armed(PLAIN, 10, TACKLE)]),
      null,
      armed(PLAIN, 10, TACKLE),
    );
    const result = resolveTurn(state, [{ slot: 0, moveIndex: 0 }], steady);

    expect(of(result.events, 'missed')).toHaveLength(1);
    expect(unitAt(result.state, slotRef('player', 0))?.statStages.speed).toBe(0);
  });
});

/**
 * The same multi-unit hooks, asked of the Pokemon that really carry them.
 *
 * The cases above are built on species made up for the test, which is right for
 * a rule; these are the same rules against the imported roster, because since
 * the 151 landed every one of these abilities has real instances and an engine
 * rule that only holds for a species nobody can meet is not held at all.
 * `getSpeciesById` rather than a named export, deliberately: only the original
 * seventeen have one, so reading the rest by id is reading the import.
 */
describe('the multi-unit ability hooks, against imported species', () => {
  const of151 = (id: string, level: number, ...moves: readonly MoveBase[]): Pokemon => {
    const base = getSpeciesById(id);
    expect(base, `${id} is in the imported roster`).toBeDefined();
    return moves.length === 0 ? new Pokemon(base!, level) : armed(base!, level, ...moves);
  };

  /** Takes every move's PP away, so this slot has no action to take. */
  const silenced = (state: BattleState, ref: ReturnType<typeof slotRef>): BattleState => {
    const combatant = unitAt(state, ref)!;
    const quiet = { ...combatant, moves: combatant.moves.map((move) => ({ ...move, pp: 0 })) };
    return ref.slot === 0 ? { ...state, enemy: quiet } : { ...state, enemyPartner: quiet };
  };

  it("answers each attacker that touches it - a real Electabuzz's Static, twice", () => {
    // Static is on Pikachu, Raichu and Electabuzz. Two of the player's hit the
    // same one with a contact move, and the ability is asked once for each of
    // them - the counterpart of the weather above, which fires once per unit on
    // the field rather than once per hit taken.
    expect(getSpeciesById('electabuzz')?.abilityId).toBe('static');
    let state = createTrainerBattleState(
      of151('pidgey', 5, TACKLE),
      pair([of151('electabuzz', 30), of151('electabuzz', 30)]),
      null,
      of151('pidgey', 5, TACKLE),
    );
    // The Electabuzz are far faster and would act first; with nothing to throw
    // they take no action, so what is left in the turn is the two blows this is
    // about.
    state = silenced(silenced(state, slotRef('enemy', 0)), slotRef('enemy', 1));
    const lead = slotRef('enemy', 0);
    const result = resolveTurn(
      state,
      [
        { slot: 0, moveIndex: 0, target: lead },
        { slot: 1, moveIndex: 0, target: lead },
      ],
      always,
    );

    const shocks = of(result.events, 'ability').filter((event) => event.effect === 'contact');
    expect(shocks).toHaveLength(2);
    expect(shocks.every((event) => event.user === 'enemy' && (event.slot ?? 0) === 0)).toBe(true);
  });

  it("lowers both foes' Attack when a real Intimidate lands - Arbok's", () => {
    // Nothing in the seventeen shipped species carried Intimidate, so until the
    // import this rule had no instance at all. Six species carry it now.
    expect(getSpeciesById('arbok')?.abilityId).toBe('intimidate');
    const state = createTrainerBattleState(
      of151('bulbasaur', 20),
      pair([of151('arbok', 20), of151('pidgey', 20)]),
      null,
      of151('squirtle', 20),
    );

    // Across the field, not at one of the two things on it.
    expect(unitAt(state, slotRef('player', 0))?.statStages.attack).toBe(-1);
    expect(unitAt(state, slotRef('player', 1))?.statStages.attack).toBe(-1);
    expect(
      openingAbilityEvents(state)
        .filter((event) => event.type === 'stat-stage-changed')
        .map((event) => `${event.user}${'slot' in event ? (event.slot ?? 0) : 0}`),
    ).toEqual(['player0', 'player1']);
  });

  it('stills the weather from the second slot, not just from a lead', () => {
    // `effectiveWeather` asks every body on the field. It used to ask the two
    // leads, which in a double battle is half of them - so a Psyduck standing
    // in the partner slot would have been a Cloud Nine nobody could feel.
    expect(getSpeciesById('psyduck')?.abilityId).toBe('cloud-nine');
    const state = createTrainerBattleState(
      of151('bulbasaur', 20),
      pair([of151('pidgey', 20), of151('psyduck', 20)]),
      WeatherId.Rain,
      of151('squirtle', 20),
    );

    expect(state.weather?.id).toBe(WeatherId.Rain);
    expect(effectiveWeather(state)).toBeNull();
  });

  it('refuses a spread move\'s secondary on the one foe that can refuse it', () => {
    // Shield Dust is on Caterpie, Weedle and Venomoth. A spread move rolls its
    // secondary per target, so one foe shrugging it off says nothing about the
    // other - which is only visible with two foes and was unreachable before.
    expect(getSpeciesById('caterpie')?.abilityId).toBe('shield-dust');
    let state = createTrainerBattleState(
      of151('squirtle', 25, BUBBLE),
      pair([of151('caterpie', 25), of151('pidgey', 25)]),
      null,
      of151('squirtle', 25, TACKLE),
    );
    state = silenced(silenced(state, slotRef('enemy', 0)), slotRef('enemy', 1));
    const result = resolveTurn(state, [{ slot: 0, moveIndex: 0 }], always);

    expect(
      of(result.events, 'ability').some((event) => event.effect === 'blocked-secondaries'),
    ).toBe(true);
    expect(
      of(result.events, 'stat-stage-changed')
        .filter((event) => event.stat === 'speed')
        .map((event) => event.slot ?? 0),
    ).toEqual([1]);
  });
});

/**
 * The import decides what 134 of the 151 know, so a spread move is only real
 * across the roster if the generator carries the target through.
 *
 * It did not: `tools/species/generate.mjs` mapped PokeAPI's `user` to
 * `MoveTarget.Self` and let everything else fall to `Foe`, which flattened
 * every `all-opponents` move the import brought in. That was invisible while
 * there could only be one foe on the field, and it is exactly the sort of thing
 * that stays invisible - so it is pinned here, off the same committed snapshot
 * the generator reads.
 */
describe('the imported roster knows a spread move when it has one', () => {
  const snapshot = JSON.parse(
    readFileSync(new URL('../../../../tools/moves/frlg-level-up-moves.json', import.meta.url), 'utf8'),
  ) as Record<string, { readonly name: string; readonly target: string }>;

  const allOpponents = Object.values(snapshot)
    .filter((move) => move.target === 'all-opponents')
    .map((move) => move.name);

  it('gives every `all-opponents` move it can play `MoveTarget.BothFoes`', () => {
    expect(allOpponents.length).toBeGreaterThan(10);
    const flattened = allOpponents
      .filter((name) => MOVE_CATALOGUE[name] !== undefined)
      .filter((name) => MOVE_CATALOGUE[name].target !== MoveTarget.BothFoes);

    expect(flattened).toEqual([]);
  });

  it('reaches most of the roster rather than the handful that were authored', () => {
    const learners = ALL_SPECIES.filter((species) =>
      species.learnset.some((entry) => entry.move.target === MoveTarget.BothFoes),
    );

    // 106 of 151 when this was written. The floor is what matters: a spread
    // move is a thing the game is full of, not a footnote on five moves.
    expect(learners.length).toBeGreaterThan(90);
  });

  it('leaves `all-other-pokemon` aiming at one foe rather than inventing a target', () => {
    // Earthquake, Explosion, Magnitude and Self-Destruct also hit your own
    // partner, and `MoveTarget` has no value for that. Made into `BothFoes`
    // they would be quietly wrong; left alone they are quietly narrow, which is
    // the honest of the two.
    const everyone = Object.values(snapshot)
      .filter((move) => move.target === 'all-other-pokemon')
      .map((move) => move.name)
      .filter((name) => MOVE_CATALOGUE[name] !== undefined);

    expect(everyone.every((name) => MOVE_CATALOGUE[name].target === MoveTarget.Foe)).toBe(true);
  });
});
