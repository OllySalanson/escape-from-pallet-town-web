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
});
