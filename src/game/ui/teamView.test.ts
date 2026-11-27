import { describe, expect, it } from 'vitest';
import { Pokemon, getSpeciesById } from '../pokemon';
import { Stash } from '../stash';
import { pickerEntries } from './boxPicker';
import { leadLine, TEAM_HINTS, teamBody, teamPill, teamRowHelp, teamRows } from './teamView';

const stashOf = (...members: readonly (readonly [string, number])[]): Stash => {
  const stash = new Stash();
  members.forEach(([species, level], index) => stash.addPokemon(new Pokemon(getSpeciesById(species)!, level), `${species}-${index}`));
  return stash;
};

describe('YOUR TEAM', () => {
  it('lists the team in the order it goes, then everybody else best fits first', () => {
    const stash = stashOf(['rattata', 5], ['pidgey', 9], ['mankey', 7]);
    const rows = teamRows({ entries: pickerEntries(stash), team: ['pidgey-1'] });
    expect(rows.team.map((entry) => entry.id)).toEqual(['pidgey-1']);
    expect(rows.boxes.map((entry) => entry.id)).toEqual(['mankey-2', 'rattata-0']);
  });

  it('names the lead, the partner, who cannot go, and where each is - never a box', () => {
    const stash = stashOf(['rattata', 5], ['pidgey', 9], ['oddish', 7]);
    stash.listPokemon()[1].pokemon.currentHp = 0;
    const html = teamBody({ entries: pickerEntries(stash), team: ['rattata-0', 'oddish-2'], partnerId: 'rattata-0' });
    expect(html).toContain('In the chest');
    expect(html).not.toMatch(/Box [0-9]/);
    expect(html).toContain('team-plate-lead">Lead');
    expect(html).toContain('aria-label="Partner"');
    expect(html).toContain('Fainted');
    expect(html).toContain('data-picker-find');
    expect(html).toContain('data-member="pidgey-1"');
    // Where each is, in its card: going on the next raid, or in the chest.
    expect(html).toMatch(/team-card-where">Next raid/);
    expect(html).toMatch(/team-card-where">In the chest/);
    // A fainted Pokémon's icon stands still.
    expect(html).toMatch(/data-member="pidgey-1"[^>]*>.*?px-mon-icon is-still/);
  });

  it('stands everyone going on the field, the lead first, and counts them in the title', () => {
    const stash = stashOf(['rattata', 5], ['pidgey', 9]);
    const state = { entries: pickerEntries(stash), team: ['rattata-0'] };
    const html = teamBody(state);
    expect(html.match(/class="team-stand[" ]/g)).toHaveLength(1);
    expect(html).toMatch(/class="team-stand" data-member="rattata-0"/);
    expect(teamPill(state)).toContain('1 OF 6');
    // Only the boxes are found in: the team is six at most and always in view.
    expect(html).not.toMatch(/class="team-stand[^"]*"[^>]*data-find/);
  });

  it('says the team is full rather than taking a seventh', () => {
    const members = ['rattata', 'pidgey', 'mankey', 'krabby', 'psyduck', 'oddish', 'diglett'] as const;
    const stash = stashOf(...members.map((species) => [species, 5] as const));
    const state = { entries: pickerEntries(stash), team: stash.listPokemon().slice(0, 6).map((stored) => stored.id) };
    const html = teamBody(state);
    expect(teamPill(state)).toContain('6 OF 6');
    expect(html).toMatch(/data-member="diglett-6"[^>]*aria-disabled="true"/);
    expect(html).toContain('The team is full (6)');
    expect(html).toContain('Team full');
  });
});

describe("YOUR TEAM's lead", () => {
  it('says L puts one of the team in front, on every slot but the lead, and on the hint bar', () => {
    const stash = stashOf(['charmander', 10], ['squirtle', 9]);
    const [first, second] = pickerEntries(stash);
    expect(teamRowHelp(first, true, true, 2)).toBe(`${first.pokemon.name} leads. ENTER leaves it at home.`);
    expect(teamRowHelp(second, true, false, 2)).toBe(`${second.pokemon.name} is going. ENTER leaves it at home, L puts it in front.`);
    expect(TEAM_HINTS).toContain('L lead');
    expect(leadLine('IVYSAUR')).toBe('IVYSAUR leads now: out first in every fight.');
  });
});
