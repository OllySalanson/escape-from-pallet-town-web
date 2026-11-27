import { describe, expect, it } from 'vitest';
import { Pokemon } from '../pokemon/Pokemon';
import { getSpeciesById } from '../pokemon/species';
import { createStartingStash, getStarterSpecies, Stash, STARTER_SPECIES } from '../stash';
import { HOUSE_JUMPER, HOUSE_PICKER } from './houseLoans';
import { jumpTypeOf } from './pokemonJump';
import { berryLineup, courseLineup, courseTeam, jumpLineup, jumpTeam, lineup, stepAlong, type Contender } from './whoPlays';

const mon = (species: string, level: number): Pokemon => {
  const base = getSpeciesById(species);
  if (!base) throw new Error(`no ${species}`);
  return new Pokemon(base, level);
};

/** Sam, just home from the first raid: a level-5 CHARMANDER and nothing else (`after-first-raid.json`). */
function samsVault(): Stash {
  return createStartingStash(getStarterSpecies('charmander'));
}

/** Jo, ten raids in: the partner evolved to IVYSAUR, and a DIGLETT (`midgame-rich.json`). */
function josVault(): Stash {
  const stash = new Stash();
  stash.addPokemon(mon('ivysaur', 17), 'bulbasaur-1');
  stash.addPokemon(mon('diglett', 3), 'diglett-1');
  stash.adoptPartner('bulbasaur-1');
  return stash;
}

const ids = (line: readonly Contender[]): string[] => line.map((contender) => contender.id);

describe('who plays a harbour game, decided before anybody is asked', () => {
  it('puts the partner first when it can play, the loan first when it cannot, and the loan last otherwise', () => {
    const a = { id: 'a' } as Contender;
    const b = { id: 'b' } as Contender;
    const loan = { id: 'house:x', loan: true } as Contender;
    expect(ids(lineup([a, b], 'b', loan))).toEqual(['b', 'a', 'house:x']);
    expect(ids(lineup([a, b], 'gone', loan))).toEqual(['house:x', 'a', 'b']);
    expect(ids(lineup([a, b], null))).toEqual(['a', 'b']);
  });

  it('steps round the line from either end', () => {
    expect(stepAlong(3, 2, 1)).toBe(0);
    expect(stepAlong(3, 0, -1)).toBe(2);
    expect(stepAlong(1, 0, 1)).toBe(0);
    expect(stepAlong(0, 0, 1)).toBe(0);
  });

  it('starts every fresh save on its partner wherever the partner can play, and on the house loan where it cannot', () => {
    for (const starter of STARTER_SPECIES) {
      const stash = createStartingStash(getStarterSpecies(starter.id));
      const partner = stash.partnerId();
      expect(partner).not.toBeNull();
      expect(jumpLineup(stash)[0]?.id).toBe(jumpTypeOf(starter.id) ? partner : HOUSE_JUMPER.id);
      expect(berryLineup(stash)[0]?.id).toBe(HOUSE_PICKER.id);
      expect(courseLineup(stash)[0]?.id).toBe(partner);
    }
  });

  it("starts Sam's CHARMANDER at the vine, with the house's PIKACHU one press away", () => {
    const line = jumpLineup(samsVault());
    expect(ids(line)).toEqual(['charmander-1', HOUSE_JUMPER.id]);
    expect(ids(jumpTeam(line[0], line))).toEqual(['charmander-1', HOUSE_JUMPER.id]);
    expect(ids(berryLineup(samsVault()))).toEqual([HOUSE_PICKER.id]);
    expect(courseLineup(samsVault())[0]?.id).toBe('charmander-1');
  });

  it("starts Jo, whose IVYSAUR cannot jump, on the house's PIKACHU at once, and offers nobody who cannot play", () => {
    const line = jumpLineup(josVault());
    expect(ids(line)).toEqual([HOUSE_JUMPER.id]);
    expect(ids(berryLineup(josVault()))).toEqual([HOUSE_PICKER.id]);
    // Everybody can go round the course - with no field moves it is the long way - and the partner leads.
    expect(ids(courseLineup(josVault()))).toEqual(['bulbasaur-1', 'diglett-1']);
  });

  it('fills a jumping team with the same kind of jumper first, then the quickest, the house last', () => {
    const stash = new Stash();
    stash.addPokemon(mon('bulbasaur', 10), 'bulbasaur-1');
    stash.addPokemon(mon('rattata', 10), 'rattata-1');
    stash.addPokemon(mon('oddish', 10), 'oddish-1');
    stash.addPokemon(mon('charmander', 10), 'charmander-1');
    stash.adoptPartner('bulbasaur-1');
    const line = jumpLineup(stash);
    expect(line[0]?.id).toBe('bulbasaur-1');
    const team = jumpTeam(line[0], line);
    expect(team).toHaveLength(3);
    expect(team[0]?.id).toBe('bulbasaur-1');
    // Never the loan while three of the player's own can jump.
    expect(team.some((member) => member.loan)).toBe(false);
    const kinds = team.map((member) => jumpTypeOf(member.species));
    const sameAsLead = kinds.filter((kind) => kind === kinds[0]).length;
    const others = line.filter((contender) => !contender.loan && jumpTypeOf(contender.species) === kinds[0]).length;
    expect(sameAsLead).toBe(Math.min(3, others));
  });

  it('goes round the course with whoever adds the most field moves to the lead, and nobody who adds none', () => {
    const line = courseLineup(josVault());
    const team = courseTeam(line[0], line);
    expect(team[0]?.id).toBe('bulbasaur-1');
    expect(new Set(ids(team)).size).toBe(team.length);
    expect(team.length).toBeLessThanOrEqual(3);
  });
});
