import { describe, expect, it } from 'vitest';
import { Pokemon, getSpeciesById } from '../pokemon';
import { Stash } from '../stash';
import { pickerEntries } from './boxPicker';
import { CHEST_COLUMNS, CHEST_POKEMON_KEYS, chestPokemonBody, chestTabs, whereItIs, type ChestPokemonState } from './chestPokemonView';

const stashOf = (...members: readonly (readonly [string, number])[]): Stash => {
  const stash = new Stash();
  members.forEach(([species, level], index) => stash.addPokemon(new Pokemon(getSpeciesById(species)!, level), `${species}-${index}`));
  return stash;
};

const stateOf = (stash: Stash, rest: Partial<ChestPokemonState> = {}): ChestPokemonState => ({
  entries: pickerEntries(stash),
  team: [],
  garden: [],
  away: new Set(),
  ...rest,
});

/** The ids of the grid's tiles, in the order drawn. */
const gridIds = (html: string): readonly string[] => {
  const grid = html.slice(html.indexOf('chest-mon-grid'), html.indexOf('chest-team'));
  return [...grid.matchAll(/class="chest-mon[^"]*" data-mon="([^"]+)"/g)].map((match) => match[1]);
};

describe("THE CHEST's POKéMON tab", () => {
  it('stands every Pokémon in one grid in the order kept, box after box, and names no box', () => {
    const stash = stashOf(['rattata', 5], ['pidgey', 9], ['mankey', 7]);
    const second = stash.addBox();
    stash.movePokemon('rattata-0', second);
    const html = chestPokemonBody(stateOf(stash));
    expect(gridIds(html)).toEqual(['pidgey-1', 'mankey-2', 'rattata-0']);
    expect(html).not.toMatch(/Box [0-9]/);
    expect(html).toContain('3 kept');
  });

  it('draws each one as its own picture, with its level, its health and its marks', () => {
    const stash = stashOf(['pikachu', 14], ['pidgey', 9], ['oddish', 7]);
    stash.listPokemon()[0].pokemon.heldItemId = 'oran-berry';
    const html = chestPokemonBody(stateOf(stash, { team: ['pikachu-0'], garden: ['oddish-2'], partnerId: 'pikachu-0' }));
    expect(html).toMatch(/data-mon="pikachu-0"[^>]*>.*?pokemon\/front\/25\.png/);
    expect(html).toMatch(/data-mon="pikachu-0"[^>]*>.*?Lv14/);
    expect(html).toMatch(/class="chest-mon is-team" data-mon="pikachu-0"[^>]*>.*?aria-label="Partner".*?oran-berry/);
    expect(html).toMatch(/class="chest-mon is-garden" data-mon="oddish-2"[^>]*>.*?chest-mark is-garden/);
  });

  it('fills the grid out with empty places, a row at a time and four rows at least', () => {
    const few = chestPokemonBody(stateOf(stashOf(['rattata', 5])));
    expect(few.match(/chest-mon-gap/g)).toHaveLength(CHEST_COLUMNS * 4 - 1);
    const members = Array.from({ length: 18 }, (_one, index) => ['rattata', index + 2] as const);
    const many = chestPokemonBody(stateOf(stashOf(...members)));
    expect((many.match(/chest-mon-gap/g) ?? []).length).toBe(2);
  });

  it('stands the next raid and the garden as six places each, a gap where nobody is', () => {
    const stash = stashOf(['pikachu', 14], ['pidgey', 9], ['oddish', 7]);
    const html = chestPokemonBody(stateOf(stash, { team: ['pidgey-1', 'pikachu-0'], garden: ['oddish-2'] }));
    const team = html.slice(html.indexOf('data-drop="team"'), html.indexOf('chest-cards'));
    expect([...team.matchAll(/data-place="team" data-mon="([^"]+)"/g)].map((match) => match[1])).toEqual(['pidgey-1', 'pikachu-0']);
    expect(team.match(/chest-slot is-free/g)).toHaveLength(4);
    expect(team).toMatch(/chest-slot is-lead" data-place="team" data-mon="pidgey-1"/);
    expect(html).toContain('Team 2 of 6');
    expect(html).toContain('1 of 6');
  });

  it("shows one card at a time, with the keys that act on that Pokémon and where it is", () => {
    const stash = stashOf(['pikachu', 14], ['pidgey', 9]);
    const state = stateOf(stash, { team: ['pikachu-0', 'pidgey-1'] });
    const html = chestPokemonBody(state);
    expect(html.match(/data-shown-by="[^"]+" hidden/g)).toHaveLength(2);
    expect(html).toMatch(/data-shown-by="pidgey-1".*?data-key="lead"/);
    // The lead is not offered the lead again.
    expect(html.slice(html.indexOf('data-shown-by="pikachu-0"'), html.indexOf('data-shown-by="pidgey-1"'))).not.toContain('data-key="lead"');
    expect(whereItIs(state, 'pikachu-0')).toBe('Leads the next raid');
    expect(whereItIs(state, 'pidgey-1')).toBe('Next raid');
  });

  it('greys out and offers nothing for a Pokémon out on a raid in another window', () => {
    const stash = stashOf(['pikachu', 14], ['pidgey', 9]);
    const state = stateOf(stash, { away: new Set(['pidgey-1']) });
    const html = chestPokemonBody(state);
    expect(html).toMatch(/class="chest-mon is-away" data-mon="pidgey-1"/);
    expect(html.slice(html.indexOf('data-shown-by="pidgey-1"'))).not.toContain('data-key=');
    expect(whereItIs(state, 'pidgey-1')).toBe('Out on a raid');
  });

  it('carries its two tabs in the title, the one you are on lit, each with its key', () => {
    expect(chestTabs('pokemon')).toMatch(/class="chest-tab" data-chest-tab="things"[^>]*>.*?>B<\/span>Things/);
    expect(chestTabs('pokemon')).toMatch(/class="chest-tab is-here" data-chest-tab="pokemon"[^>]*aria-current="page"/);
    expect(chestTabs('things')).toMatch(/class="chest-tab is-here" data-chest-tab="things"/);
    expect(CHEST_POKEMON_KEYS).toContain('G garden');
    expect(CHEST_POKEMON_KEYS).toContain('B things');
  });
});
