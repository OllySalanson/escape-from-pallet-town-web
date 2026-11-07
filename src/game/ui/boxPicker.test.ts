import { describe, expect, it } from 'vitest';
import { Pokemon, getSpeciesById } from '../pokemon';
import { Stash } from '../stash';
import { answersFind, applyPickerFind, findWords, pickerEntries, pickerOrder, pickerRowAttributes } from './boxPicker';

const pokemon = (species: string, level: number): Pokemon => new Pokemon(getSpeciesById(species)!, level);

/** A vault of two boxes: a Rattata and a fainted Pidgey in the first, a Mankey in the second. */
function twoBoxes(): Stash {
  const stash = new Stash();
  stash.addPokemon(pokemon('rattata', 8), 'rattata-1');
  const pidgey = pokemon('pidgey', 20);
  pidgey.currentHp = 0;
  stash.addPokemon(pidgey, 'pidgey-1');
  stash.addPokemon(pokemon('mankey', 12), 'mankey-1');
  const second = stash.addBox();
  stash.movePokemon('mankey-1', second);
  return stash;
}

describe('the one picker from your boxes', () => {
  it('lists every box, each Pokémon under the name of the box it is kept in', () => {
    const entries = pickerEntries(twoBoxes());
    expect(entries.map((entry) => [entry.id, entry.box])).toEqual([
      ['rattata-1', 'Box 1'],
      ['pidgey-1', 'Box 1'],
      ['mankey-1', 'Box 2'],
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

  it('finds by name, kind, gear or box, every word beginning a word of the row', () => {
    const [rattata, , mankey] = pickerEntries(twoBoxes());
    expect(answersFind(findWords(rattata), 'rat')).toBe(true);
    expect(answersFind(findWords(rattata), 'box 1')).toBe(true);
    expect(answersFind(findWords(mankey), 'box 1')).toBe(false);
    expect(answersFind(findWords(mankey), 'box 2')).toBe(true);
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
