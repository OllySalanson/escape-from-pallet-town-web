import { describe, expect, it } from 'vitest';
import { Pokemon, getSpeciesById } from '../pokemon';
import { Stash } from '../stash';
import { pickerEntries } from './boxPicker';
import { teamBody, teamRows } from './teamView';

const stashOf = (...members: readonly (readonly [string, number])[]): Stash => {
  const stash = new Stash();
  members.forEach(([species, level], index) => stash.addPokemon(new Pokemon(getSpeciesById(species)!, level), `${species}-${index}`));
  return stash;
};

describe('YOUR TEAM', () => {
  it('lists the team in the order it goes, then every box best fits first', () => {
    const stash = stashOf(['rattata', 5], ['pidgey', 9], ['mankey', 7]);
    const second = stash.addBox();
    stash.movePokemon('mankey-2', second);
    const rows = teamRows({ entries: pickerEntries(stash), team: ['pidgey-1'] });
    expect(rows.team.map((entry) => entry.id)).toEqual(['pidgey-1']);
    expect(rows.boxes.map((entry) => [entry.id, entry.box])).toEqual([
      ['mankey-2', 'Box 2'],
      ['rattata-0', 'Box 1'],
    ]);
  });

  it('names the box on every row, the lead, and who cannot go', () => {
    const stash = stashOf(['rattata', 5], ['pidgey', 9]);
    stash.listPokemon()[1].pokemon.currentHp = 0;
    const html = teamBody({ entries: pickerEntries(stash), team: ['rattata-0'], partnerId: 'rattata-0' });
    expect(html).toContain('Next raid');
    expect(html).toContain('In your boxes');
    expect(html).toContain('Lead');
    expect(html).toContain('Box 1');
    expect(html).toContain('partner');
    expect(html).toContain('Fainted');
    expect(html).toContain('data-picker-find');
    expect(html).toContain('data-member="pidgey-1"');
  });

  it('says the team is full rather than taking a seventh', () => {
    const members = ['rattata', 'pidgey', 'mankey', 'krabby', 'psyduck', 'oddish', 'diglett'] as const;
    const stash = stashOf(...members.map((species) => [species, 5] as const));
    const html = teamBody({ entries: pickerEntries(stash), team: stash.listPokemon().slice(0, 6).map((stored) => stored.id) });
    expect(html).toContain('6 of 6');
    expect(html).toMatch(/data-member="diglett-6"[^>]*aria-disabled="true"/);
    expect(html).toContain('Full');
  });
});
