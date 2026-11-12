import { describe, expect, it } from 'vitest';
import { getItemById, ITEMS, packContents } from '../items';
import { Pokemon, getSpeciesById } from '../pokemon';
import {
  pocketJump,
  pocketStrip,
  ableCount,
  homeUseOf,
  pocketOf,
  storedPockets,
  thingsBody,
  THINGS_POCKETS,
  whereItIsUsed,
} from './thingsView';

const item = (id: string) => getItemById(id)!;

describe('YOUR THINGS sorts storage into pockets', () => {
  it('puts every thing in the catalogue in a pocket, and says where every one is used', () => {
    for (const definition of Object.values(ITEMS)) {
      expect(THINGS_POCKETS).toContain(pocketOf(definition));
      expect(whereItIsUsed(definition).length).toBeGreaterThan(10);
    }
  });

  it('keeps discs and stones in pockets of their own, the two things used at home', () => {
    expect(pocketOf(item('tm40-aerial-ace'))).toBe('discs');
    expect(pocketOf(item('hm01-cut'))).toBe('discs');
    expect(pocketOf(item('fire-stone'))).toBe('stones');
    expect(homeUseOf(item('tm40-aerial-ace'))).toBe('teach');
    expect(homeUseOf(item('fire-stone'))).toBe('evolve');
    expect(homeUseOf(item('potion'))).toBeNull();
    expect(homeUseOf(item('money'))).toBeNull();
  });

  it('files medicine, balls, found goods and money where a player would look', () => {
    expect(pocketOf(item('potion'))).toBe('medicine');
    expect(pocketOf(item('poke-ball'))).toBe('balls');
    expect(pocketOf(item('money'))).toBe('found');
    expect(pocketOf(item('cable-coil'))).toBe('found');
  });

  it('reads the pockets in their own order, empty ones left out', () => {
    const pockets = storedPockets({ 'fire-stone': 1, potion: 3, money: 120, 'poke-ball': 0, 'no-such-thing': 4 });
    expect(pockets.map(({ pocket }) => pocket)).toEqual(['medicine', 'stones', 'found']);
  });
});

describe('a disc or a stone counts who it would do something for', () => {
  it('counts the Pokémon a stone would evolve', () => {
    const party = [new Pokemon(getSpeciesById('pikachu')!, 10), new Pokemon(getSpeciesById('rattata')!, 10)];
    expect(ableCount(item('thunder-stone'), party)).toBe(1);
    expect(ableCount(item('fire-stone'), party)).toBe(0);
  });
});

describe('the body', () => {
  it('shows every pocket and the next raid pack, and offers nothing to drop', () => {
    const html = thingsBody({
      contents: { potion: 2, 'tm40-aerial-ace': 1, 'fire-stone': 1, money: 40 },
      pokemon: [new Pokemon(getSpeciesById('vulpix')!, 12)],
      packed: (itemId) => (itemId === 'potion' ? 2 : 0),
      pack: { name: 'Raid pack', layout: packContents({ potion: 2 }, { width: 6, height: 3 }), used: 2, total: 18 },
    });
    expect(html).toContain('Medicine');
    expect(html).toContain('Discs');
    expect(html).toContain('Stones');
    expect(html).toContain('Found goods');
    expect(html).toContain('Next raid: Raid pack');
    expect(html).toContain('2/18 squares');
    expect(html).toContain('1 of yours it would evolve');
    expect(html).not.toMatch(/data-drop|Drop one/);
  });
});

describe('a pocket at a time', () => {
  const pockets = ['medicine', 'medicine', 'medicine', 'balls', 'discs', 'discs', 'clothes'];

  it('goes to the next pocket and the one before', () => {
    expect(pocketJump(pockets, 0, 1)).toBe(3);
    expect(pocketJump(pockets, 3, 1)).toBe(4);
    expect(pocketJump(pockets, 5, 1)).toBe(6);
    expect(pocketJump(pockets, 6, -1)).toBe(4);
    expect(pocketJump(pockets, 4, -1)).toBe(3);
  });

  it('goes back to the top of its own pocket before the one above', () => {
    expect(pocketJump(pockets, 2, -1)).toBe(0);
    expect(pocketJump(pockets, 5, -1)).toBe(4);
  });

  it('stops at the ends, and Home and End go there', () => {
    expect(pocketJump(pockets, 6, 1)).toBe(6);
    expect(pocketJump(pockets, 0, -1)).toBe(0);
    expect(pocketJump(pockets, 4, 'first')).toBe(0);
    expect(pocketJump(pockets, 1, 'last')).toBe(6);
    expect(pocketJump([], 0, 1)).toBe(0);
  });
});

describe('the pockets as a strip of icons', () => {
  it('stands one icon a pocket, in pocket order, the first lit, and none for a single pocket', () => {
    const pockets = storedPockets({ potion: 2, 'poke-ball': 3, 'thunder-stone': 1 });
    const strip = pocketStrip(pockets);
    expect([...strip.matchAll(/class="things-pocket(?: is-here)?" data-pocket-tab="(\w+)"/g)].map((match) => match[1])).toEqual(['medicine', 'balls', 'stones']);
    expect(strip).toMatch(/things-pocket is-here" data-pocket-tab="medicine"/);
    // And the lit pocket's name beside them, the others' hidden.
    expect(strip).toMatch(/things-pocket-name is-here" data-pocket-tab="medicine">Medicine</);
    expect(strip.match(/is-here/g)).toHaveLength(2);
    expect(pocketStrip(storedPockets({ potion: 2 }))).toBe('');
  });
});
