import { describe, expect, it } from 'vitest';
import { Move } from '../Move';
import { MoveCategory, type MoveBase } from '../MoveBase';
import { Pokemon } from '../Pokemon';
import { PokemonBase, type PokemonBaseInit } from '../PokemonBase';
import { PokemonType } from '../PokemonType';
import { MOVE_CATALOGUE } from '../moveCatalogue';
import { TACKLE } from '../moves';
import { BULBASAUR, CHARMANDER, PIDGEY, getSpeciesById } from '../species';
import {
  createBattleState,
  createTrainerBattleState,
  replacePlayerPokemon,
  resolveTurn,
  type BattleEvent,
  type BattleState,
} from './battleEngine';
import { PrimaryStatus } from './status';

/**
 * Leech Seed, as FireRed plays it (pret/pokefirered at 037335f): `Cmd_setseeded`
 * plants it, `ENDTURN_LEECH_SEED` drains it, `BattleScript_LeechSeedTurnDrain`
 * says so. It is the one move a FireRed Bulbasaur learns at level 7, and the
 * reason it is playable at all is that the captain ruled every learnset is
 * FireRed's (2026-10-11).
 */
const LEECH_SEED = MOVE_CATALOGUE['leech-seed'];

const types = (events: readonly BattleEvent[]): string[] => events.map((event) => event.type);
const find = <T extends BattleEvent['type']>(
  events: readonly BattleEvent[],
  type: T,
): Extract<BattleEvent, { type: T }> | undefined =>
  events.find((event): event is Extract<BattleEvent, { type: T }> => event.type === type);

/** A Pokemon holding exactly these moves; with none it cannot act at all. */
const armed = (species: PokemonBase, level: number, ...moves: readonly MoveBase[]): Pokemon => {
  const pokemon = new Pokemon(species, level);
  pokemon.moves.splice(0, pokemon.moves.length, ...moves.map((move) => new Move(move)));
  return pokemon;
};

/** A species that exists only to carry one ability. */
const carrying = (abilityId: string, init: Partial<PokemonBaseInit> = {}): PokemonBase =>
  new PokemonBase({
    id: `test-${abilityId}`,
    name: 'Subject',
    primaryType: PokemonType.Normal,
    baseStats: { hp: 60, attack: 50, defense: 50, spAttack: 50, spDefense: 50, speed: 50 },
    learnset: [{ level: 1, move: TACKLE }],
    abilityId,
    ...init,
  });

/** Every draw lands in the middle: every move hits and nothing crits. */
const middling = (): number => 0.5;

/** The player seeds the enemy, who cannot act, and the turn ends. */
const seeded = (enemy: Pokemon, player = armed(BULBASAUR, 20, LEECH_SEED)): ReturnType<typeof resolveTurn> =>
  resolveTurn(createBattleState(player, enemy), 0, middling);

describe('Leech Seed', () => {
  it("is FireRed's own row, read through the generator rather than written by hand", () => {
    expect(LEECH_SEED).toMatchObject({
      name: 'Leech Seed',
      type: PokemonType.Grass,
      power: 0,
      accuracy: 90,
      pp: 10,
      category: MoveCategory.Status,
    });
    expect(LEECH_SEED.effects.seed).toBe(true);
    expect(LEECH_SEED.hasEffects).toBe(true);
    expect(LEECH_SEED.doesNothing).toBe(false);
  });

  it('seeds the target and says so', () => {
    const result = seeded(armed(PIDGEY, 20));

    expect(find(result.events, 'seeded')).toMatchObject({ user: 'enemy', name: 'Pidgey' });
    expect(result.state.enemy.seededBy).toEqual({ side: 'player', slot: 0 });
  });

  it('takes an eighth of the seeded Pokemon’s maximum HP at the end of every turn and gives it to the seeder', () => {
    const enemy = armed(PIDGEY, 40);
    const fresh = createBattleState(armed(BULBASAUR, 20, LEECH_SEED, TACKLE), enemy);
    const hurt: BattleState = { ...fresh, player: { ...fresh.player, currentHp: 10 } };

    const first = resolveTurn(hurt, 0, middling);
    const owed = Math.floor(enemy.maxHp / 8);
    expect(find(first.events, 'seed-sapped')).toMatchObject({
      user: 'enemy',
      damage: owed,
      to: { user: 'player', amount: owed, oozed: false },
    });
    expect(first.state.enemy.currentHp).toBe(enemy.maxHp - owed);
    expect(first.state.player.currentHp).toBe(10 + owed);

    // And again the turn after, while the seeder does something else entirely.
    const second = resolveTurn(first.state, 1, middling);
    expect(types(second.events).filter((type) => type === 'seed-sapped')).toHaveLength(1);
  });

  it('gives the seeder no more than its own maximum, and still takes the whole eighth', () => {
    const enemy = armed(PIDGEY, 40);
    const result = seeded(enemy);

    const sapped = find(result.events, 'seed-sapped');
    expect(sapped?.damage).toBe(Math.floor(enemy.maxHp / 8));
    expect(sapped?.to.amount).toBe(0);
    expect(result.state.player.currentHp).toBe(result.state.player.pokemon.maxHp);
  });

  it('never takes less than one HP', () => {
    const enemy = armed(PIDGEY, 2);
    expect(Math.floor(enemy.maxHp / 8)).toBe(1);
    expect(find(seeded(enemy).events, 'seed-sapped')?.damage).toBe(1);
  });

  it('does not affect a Grass type, in FireRed’s words', () => {
    const result = seeded(armed(BULBASAUR, 20));

    expect(result.state.enemy.seededBy).toBeNull();
    expect(find(result.events, 'effectiveness')).toMatchObject({ multiplier: 0, user: 'enemy' });
    expect(find(result.events, 'seed-sapped')).toBeUndefined();
  });

  it('cannot be planted twice: the second one is evaded', () => {
    const first = seeded(armed(PIDGEY, 40));
    const again = resolveTurn(first.state, 0, middling);

    expect(find(again.events, 'seed-evaded')).toMatchObject({ user: 'enemy', name: 'Pidgey' });
    expect(types(again.events).filter((type) => type === 'seed-sapped')).toHaveLength(1);
  });

  it('says the target evaded it when it misses, as FireRed does, rather than that it missed', () => {
    const result = resolveTurn(createBattleState(armed(BULBASAUR, 20, LEECH_SEED), armed(PIDGEY, 20)), 0, () => 0.95);

    expect(types(result.events)).toContain('seed-evaded');
    expect(types(result.events)).not.toContain('missed');
    expect(result.state.enemy.seededBy).toBeNull();
  });

  it('drains after the gear and before the poison, as FireRed’s end of turn runs', () => {
    const enemy = armed(PIDGEY, 40);
    enemy.giveHeldItem('leftovers');
    enemy.primaryStatus = PrimaryStatus.Poison;
    const fresh = createBattleState(armed(BULBASAUR, 20, LEECH_SEED), enemy);
    const hurt: BattleState = { ...fresh, enemy: { ...fresh.enemy, currentHp: 20 } };

    const order = types(resolveTurn(hurt, 0, middling).events).filter((type) =>
      ['gear-heal', 'seed-sapped', 'status-damage'].includes(type),
    );
    expect(order).toEqual(['gear-heal', 'seed-sapped', 'status-damage']);
  });

  it('hurts the seeder instead against Liquid Ooze', () => {
    const enemy = armed(carrying('liquid-ooze'), 40);
    const result = seeded(enemy);

    const owed = Math.floor(enemy.maxHp / 8);
    expect(find(result.events, 'seed-sapped')).toMatchObject({ damage: owed, to: { amount: owed, oozed: true } });
    expect(result.state.player.currentHp).toBe(result.state.player.pokemon.maxHp - owed);
  });

  it('knocks out the seeded Pokemon when the drain is the last of it', () => {
    const fresh = createBattleState(armed(BULBASAUR, 20, LEECH_SEED), armed(PIDGEY, 20));
    const nearly: BattleState = { ...fresh, enemy: { ...fresh.enemy, currentHp: 1 } };

    const result = resolveTurn(nearly, 0, middling);
    expect(types(result.events).slice(-2)).toEqual(['seed-sapped', 'fainted']);
    expect(result.state.outcome).toBe('victory');
  });

  it('comes off with the seeded Pokemon when it leaves the field', () => {
    const enemy = armed(BULBASAUR, 20, LEECH_SEED);
    const player = armed(PIDGEY, 20);
    const fresh = createBattleState(player, enemy);
    const planted: BattleState = { ...fresh, player: { ...fresh.player, seededBy: { side: 'enemy', slot: 0 } } };

    const swapped = replacePlayerPokemon(planted, armed(CHARMANDER, 20)).state;
    expect(swapped.player.seededBy).toBeNull();
  });

  it('feeds nobody once the seeder’s place is empty, and the next trainer Pokemon arrives unseeded', () => {
    // The player's seeded Pidgey stands against a trainer whose seeding Pokemon
    // goes down this turn: nothing is drained into an empty place.
    const trainer = {
      id: 'test',
      name: 'TEST',
      defeatText: '',
      party: [armed(BULBASAUR, 2, LEECH_SEED), armed(getSpeciesById('rattata')!, 2)],
    };
    const fresh = createTrainerBattleState(armed(PIDGEY, 40, TACKLE), trainer);
    const planted: BattleState = { ...fresh, player: { ...fresh.player, seededBy: { side: 'enemy', slot: 0 } } };

    const result = resolveTurn(planted, 0, middling);
    expect(types(result.events)).toContain('fainted');
    expect(types(result.events)).not.toContain('seed-sapped');
    expect(result.state.enemy.seededBy).toBeNull();
  });
});
