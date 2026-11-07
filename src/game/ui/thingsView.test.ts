import { describe, expect, it } from 'vitest';
import { getItemById, ITEMS, packContents } from '../items';
import { Pokemon, getSpeciesById } from '../pokemon';
import {
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
