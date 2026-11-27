import { describe, expect, it } from 'vitest';
import { Pokemon, getSpeciesById } from '../pokemon';
import { Stash } from '../stash';
import { answersFind, applyPickerFind, findWords, kindIfNicknamed, pickerEntries, pickerOrder, pickerRowAttributes } from './boxPicker';

const pokemon = (species: string, level: number): Pokemon => new Pokemon(getSpeciesById(species)!, level);

/** A vault of three, kept in this order: a Rattata, a fainted Pidgey and a Mankey. */
function twoBoxes(): Stash {
  const stash = new Stash();
  stash.addPokemon(pokemon('rattata', 8), 'rattata-1');
  const pidgey = pokemon('pidgey', 20);
  pidgey.currentHp = 0;
  stash.addPokemon(pidgey, 'pidgey-1');
  stash.addPokemon(pokemon('mankey', 12), 'mankey-1');
  return stash;
}

describe('the one picker from THE CHEST', () => {
  it('lists every Pokémon kept, in the order kept', () => {
    const entries = pickerEntries(twoBoxes());
    expect(entries.map((entry) => [entry.id, entry.kept])).toEqual([
      ['rattata-1', 0],
      ['pidgey-1', 1],
      ['mankey-1', 2],
    ]);
  });

  it('puts the best fits first, then the highest level, with the kept order the last word', () => {
    const entries = pickerEntries(twoBoxes());
    expect(pickerOrder(entries).map((entry) => entry.id)).toEqual(['mankey-1', 'rattata-1', 'pidgey-1']);
    const onlyRattata = pickerOrder(entries, (entry) => (entry.pokemon.base.id === 'rattata' ? 2 : 1));
    expect(onlyRattata.map((entry) => entry.id)).toEqual(['rattata-1', 'pidgey-1', 'mankey-1']);
    // Equal in everything: the order kept, every time.
    const same = pickerOrder(entries, () => 1).map((entry) => entry.id);
    expect(pickerOrder(entries, () => 1).map((entry) => entry.id)).toEqual(same);
  });

  it('finds by name, kind or gear, every word beginning a word of the row', () => {
    const [rattata, , mankey] = pickerEntries(twoBoxes());
    expect(answersFind(findWords(rattata), 'rat')).toBe(true);
    expect(answersFind(findWords(mankey), 'rat')).toBe(false);
    expect(answersFind(findWords(mankey), 'mank')).toBe(true);
    expect(answersFind(findWords(mankey), '')).toBe(true);
    expect(answersFind(findWords(mankey), 'ank')).toBe(false);
  });

  // The suite runs without a DOM; the browser driver (`tools/playtest/teamAnywhere.mjs`) plays this half.
  it.skipIf(typeof document === 'undefined')('narrows a list in place, taking a heading with nothing left under it', () => {
    const entries = pickerEntries(twoBoxes());
    const root = document.createElement('div');
    root.innerHTML = `<h3 class="px-subheading">One</h3>${entries
      .slice(0, 2)
      .map((entry) => `<button ${pickerRowAttributes(entry)}></button>`)
      .join('')}<h3 class="px-subheading">Two</h3><button ${pickerRowAttributes(entries[2])}></button>`;
    applyPickerFind(root, 'mank');
    const shown = [...root.querySelectorAll<HTMLElement>('button')].filter((row) => !row.hidden);
    expect(shown).toHaveLength(1);
    const headings = [...root.querySelectorAll<HTMLElement>('.px-subheading')].map((heading) => heading.hidden);
    expect(headings).toEqual([true, false]);
    applyPickerFind(root, '');
    expect([...root.querySelectorAll<HTMLElement>('[hidden]')]).toHaveLength(0);
  });
});

describe("a picker row's kind", () => {
  // Break-it test, 23 Nov 2026: 'PIDGEY / Lv 6 · PIDGEY · Box 1' in THE BATTLE ARENA.
  it('is said only under a nickname', () => {
    const pidgey = new Pokemon(getSpeciesById('pidgey')!, 6);
    expect(kindIfNicknamed(pidgey)).toBe('');
    pidgey.giveNickname('Zoe');
    expect(kindIfNicknamed(pidgey)).toBe('PIDGEY');
  });
});
