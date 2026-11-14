import { describe, expect, it } from 'vitest';
import { BULBASAUR, BUTTERFREE, CHARMANDER, IVYSAUR, PIDGEY, Pokemon, getSpeciesById } from '../pokemon';
import { raidFollower, sameFollower, shinyFollowerSheets } from './raidFollower';

/** A Pokemon of a kind HeartGold drew no walking art for: none of Kanto's 151 is one. */
const unwalked = (level: number): Pokemon => new Pokemon({ ...PIDGEY, id: 'unown' }, level);

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

  it('is the lead whatever its kind, so a find answering the one at your heel answers the one you can see', () => {
    const lead = new Pokemon(BUTTERFREE, 28);
    lead.shiny = true;
    const partner = new Pokemon(BULBASAUR, 5);
    expect(raidFollower({ party: [lead, partner], partner })).toEqual({ pokemon: lead, species: 'butterfree' });
    expect(raidFollower({ party: [new Pokemon(PIDGEY, 7), partner], partner })?.species).toBe('pidgey');
  });

  it('falls back on the partner when the lead has nobody to draw it', () => {
    const partner = new Pokemon(BULBASAUR, 5);
    expect(raidFollower({ party: [unwalked(7), partner], partner })?.pokemon).toBe(partner);
  });

  it('walks nobody the lead cannot be, and no partner left at home or fainted', () => {
    const lead = unwalked(7);
    const partner = new Pokemon(BULBASAUR, 5);
    expect(raidFollower({ party: [lead] })).toBeNull();
    expect(raidFollower({ party: [lead], partner })).toBeNull();
    expect(raidFollower({ party: [lead, fainted(partner)], partner })).toBeNull();
  });

  it('is not the next Pokemon down the party: the lead or the partner, nobody else', () => {
    const lookalike = new Pokemon(BULBASAUR, 5);
    expect(raidFollower({ party: [unwalked(7), lookalike] })).toBeNull();
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

describe('the shiny walking sheets a raid fetches', () => {
  it("fetches a shiny one's kind and what it can evolve into, and nothing for an ordinary party", () => {
    const shiny = new Pokemon(getSpeciesById('caterpie')!, 5);
    shiny.shiny = true;
    expect(shinyFollowerSheets([shiny, new Pokemon(CHARMANDER, 5)])).toEqual([
      { key: 'partner-shiny-caterpie', path: 'assets/followers/shiny/caterpie.png' },
      { key: 'partner-shiny-metapod', path: 'assets/followers/shiny/metapod.png' },
      { key: 'partner-shiny-butterfree', path: 'assets/followers/shiny/butterfree.png' },
    ]);
    expect(shinyFollowerSheets([new Pokemon(CHARMANDER, 5)])).toEqual([]);
  });
});
