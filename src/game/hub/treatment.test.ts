import { describe, expect, it } from 'vitest';
import { CHARMANDER, Pokemon } from '../pokemon';
import { Stash } from '../stash';
import { needsRecovery, recoveryCostMs } from './recovery';
import { FAINTED_TREATMENT_NOTE, treatmentOptions, treatWithItem } from './treatment';

function stashWith(
  damage = 8,
  items: Readonly<Record<string, number>> = { potion: 2, antidote: 1, 'poke-ball': 5 },
): { stash: Stash; pokemon: Pokemon } {
  const stash = new Stash({ items });
  const pokemon = new Pokemon(CHARMANDER, 7);
  pokemon.takeDamage(damage);
  stash.addPokemon(pokemon, 'charmander-1');
  return { stash, pokemon };
}

describe('treating a Pokemon at base with a stash item', () => {
  it('prices every medicine against this Pokemon before any of it is spent', () => {
    const { stash, pokemon } = stashWith(8);

    expect(treatmentOptions(stash, pokemon)).toEqual([
      {
        itemId: 'potion',
        displayName: 'Potion',
        held: 2,
        effect: `Restores 8 HP · ${pokemon.currentHp}/${pokemon.maxHp} → ${pokemon.maxHp}/${pokemon.maxHp}`,
        usable: true,
      },
      {
        itemId: 'antidote',
        displayName: 'Antidote',
        held: 1,
        effect: 'Nothing to cure',
        usable: false,
      },
    ]);
  });

  it('never offers a Poke Ball as a treatment, or a medicine the stash does not hold', () => {
    const { stash, pokemon } = stashWith(8, { 'poke-ball': 5, 'great-ball': 2, potion: 1 });

    expect(treatmentOptions(stash, pokemon).map((option) => option.itemId)).toEqual(['potion']);
  });

  it('spends exactly one item and only when it did something', () => {
    const { stash, pokemon } = stashWith(8);

    expect(treatWithItem(stash, 'charmander-1', 'potion')).toEqual({
      used: true,
      message: `${pokemon.base.name} recovered 8 HP! 1 Potion left at base.`,
    });
    expect(pokemon.currentHp).toBe(pokemon.maxHp);
    expect(stash.itemCount('potion')).toBe(1);

    // The second Potion would do nothing, so it is refused rather than burnt.
    expect(treatWithItem(stash, 'charmander-1', 'potion').used).toBe(false);
    expect(stash.itemCount('potion')).toBe(1);
    // Nor can a treatment invent a Pokemon, an item or a stash entry.
    expect(treatWithItem(stash, 'charmander-9', 'potion').used).toBe(false);
    expect(treatWithItem(stash, 'charmander-1', 'super-potion').used).toBe(false);
    expect(treatWithItem(stash, 'charmander-1', 'poke-ball').used).toBe(false);
    expect(stash.listItems()).toEqual({ potion: 1, antidote: 1, 'poke-ball': 5 });
    expect(stash.listPokemon()).toHaveLength(1);
  });

  it('heals only up to the damage taken, so an overheal never banks the remainder', () => {
    const { stash, pokemon } = stashWith(3);
    const missing = pokemon.maxHp - pokemon.currentHp;

    expect(treatmentOptions(stash, pokemon)[0].effect).toContain(`Restores ${missing} HP`);
    expect(treatWithItem(stash, 'charmander-1', 'potion').used).toBe(true);
    expect(pokemon.currentHp).toBe(pokemon.maxHp);
  });

  it('cures a status it matches and refuses one it does not', () => {
    const { stash, pokemon } = stashWith(0);
    pokemon.primaryStatus = 'burn';

    expect(treatWithItem(stash, 'charmander-1', 'antidote').used).toBe(false);
    expect(pokemon.primaryStatus).toBe('burn');
    expect(stash.itemCount('antidote')).toBe(1);

    pokemon.primaryStatus = 'poison';
    expect(treatmentOptions(stash, pokemon)).toContainEqual(
      expect.objectContaining({ itemId: 'antidote', effect: 'Cures poison', usable: true }),
    );
    expect(treatWithItem(stash, 'charmander-1', 'antidote')).toEqual({
      used: true,
      // The last of a medicine says so, rather than reading "0 Antidotes".
      message: `${pokemon.base.name} was cured of poison! No Antidote left at base.`,
    });
    expect(pokemon.primaryStatus).toBe(null);
    expect(stash.itemCount('antidote')).toBe(0);
  });

  it('leaves reviving to the recovery bay, so a faint keeps costing what it should', () => {
    const { stash, pokemon } = stashWith(0);
    pokemon.takeDamage(pokemon.maxHp);

    expect(treatmentOptions(stash, pokemon).every((option) => !option.usable)).toBe(true);
    expect(treatWithItem(stash, 'charmander-1', 'potion')).toEqual({
      used: false,
      message: FAINTED_TREATMENT_NOTE,
    });
    expect(pokemon.isFainted).toBe(true);
    expect(stash.itemCount('potion')).toBe(2);

    // The bay is still the way back, and it still charges the revive premium.
    expect(recoveryCostMs(pokemon)).toBeGreaterThan(0);
    expect(stash.recoverPokemon('charmander-1')).toBe(true);
    expect(needsRecovery(pokemon)).toBe(false);
  });

  it('never offers a treatment to a Pokemon that does not need one', () => {
    const { stash, pokemon } = stashWith(0);

    expect(needsRecovery(pokemon)).toBe(false);
    expect(treatmentOptions(stash, pokemon).every((option) => !option.usable)).toBe(true);
    expect(treatWithItem(stash, 'charmander-1', 'potion').used).toBe(false);
    expect(stash.itemCount('potion')).toBe(2);
  });
});
