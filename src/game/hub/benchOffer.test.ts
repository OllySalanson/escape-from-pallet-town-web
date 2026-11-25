import { describe, expect, it } from 'vitest';
import { getSpeciesById, Pokemon } from '../pokemon';
import { benchOffer, benchOfferQuestion } from './benchOffer';
import { FIRST_WORDS } from './firstWords';

const stashed = (id: string, species: string, level: number, fainted = false) => {
  const pokemon = new Pokemon(getSpeciesById(species)!, level);
  if (fainted) {
    pokemon.takeDamage(pokemon.maxHp);
  }
  return { id, pokemon };
};
const BEEN_OUT = { raidRecord: { 'greystone-vale': { deployed: 1 } } };

/** A catch carried home waits off the BENCH: the critic's problems 6 and 26. */
describe('the catch waiting at base, offered at the rail', () => {
  const starter = stashed('starter', 'charmander', 6);
  const pidgey = stashed('pidgey-1', 'pidgey', 3);

  it('is offered once a raid has been gone on, to a lone Pokemon with a fit one at base', () => {
    expect(benchOffer(BEEN_OUT, [starter], [starter, pidgey])).toEqual({ id: 'pidgey-1', name: pidgey.pokemon.name });
    expect(benchOfferQuestion({ id: 'pidgey-1', name: 'Pidgey' })).toBe('Take PIDGEY along too?');
    // The reason comes first, in the hall's own voice.
    expect(FIRST_WORDS.benchCatch.lines[0]).toContain("one faint won't end the raid");
  });

  it('is not offered before the first raid, once heard, to a team, or for a fainted one', () => {
    expect(benchOffer({}, [starter], [starter, pidgey])).toBeUndefined();
    expect(benchOffer({ ...BEEN_OUT, firstWordsHeard: ['benchCatch'] }, [starter], [starter, pidgey])).toBeUndefined();
    expect(benchOffer(BEEN_OUT, [starter, pidgey], [starter, pidgey])).toBeUndefined();
    expect(benchOffer(BEEN_OUT, [starter], [starter, stashed('pidgey-2', 'pidgey', 3, true)])).toBeUndefined();
    expect(benchOffer(BEEN_OUT, [starter], [starter])).toBeUndefined();
  });

  it('offers the strongest waiting', () => {
    const rattata = stashed('rattata-1', 'rattata', 5);
    expect(benchOffer(BEEN_OUT, [starter], [starter, pidgey, rattata])?.id).toBe('rattata-1');
  });
});
