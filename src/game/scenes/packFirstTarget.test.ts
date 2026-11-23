import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: { Scene: class {} } }));
vi.mock('../audio/AudioManager', () => ({
  audioManager: new Proxy({}, { get: () => vi.fn(() => Promise.resolve()) }),
}));

import { getItemById } from '../items';
import { getSpeciesById, Pokemon } from '../pokemon';
import { PrimaryStatus } from '../pokemon/battle/status';
import { firstTargetFor } from './BagScene';

const mon = (species: string, level: number, hp?: number): Pokemon => {
  const pokemon = new Pokemon(getSpeciesById(species)!, level);
  if (hp !== undefined) {
    pokemon.currentHp = hp;
  }
  return pokemon;
};

/**
 * The overnight retest's key masher (23 Nov 2026): Oak said "give MEOWTH a
 * POTION", and two presses of SPACE spent it on the lead, a Charmander 4 HP
 * down, because the recipient list always opened on the lead.
 */
describe('who the recipient list opens on', () => {
  it('opens a Potion on whoever is most hurt, not the lead', () => {
    const lead = mon('charmander', 9);
    lead.currentHp = lead.maxHp - 4;
    const meowth = mon('meowth', 4, 3);
    expect(firstTargetFor([lead, meowth], getItemById('potion')!)).toBe(1);
  });

  it('passes over a fainted Pokémon, which medicine cannot reach', () => {
    const fainted = mon('pidgey', 5, 0);
    const hurt = mon('rattata', 5, 5);
    expect(firstTargetFor([fainted, hurt], getItemById('potion')!)).toBe(1);
  });

  it('opens a cure on whoever has that condition', () => {
    const fine = mon('pidgey', 5);
    const poisoned = mon('rattata', 5);
    poisoned.primaryStatus = PrimaryStatus.Poison;
    expect(firstTargetFor([fine, poisoned], getItemById('antidote')!)).toBe(1);
  });

  it('leaves the list where it starts when the item would help nobody', () => {
    expect(firstTargetFor([mon('pidgey', 5), mon('rattata', 5)], getItemById('potion')!)).toBeUndefined();
  });
});
