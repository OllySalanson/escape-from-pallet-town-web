import { describe, expect, it } from 'vitest';
import { MoveBase, MoveCategory, MoveFlag, MoveTarget } from '../MoveBase';
import { Move } from '../Move';
import { Pokemon } from '../Pokemon';
import { PokemonBase, type PokemonBaseInit } from '../PokemonBase';
import { PokemonType } from '../PokemonType';
import {
  BITE,
  EMBER,
  GROWL,
  METAL_CLAW,
  SCRATCH,
  SLEEP_POWDER,
  SMOKESCREEN,
  SYNTHESIS,
  TACKLE,
  THUNDER_WAVE,
} from '../moves';
import { ABILITIES, ABILITIES_BY_ID, getAbilityById } from '../abilities';
import {
  abilityCarrier,
  createBattleState,
  openingAbilityEvents,
  replacePlayerPokemon,
  resolveTurn,
  type BattleEvent,
  type BattleState,
} from './battleEngine';
import { attemptWildEscape, wildEscapeChanceFor } from './escape';
import { PrimaryStatus } from './status';
import { WeatherId } from './weather';

/**
 * What an ability does, and that the resolver never learns one's name.
 *
 * Every case here is a hook on `AbilityBase` and a branch that reads it, in the
 * same shape `moveEffects.test.ts` holds the move model: the ability is a data
 * row, the engine asks `abilityHooks.ts` a question, and nothing between the
 * two knows what Blaze is. No Phaser, because `resolveTurn` is pure and returns
 * `{ state, events }`.
 */

const at = (overrides: Readonly<Record<number, number>>, fallback = 0.5): (() => number) => {
  let index = 0;
  return () => overrides[index++] ?? fallback;
};
const always = (): number => 0;
const never = (): number => 0.999999;

const types = (events: readonly BattleEvent[]): string[] => events.map((event) => event.type);
const abilityEvents = (
  events: readonly BattleEvent[],
): Extract<BattleEvent, { type: 'ability' }>[] =>
  events.filter((event): event is Extract<BattleEvent, { type: 'ability' }> => event.type === 'ability');
const didFire = (events: readonly BattleEvent[], effect: string): boolean =>
  abilityEvents(events).some((event) => event.effect === effect);
const find = <T extends BattleEvent['type']>(
  events: readonly BattleEvent[],
  type: T,
): Extract<BattleEvent, { type: T }> | undefined =>
  events.find((event): event is Extract<BattleEvent, { type: T }> => event.type === type);

/** A species that exists only to carry one ability and one type. */
const species = (init: Partial<PokemonBaseInit> & { readonly abilityId: string | null }): PokemonBase =>
  new PokemonBase({
    id: init.id ?? `test-${init.abilityId ?? 'none'}`,
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
    abilityId: init.abilityId,
  });

const armed = (base: PokemonBase, level: number, ...moves: readonly MoveBase[]): Pokemon => {
  const pokemon = new Pokemon(base, level);
  pokemon.moves.splice(0, pokemon.moves.length, ...moves.map((move) => new Move(move)));
  return pokemon;
};

/** The first side to put a `used-move` line out, which is the turn order. */
const firstMover = (events: readonly BattleEvent[]): 'player' | 'enemy' | undefined =>
  events.find((event): event is Extract<BattleEvent, { type: 'used-move' }> => event.type === 'used-move')
    ?.user;

/** Every stat the same, so a test about Speed is only about Speed. */
const stats = (speed: number) => ({
  hp: 60,
  attack: 50,
  defense: 50,
  spAttack: 50,
  spDefense: 50,
  speed,
});

const hurtTo = (state: BattleState, side: 'player' | 'enemy', hp: number): BattleState => ({
  ...state,
  [side]: { ...state[side], currentHp: hp },
});

const GROUND_STOMP = new MoveBase({
  name: 'Ground Stomp',
  type: PokemonType.Ground,
  power: 60,
  accuracy: 100,
  pp: 10,
  category: MoveCategory.Physical,
});
const SOAK = new MoveBase({
  name: 'Soak',
  type: PokemonType.Water,
  power: 40,
  accuracy: 100,
  pp: 10,
  category: MoveCategory.Special,
});
const SIPHON = new MoveBase({
  name: 'Siphon',
  type: PokemonType.Grass,
  power: 40,
  accuracy: 100,
  pp: 10,
  category: MoveCategory.Special,
  drain: 0.5,
});
const CRASH = new MoveBase({
  name: 'Crash',
  type: PokemonType.Normal,
  power: 60,
  accuracy: 100,
  pp: 10,
  category: MoveCategory.Physical,
  recoil: 1 / 3,
  flags: [MoveFlag.Contact],
});

describe('the abilities that change a number', () => {
  it('powers a pinch ability up inside the last third and not above it', () => {
    const player = armed(species({ abilityId: 'blaze', primaryType: PokemonType.Fire }), 20, EMBER);
    const enemy = armed(species({ abilityId: null }), 20);
    const fresh = createBattleState(player, enemy);
    const cornered = hurtTo(fresh, 'player', Math.floor(player.maxHp / 3));

    const healthy = resolveTurn(fresh, 0, at({})).state.enemy.currentHp;
    const desperate = resolveTurn(cornered, 0, at({})).state.enemy.currentHp;

    expect(enemy.maxHp - desperate).toBeGreaterThan(enemy.maxHp - healthy);
    expect(didFire(resolveTurn(cornered, 0, at({})).events, 'powered-up')).toBe(true);
    expect(didFire(resolveTurn(fresh, 0, at({})).events, 'powered-up')).toBe(false);
  });

  it('gives Guts its boost for a status but never while it is asleep', () => {
    const base = species({ abilityId: 'guts' });
    const damage = (status: PrimaryStatus | null): number => {
      const player = armed(base, 20, TACKLE);
      const opponent = armed(species({ abilityId: null }), 20);
      const state = createBattleState(player, opponent);
      const withStatus: BattleState = { ...state, player: { ...state.player, primaryStatus: status } };
      // `never` keeps a paralysed attacker acting rather than losing the turn.
      return opponent.maxHp - resolveTurn(withStatus, 0, never).state.enemy.currentHp;
    };

    expect(damage(PrimaryStatus.Burn)).toBeGreaterThan(damage(null));

    // A sleeping holder cannot swing at all, so the sleep clause is asked of the
    // hook rather than of a turn. It is generation III and IV's own rule, which
    // PokeAPI records against `diamond-pearl` as what Guts did up to it.
    const guts = getAbilityById('guts')!;
    const holder = {
      currentHp: 20,
      maxHp: 20,
      types: [PokemonType.Normal],
      charged: false,
    };
    expect(guts.modifyAttack!({ holder: { ...holder, primaryStatus: PrimaryStatus.Burn }, move: TACKLE })).toBe(1.5);
    expect(guts.modifyAttack!({ holder: { ...holder, primaryStatus: PrimaryStatus.Sleep }, move: TACKLE })).toBe(1);
  });

  it('raises a move’s accuracy with Compound Eyes rather than its damage', () => {
    // Seventy per cent raised by a third is ninety-one, so a roll of 0.8 misses
    // the plain swing and lands the sharpened one. It has to be a move that can
    // miss at all: a hundred is a hundred however keen the eye.
    const chancy = new MoveBase({
      name: 'Wild Swing',
      type: PokemonType.Normal,
      power: 40,
      accuracy: 70,
      pp: 10,
      category: MoveCategory.Physical,
    });
    const enemy = () => armed(species({ abilityId: null }), 20);
    const swing = (abilityId: string | null) =>
      resolveTurn(
        createBattleState(armed(species({ abilityId }), 20, chancy), enemy()),
        0,
        at({ 0: 0.8 }),
      );

    expect(types(swing(null).events)).toContain('missed');
    const sharp = swing('compound-eyes');
    expect(types(sharp.events)).not.toContain('missed');
    expect(didFire(sharp.events, 'sharpened')).toBe(true);
  });

  it('halves what Thick Fat takes from Fire and leaves everything else alone', () => {
    const attacker = armed(species({ abilityId: null }), 20, EMBER, TACKLE);
    const took = (abilityId: string | null, move: number): number => {
      const target = armed(species({ abilityId }), 20);
      const state = createBattleState(attacker, target);
      return target.maxHp - resolveTurn(state, move, at({})).state.enemy.currentHp;
    };

    expect(took('thick-fat', 0)).toBeLessThan(took(null, 0));
    expect(took('thick-fat', 1)).toBe(took(null, 1));
  });

  it('turns a critical hit aside with armour, and says so once', () => {
    const attacker = armed(species({ abilityId: null }), 20, TACKLE);
    const hit = (abilityId: string | null) =>
      resolveTurn(createBattleState(attacker, armed(species({ abilityId }), 20)), 0, always);

    expect(types(hit(null).events)).toContain('critical-hit');
    const armoured = hit('shell-armor');
    expect(types(armoured.events)).not.toContain('critical-hit');
    expect(didFire(armoured.events, 'hardened')).toBe(true);
  });

  it('says a continuous ability once a battle and no more', () => {
    const player = armed(species({ abilityId: 'compound-eyes' }), 20, SMOKESCREEN, SMOKESCREEN);
    const first = resolveTurn(createBattleState(player, armed(species({ abilityId: null }), 20)), 0, at({}));
    const second = resolveTurn(first.state, 1, at({}));

    expect(didFire(first.events, 'sharpened')).toBe(true);
    expect(didFire(second.events, 'sharpened')).toBe(false);
  });
});

describe('the abilities that refuse something', () => {
  it('pays no recoil with Rock Head', () => {
    const plain = resolveTurn(
      createBattleState(armed(species({ abilityId: null }), 20, CRASH), armed(species({ abilityId: null }), 20)),
      0,
      at({}),
    );
    const headstrong = resolveTurn(
      createBattleState(
        armed(species({ abilityId: 'rock-head' }), 20, CRASH),
        armed(species({ abilityId: null }), 20),
      ),
      0,
      at({}),
    );

    expect(types(plain.events)).toContain('recoil');
    expect(types(headstrong.events)).not.toContain('recoil');
    expect(didFire(headstrong.events, 'no-recoil')).toBe(true);
  });

  it('refuses a stat drop from the other side and allows one a Pokemon takes itself', () => {
    const smoker = armed(species({ abilityId: null }), 20, SMOKESCREEN);
    const keen = armed(species({ abilityId: 'keen-eye' }), 20);
    const refused = resolveTurn(createBattleState(smoker, keen), 0, at({}));

    expect(refused.state.enemy.statStages.accuracy).toBe(0);
    expect(didFire(refused.events, 'blocked-boost')).toBe(true);

    // Metal Claw's raise is `target: Self`, so Clear Body on the other side has
    // nothing to say about it - and neither would a drop a Pokemon took itself.
    const clawed = resolveTurn(
      createBattleState(
        armed(species({ abilityId: null }), 20, METAL_CLAW),
        armed(species({ abilityId: 'clear-body' }), 20),
      ),
      0,
      at({ 3: 0 }),
    );
    expect(clawed.state.player.statStages.attack).toBe(1);
  });

  it('refuses a status from the other side, and a flinch is one of them', () => {
    const asleep = resolveTurn(
      createBattleState(
        armed(species({ abilityId: null }), 20, SLEEP_POWDER),
        armed(species({ abilityId: 'insomnia' }), 20),
      ),
      0,
      at({}),
    );
    expect(asleep.state.enemy.primaryStatus).toBeNull();
    expect(didFire(asleep.events, 'blocked-status')).toBe(true);

    const bitten = resolveTurn(
      createBattleState(
        armed(species({ abilityId: null }), 20, BITE),
        armed(species({ abilityId: 'inner-focus' }), 20, TACKLE),
      ),
      0,
      at({ 4: 0 }),
    );
    expect(bitten.state.enemy.flinching).toBe(false);
    expect(types(bitten.events)).not.toContain('flinched');
  });

  it('blocks a move’s extra effect with Shield Dust without touching its own user’s', () => {
    const dusted = resolveTurn(
      createBattleState(
        armed(species({ abilityId: null }), 20, BITE),
        armed(species({ abilityId: 'shield-dust' }), 20),
      ),
      0,
      at({ 4: 0 }),
    );
    expect(dusted.state.enemy.flinching).toBe(false);
    expect(didFire(dusted.events, 'blocked-secondaries')).toBe(true);

    const clawed = resolveTurn(
      createBattleState(
        armed(species({ abilityId: null }), 20, METAL_CLAW),
        armed(species({ abilityId: 'shield-dust' }), 20),
      ),
      0,
      at({ 3: 0 }),
    );
    expect(clawed.state.player.statStages.attack).toBe(1);
  });

  it('doubles the chance of its own extra effect with Serene Grace', () => {
    // Bite's flinch is 30%, so a roll of 0.45 lands only at twice the chance.
    const roll = () => at({ 4: 0.45 });
    const plain = resolveTurn(
      createBattleState(armed(species({ abilityId: null }), 20, BITE), armed(species({ abilityId: null }), 20, TACKLE)),
      0,
      roll(),
    );
    const graceful = resolveTurn(
      createBattleState(
        armed(species({ abilityId: 'serene-grace' }), 20, BITE),
        armed(species({ abilityId: null }), 20, TACKLE),
      ),
      0,
      roll(),
    );

    expect(types(plain.events)).not.toContain('flinched');
    expect(types(graceful.events)).toContain('flinched');
  });
});

describe('the abilities that let nothing through at all', () => {
  it('lets a Ground move straight past a Levitate', () => {
    const result = resolveTurn(
      createBattleState(
        armed(species({ abilityId: null }), 20, GROUND_STOMP),
        armed(species({ abilityId: 'levitate' }), 20),
      ),
      0,
      at({}),
    );

    expect(result.state.enemy.currentHp).toBe(result.state.enemy.pokemon.maxHp);
    expect(didFire(result.events, 'absorbed')).toBe(true);
  });

  it('heals a Water Absorb with the move it was hit by', () => {
    const target = armed(species({ abilityId: 'water-absorb' }), 20);
    const opening = createBattleState(armed(species({ abilityId: null }), 20, SOAK), target);
    const result = resolveTurn(hurtTo(opening, 'enemy', 10), 0, at({}));

    expect(result.state.enemy.currentHp).toBeGreaterThan(10);
    expect(find(result.events, 'ability')?.amount).toBe(Math.floor(target.maxHp / 4));
  });

  it('charges a Flash Fire on the fire it swallowed and burns hotter afterwards', () => {
    const holder = armed(species({ abilityId: 'flash-fire', primaryType: PokemonType.Fire }), 20, EMBER);
    const attacker = armed(species({ abilityId: null }), 20, EMBER);
    const cold = createBattleState(holder, attacker);

    // Both swing Ember. The one aimed at the Flash Fire is swallowed whole, and
    // that is what charges it.
    const swallowed = resolveTurn(cold, 0, at({})).state;
    expect(swallowed.player.currentHp).toBe(holder.maxHp);
    expect(swallowed.player.abilityCharged).toBe(true);

    // Compared as damage dealt rather than HP left, because the swallowed turn
    // has already hurt the other side once.
    const dealt = (state: BattleState): number =>
      state.enemy.currentHp - resolveTurn(state, 0, at({})).state.enemy.currentHp;
    expect(dealt(swallowed)).toBeGreaterThan(dealt(cold));
  });

  it('hears nothing through Soundproof', () => {
    const result = resolveTurn(
      createBattleState(
        armed(species({ abilityId: null }), 20, GROWL),
        armed(species({ abilityId: 'soundproof' }), 20),
      ),
      0,
      at({}),
    );

    expect(result.state.enemy.statStages.attack).toBe(0);
    expect(didFire(result.events, 'absorbed')).toBe(true);
  });
});

describe('the abilities that answer back', () => {
  it('paralyses whoever touched a Static, and only on a move that made contact', () => {
    const shocked = resolveTurn(
      createBattleState(
        armed(species({ abilityId: null }), 20, SCRATCH),
        armed(species({ abilityId: 'static' }), 20),
      ),
      0,
      at({ 3: 0, 4: 0 }),
    );
    expect(shocked.state.player.primaryStatus).toBe(PrimaryStatus.Paralysis);
    expect(didFire(shocked.events, 'contact')).toBe(true);

    const distant = resolveTurn(
      createBattleState(
        armed(species({ abilityId: null }), 20, EMBER),
        armed(species({ abilityId: 'static' }), 20),
      ),
      0,
      always,
    );
    expect(distant.state.player.primaryStatus).toBeNull();
  });

  it('does not answer a blow that knocked it out', () => {
    const attacker = armed(species({ abilityId: null }), 30, SCRATCH);
    const opening = createBattleState(attacker, armed(species({ abilityId: 'static' }), 5));
    const result = resolveTurn(hurtTo(opening, 'enemy', 1), 0, always);

    expect(result.state.enemy.currentHp).toBe(0);
    expect(result.state.player.primaryStatus).toBeNull();
  });

  it('passes a status straight back through Synchronize', () => {
    const result = resolveTurn(
      createBattleState(
        armed(species({ abilityId: null, primaryType: PokemonType.Electric }), 20, THUNDER_WAVE),
        armed(species({ abilityId: 'synchronize' }), 20),
      ),
      0,
      at({}),
    );

    expect(result.state.enemy.primaryStatus).toBe(PrimaryStatus.Paralysis);
    expect(result.state.player.primaryStatus).toBe(PrimaryStatus.Paralysis);
    expect(didFire(result.events, 'reflected')).toBe(true);
  });

  it('hurts whatever drained a Liquid Ooze instead of feeding it', () => {
    const drainer = armed(species({ abilityId: null }), 20, SIPHON);
    const opening = createBattleState(drainer, armed(species({ abilityId: 'liquid-ooze' }), 20));
    const result = resolveTurn(hurtTo(opening, 'player', 20), 0, at({}));

    expect(result.state.player.currentHp).toBeLessThan(20);
    expect(types(result.events)).not.toContain('drained');
  });
});

describe('the abilities that work off the clock, the bench and the exit', () => {
  it('sheds a status at the end of a turn on its own roll', () => {
    const player = armed(species({ abilityId: 'shed-skin' }), 20, TACKLE);
    const opening = createBattleState(player, armed(species({ abilityId: null }), 20));
    const poisoned: BattleState = {
      ...opening,
      player: { ...opening.player, primaryStatus: PrimaryStatus.Poison },
    };

    // The shed roll is the last draw of the action, so `always` sheds and
    // `never` does not: 1/3 is the generation III chance.
    expect(resolveTurn(poisoned, 0, always).state.player.primaryStatus).toBeNull();
    expect(resolveTurn(poisoned, 0, never).state.player.primaryStatus).toBe(PrimaryStatus.Poison);
  });

  it('burns through sleep twice as fast with Early Bird', () => {
    const sleeper = (abilityId: string | null): number => {
      const player = armed(species({ abilityId }), 20, TACKLE);
      const opening = createBattleState(player, armed(species({ abilityId: null }), 20));
      const asleep: BattleState = {
        ...opening,
        player: { ...opening.player, primaryStatus: PrimaryStatus.Sleep, sleepTurns: 3 },
      };
      return resolveTurn(asleep, 0, never).state.player.sleepTurns;
    };

    expect(sleeper(null)).toBe(2);
    expect(sleeper('early-bird')).toBe(1);
  });

  it('cows the other side on arrival, at the opening and on a switch', () => {
    const scary = armed(species({ abilityId: 'intimidate' }), 20, TACKLE);
    const opening = createBattleState(scary, armed(species({ abilityId: null }), 20));

    expect(opening.enemy.statStages.attack).toBe(-1);
    expect(openingAbilityEvents(opening).some((event) => event.type === 'ability')).toBe(true);

    const plain = createBattleState(armed(species({ abilityId: null }), 20, TACKLE), armed(species({ abilityId: null }), 20));
    const switched = replacePlayerPokemon(plain, scary);
    expect(switched.state.enemy.statStages.attack).toBe(-1);
    expect(abilityEvents(switched.events).map((event) => event.effect)).toContain('sent-out');
  });

  it('clears a status on the way out with Natural Cure', () => {
    const healer = armed(species({ abilityId: 'natural-cure' }), 20, TACKLE);
    const opening = createBattleState(healer, armed(species({ abilityId: null }), 20));
    const poisoned: BattleState = {
      ...opening,
      player: { ...opening.player, primaryStatus: PrimaryStatus.Poison },
    };

    const switched = replacePlayerPokemon(poisoned, armed(species({ abilityId: null }), 20, TACKLE));

    expect(healer.primaryStatus).toBeNull();
    expect(abilityEvents(switched.events).map((event) => event.effect)).toContain('cured-on-switch');
  });

  it('charges an extra PP for a move aimed at Pressure and none for one aimed inward', () => {
    const player = armed(species({ abilityId: null }), 20, TACKLE, SYNTHESIS);
    const heavy = () => createBattleState(player, armed(species({ abilityId: 'pressure' }), 20));

    expect(resolveTurn(heavy(), 0, at({})).state.player.moves[0]?.pp).toBe(TACKLE.pp - 2);
    expect(resolveTurn(heavy(), 1, at({})).state.player.moves[1]?.pp).toBe(SYNTHESIS.pp - 1);
  });

  it('always gets a Run Away out, and never lets an Arena Trap’s prey go', () => {
    const runner = createBattleState(
      armed(species({ abilityId: 'run-away' }), 5),
      armed(species({ abilityId: null }), 60),
    );
    expect(wildEscapeChanceFor(runner.player, runner.enemy, 0)).toBe(1);
    expect(attemptWildEscape(runner.player, runner.enemy, 0, never).escaped).toBe(true);

    const trapped = createBattleState(
      armed(species({ abilityId: null }), 60),
      armed(species({ abilityId: 'arena-trap' }), 5),
    );
    expect(attemptWildEscape(trapped.player, trapped.enemy, 9, always).escaped).toBe(false);

    // A Flying type is not on the ground, and neither is anything that floats -
    // which is Levitate's business rather than Arena Trap's.
    const flier = createBattleState(
      armed(species({ abilityId: null, primaryType: PokemonType.Flying }), 60),
      armed(species({ abilityId: 'arena-trap' }), 5),
    );
    expect(attemptWildEscape(flier.player, flier.enemy, 9, always).escaped).toBe(true);
    const floater = createBattleState(
      armed(species({ abilityId: 'levitate' }), 60),
      armed(species({ abilityId: 'arena-trap' }), 5),
    );
    expect(attemptWildEscape(floater.player, floater.enemy, 9, always).escaped).toBe(true);

    // Magnet Pull holds Steel and nothing else.
    const magnet = (type: PokemonType) =>
      createBattleState(
        armed(species({ abilityId: null, primaryType: type }), 60),
        armed(species({ abilityId: 'magnet-pull' }), 5),
      );
    const steel = magnet(PokemonType.Steel);
    expect(attemptWildEscape(steel.player, steel.enemy, 9, always).escaped).toBe(false);
    const rock = magnet(PokemonType.Rock);
    expect(attemptWildEscape(rock.player, rock.enemy, 9, always).escaped).toBe(true);
  });
});

describe('the four that are only about the weather', () => {
  /** A fight already standing in this weather, as a place's weather would be. */
  const inWeather = (
    player: Pokemon,
    enemy: Pokemon,
    weather: WeatherId | null,
  ): BattleState => createBattleState(player, enemy, weather);

  it('doubles Speed in its own weather and settles the turn order with it', () => {
    const slow = armed(species({ abilityId: 'swift-swim', baseStats: stats(40) }), 20, TACKLE);
    const fast = armed(species({ abilityId: null, baseStats: stats(70) }), 20, TACKLE);

    const dry = resolveTurn(inWeather(slow, fast, null), 0, at({}));
    expect(firstMover(dry.events)).toBe('enemy');

    const wet = resolveTurn(inWeather(slow, fast, WeatherId.Rain), 0, at({}));
    expect(firstMover(wet.events)).toBe('player');
    expect(didFire(wet.events, 'quickened')).toBe(true);

    // The wrong weather is no weather at all as far as it is concerned.
    const sunny = resolveTurn(inWeather(slow, fast, WeatherId.HarshSunlight), 0, at({}));
    expect(firstMover(sunny.events)).toBe('enemy');
  });

  it('hides a Sand Veil in a sandstorm and spares it the scouring', () => {
    const chancy = new MoveBase({
      name: 'Wild Swing',
      type: PokemonType.Normal,
      power: 40,
      accuracy: 85,
      pp: 10,
      category: MoveCategory.Physical,
    });
    const swing = (weather: WeatherId | null, abilityId: string | null) =>
      resolveTurn(
        inWeather(armed(species({ abilityId: null }), 20, chancy), armed(species({ abilityId }), 20), weather),
        0,
        // 85 is a hit; 85 divided by a quarter more is 68, which this misses.
        at({ 0: 0.7 }),
      );

    expect(types(swing(WeatherId.Sandstorm, null).events)).not.toContain('missed');
    const veiled = swing(WeatherId.Sandstorm, 'sand-veil');
    expect(types(veiled.events)).toContain('missed');
    expect(didFire(veiled.events, 'hidden')).toBe(true);
    // Out of the sand it is an ordinary Pokemon.
    expect(types(swing(null, 'sand-veil').events)).not.toContain('missed');

    // And the storm never touches it, which is the other half of the ability.
    const scoured = resolveTurn(
      inWeather(armed(species({ abilityId: 'sand-veil' }), 20, TACKLE), armed(species({ abilityId: null }), 20), WeatherId.Sandstorm),
      0,
      at({}),
    );
    const chipped = scoured.events.filter((event) => event.type === 'weather-damage');
    expect(chipped.map((event) => (event as { user: string }).user)).toEqual(['enemy']);
  });

  it('holds the weather off entirely with a Cloud Nine on either side', () => {
    const still = resolveTurn(
      inWeather(armed(species({ abilityId: 'cloud-nine' }), 20, TACKLE), armed(species({ abilityId: null }), 20), WeatherId.Hail),
      0,
      at({}),
    );
    expect(types(still.events)).not.toContain('weather-damage');
    expect(didFire(still.events, 'weathered-out')).toBe(true);

    const hailing = resolveTurn(
      inWeather(armed(species({ abilityId: null }), 20, TACKLE), armed(species({ abilityId: null }), 20), WeatherId.Hail),
      0,
      at({}),
    );
    expect(types(hailing.events)).toContain('weather-damage');

    // It reaches the damage weather bends as well as the chip it takes, and it
    // works from the other side of the field just the same.
    const fire = new MoveBase({
      name: 'Flare',
      type: PokemonType.Fire,
      power: 60,
      accuracy: 100,
      pp: 10,
      category: MoveCategory.Special,
    });
    const hit = (abilityId: string | null): number => {
      const enemy = armed(species({ abilityId }), 20);
      const state = inWeather(armed(species({ abilityId: null }), 20, fire), enemy, WeatherId.Rain);
      return enemy.maxHp - resolveTurn(state, 0, at({})).state.enemy.currentHp;
    };
    expect(hit('cloud-nine')).toBeGreaterThan(hit(null));
  });
});

describe('the catalogue', () => {
  it('reads an ability through the species and never copies it onto the fight', () => {
    const state = createBattleState(
      armed(species({ abilityId: 'blaze' }), 20, TACKLE),
      armed(species({ abilityId: null }), 20),
    );

    expect(abilityCarrier(state.player).abilityId).toBe('blaze');
    expect(Object.keys(state.player)).not.toContain('abilityId');
    // The two bits a fight *does* own, and they start clear.
    expect(state.player.abilityCharged).toBe(false);
    expect(state.player.abilityAnnounced).toBe(false);
  });

  it('has a unique id for every ability and finds each one by it', () => {
    const ids = ABILITIES.map((ability) => ability.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const ability of ABILITIES) {
      expect(getAbilityById(ability.id)).toBe(ability);
      expect(ability.name.length).toBeGreaterThan(0);
      expect(ability.description.endsWith('.')).toBe(true);
    }
    expect(getAbilityById(null)).toBeUndefined();
    expect(getAbilityById('nothing-like-this')).toBeUndefined();
    expect(Object.keys(ABILITIES_BY_ID)).toHaveLength(ABILITIES.length);
  });

  it('gives every ability at least one hook, so nothing ships as a name only', () => {
    for (const ability of ABILITIES) {
      const hooks = Object.keys(ability).filter(
        (key) => key !== 'id' && key !== 'name' && key !== 'description',
      );
      expect(hooks.length, ability.id).toBeGreaterThan(0);
    }
  });

  it('never blocks a boost a Pokemon put on itself, whichever ability it is', () => {
    // The refusals are all "by other Pokemon" in generation III, and a hook that
    // forgot it would make Clear Body a Pokemon that cannot use Growl on itself.
    const selfLowering = new MoveBase({
      name: 'Brace',
      type: PokemonType.Normal,
      power: 0,
      accuracy: 100,
      pp: 10,
      category: MoveCategory.Status,
      target: MoveTarget.Self,
      effects: { boosts: [{ stat: 'defense', stages: -1 }] },
    });
    const result = resolveTurn(
      createBattleState(
        armed(species({ abilityId: 'clear-body' }), 20, selfLowering),
        armed(species({ abilityId: null }), 20),
      ),
      0,
      at({}),
    );

    expect(result.state.player.statStages.defense).toBe(-1);
  });
});
