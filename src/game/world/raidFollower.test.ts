import { describe, expect, it } from 'vitest';
import { BULBASAUR, CHARMANDER, IVYSAUR, PIDGEY, Pokemon } from '../pokemon';
import { raidFollower, sameFollower } from './raidFollower';

const fainted = (pokemon: Pokemon): Pokemon => {
  pokemon.takeDamage(pokemon.maxHp);
  return pokemon;
};

describe('who follows the player on a raid', () => {
  it('is the lead, drawn as its own species', () => {
    const lead = new Pokemon(CHARMANDER, 6);
    expect(raidFollower({ party: [lead, new Pokemon(BULBASAUR, 5)] })).toEqual({
      pokemon: lead,
      species: 'charmander',
    });
  });

  it('passes over a fainted Pokemon to the next one standing, as a battle sends it out', () => {
    const next = new Pokemon(BULBASAUR, 5);
    expect(raidFollower({ party: [fainted(new Pokemon(CHARMANDER, 6)), next] })?.pokemon).toBe(next);
  });

  it('falls back on the partner when the lead has nobody to draw it', () => {
    const partner = new Pokemon(BULBASAUR, 5);
    expect(raidFollower({ party: [new Pokemon(PIDGEY, 7), partner], partner })?.pokemon).toBe(partner);
  });

  it('walks nobody the lead cannot be, and no partner left at home or fainted', () => {
    const lead = new Pokemon(PIDGEY, 7);
    const partner = new Pokemon(BULBASAUR, 5);
    expect(raidFollower({ party: [lead] })).toBeNull();
    expect(raidFollower({ party: [lead], partner })).toBeNull();
    expect(raidFollower({ party: [lead, fainted(partner)], partner })).toBeNull();
  });

  it('is not the next starter-line Pokemon down the party: the lead or the partner, nobody else', () => {
    const lookalike = new Pokemon(BULBASAUR, 5);
    expect(raidFollower({ party: [new Pokemon(PIDGEY, 7), lookalike] })).toBeNull();
  });

  it('counts an evolution as a different figure of the same Pokemon', () => {
    const partner = new Pokemon(BULBASAUR, 16);
    const before = raidFollower({ party: [partner] });
    partner.evolveInto(IVYSAUR);
    const after = raidFollower({ party: [partner] });
    expect(after?.species).toBe('ivysaur');
    expect(sameFollower(before, after)).toBe(false);
    expect(sameFollower(after, raidFollower({ party: [partner] }))).toBe(true);
  });
});
