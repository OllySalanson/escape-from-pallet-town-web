import { describe, expect, it } from 'vitest';
import { createRunTrainerEncounters } from './trainers';
import { BULBASAUR, CHARMANDER, SQUIRTLE } from '../pokemon/species';
import { PokemonType } from '../pokemon/PokemonType';
import { getTypeEffectiveness } from '../pokemon/battle/typeChart';

const STARTER_ATTACK_TYPES = [
  [BULBASAUR, PokemonType.Grass],
  [CHARMANDER, PokemonType.Fire],
  [SQUIRTLE, PokemonType.Water],
] as const;

const bestEffectivenessAgainst = (
  attackType: PokemonType,
  party: readonly { readonly base: { readonly primaryType: PokemonType; readonly secondaryType?: PokemonType } }[],
): number =>
  Math.max(
    ...party.map((member) =>
      getTypeEffectiveness(attackType, [
        member.base.primaryType,
        ...(member.base.secondaryType ? [member.base.secondaryType] : []),
      ]),
    ),
  );

describe('authored trainers', () => {
  it('gives the first trainer a target for every starter type', () => {
    const lee = createRunTrainerEncounters().find(
      (encounter) => encounter.trainer.id === 'grass-scout-lee',
    );

    expect(lee).toBeDefined();
    // A Bulbasaur here left the Grass starter with nothing its own move beat,
    // which made the first authored fight a starter lottery.
    for (const [starter, attackType] of STARTER_ATTACK_TYPES) {
      expect(
        bestEffectivenessAgainst(attackType, lee!.trainer.party),
        `${starter.name} has no effective target on SCOUT LEE`,
      ).toBeGreaterThanOrEqual(1);
    }
    expect(bestEffectivenessAgainst(PokemonType.Grass, lee!.trainer.party)).toBeGreaterThan(1);
  });

  it('creates independent Pokemon per raid so battle damage never leaks', () => {
    const first = createRunTrainerEncounters();
    const second = createRunTrainerEncounters();

    expect(first[0].trainer.party[0]).not.toBe(second[0].trainer.party[0]);
  });

  /**
   * Playtest 3, D5: RAIDER MAYA led the same Pikachu and Pidgey on the
   * Floodplain checkpoint and on Route 1. Beaten on one map and met again on
   * the next, a trainer who is two people reads as a bug.
   */
  it('never puts one trainer in two places', () => {
    const encounters = createRunTrainerEncounters();
    const names = encounters.map(({ trainer }) => trainer.name);
    const ids = encounters.map(({ trainer }) => trainer.id);
    const teams = encounters.map(({ trainer }) =>
      trainer.party.map((member) => `${member.base.id}:${member.level}`).join(','));

    expect(new Set(names).size).toBe(names.length);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(teams).size).toBe(teams.length);
  });
});

describe('every authored trainer Pokemon', () => {
  /**
   * Playtest finding B6: two bosses' Machop knew only Leer, so every turn the
   * boss spent on it was free. A wild table already may not name a species
   * with nothing to throw (`districtEncounters.test.ts`); a trainer's party is
   * held to the same rule here.
   */
  it('knows a move that does damage', () => {
    const harmless = createRunTrainerEncounters().flatMap(({ trainer }) =>
      trainer.party
        .filter((pokemon) => !pokemon.moves.some((move) => move.base.category !== 'Status'))
        .map((pokemon) => `${trainer.name}: ${pokemon.base.name} ${pokemon.level}`),
    );
    expect(harmless).toEqual([]);
  });
});
