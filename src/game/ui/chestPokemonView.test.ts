import { describe, expect, it } from 'vitest';
import { Pokemon, getSpeciesById } from '../pokemon';
import { Stash } from '../stash';
import { pickerEntries } from './boxPicker';
import { getItemById } from '../items';
import { CHEST_COLUMNS, CHEST_POKEMON_KEYS, chestAsk, chestGifts, chestKept, chestPokemonBody, giftAnswer, chestTabs, whereItIs, type ChestPokemonState } from './chestPokemonView';

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
    expect(chestKept(3)).toContain('3 kept');
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

  it('fills the grid out with empty places, a row at a time and three rows at least', () => {
    const few = chestPokemonBody(stateOf(stashOf(['rattata', 5])));
    expect(few.match(/chest-mon-gap/g)).toHaveLength(CHEST_COLUMNS * 3 - 1);
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

describe('giving a thing to a Pokémon from THE CHEST', () => {
  const item = (id: string) => getItemById(id)!;
  const mon = (species: string, level = 10) => new Pokemon(getSpeciesById(species)!, level);

  it('offers things to hold, then stones, then discs - only those, and only what is spare', () => {
    const items = ['potion', 'tm40-aerial-ace', 'thunder-stone', 'oran-berry', 'poke-ball', 'leftovers'].map(item);
    const spare: Record<string, number> = { potion: 3, 'tm40-aerial-ace': 1, 'thunder-stone': 1, 'oran-berry': 2, 'poke-ball': 5, leftovers: 0 };
    expect(chestGifts(items, (id) => spare[id] ?? 0).map((gift) => [gift.item.id, gift.kind, gift.count])).toEqual([
      ['oran-berry', 'hold', 2],
      ['thunder-stone', 'stone', 1],
      ['tm40-aerial-ace', 'disc', 1],
    ]);
  });

  it('asks FireRed\'s question when it can go, and says why when it cannot', () => {
    expect(giftAnswer(item('oran-berry'), mon('pikachu'), false)).toEqual({ ok: true, question: 'Give the ORAN BERRY to PIKACHU?' });
    const holding = mon('pikachu');
    holding.heldItemId = 'oran-berry';
    expect(giftAnswer(item('oran-berry'), holding, false)).toEqual({ ok: false, why: 'PIKACHU is holding an ORAN BERRY already.' });
    expect(giftAnswer(item('thunder-stone'), mon('eevee'), false)).toEqual({ ok: true, question: 'Use the THUNDER STONE on EEVEE?' });
    expect(giftAnswer(item('thunder-stone'), mon('charmander'), false)).toEqual({ ok: false, why: "It won't have any effect." });
    // FireRed's own learners: Pidgey reads Aerial Ace, Pikachu cannot.
    expect(giftAnswer(item('tm40-aerial-ace'), mon('pidgey'), false)).toEqual({ ok: true, question: 'Teach AERIAL ACE to PIDGEY?' });
    expect(giftAnswer(item('tm40-aerial-ace'), mon('pikachu'), false)).toEqual({ ok: false, why: "PIKACHU can't learn AERIAL ACE." });
    expect(giftAnswer(item('oran-berry'), mon('pikachu'), true).ok).toBe(false);
  });

  it('draws the question as the thing, an arrow, the Pokémon, and YES and NO', () => {
    const html = chestAsk(item('oran-berry'), mon('pikachu'), 'Give the ORAN BERRY to PIKACHU?');
    expect(html).toMatch(/data-ask .*oran-berry.*chest-ask-arrow.*front\/25\.png.*Give the ORAN BERRY to PIKACHU\?.*data-ask-yes>Yes.*data-ask-no>No/);
  });

  it('stands TO GIVE beside the card, and the card offers what it holds back', () => {
    const stash = stashOf(['pikachu', 14]);
    stash.listPokemon()[0].pokemon.heldItemId = 'oran-berry';
    const html = chestPokemonBody(stateOf(stash, { gifts: chestGifts([item('sitrus-berry')], () => 1) }));
    expect(html).toMatch(/chest-give.*data-gift="sitrus-berry"/);
    expect(html).toMatch(/data-held="pikachu-0" data-drop="held"/);
    expect(html).toMatch(/data-key="take"[^>]*>.*Take Oran Berry/);
  });
});
