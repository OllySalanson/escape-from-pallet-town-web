import { describe, expect, it } from 'vitest';
import { getItemById } from '../items';
import { Pokemon, getSpeciesById, stoneUsers } from '../pokemon';
import { stoneTargetsBody } from './thingsView';

const mon = (id: string, level: number): { pokemon: Pokemon; box: string } => ({
  pokemon: new Pokemon(getSpeciesById(id)!, level),
  box: 'Box 1',
});

describe('who a stone is for', () => {
  it('names the species a stone evolves, in Pokédex order', () => {
    expect(stoneUsers('fire-stone').map((species) => species.name)).toEqual(['Vulpix', 'Growlithe', 'Eevee']);
    expect(stoneUsers('thunder-stone').map((species) => species.name)).toEqual(['Pikachu', 'Eevee']);
  });

  it('says who the stone is for when nobody the player has can use it', () => {
    // A Fire Stone with a Charmander and a Raichu read NOT ABLE twice with no
    // reason: the cursor has no row to stand on, so no row's help is shown
    // (scenario loop, 23 Nov 2026).
    const body = stoneTargetsBody(getItemById('fire-stone')!, [mon('charmander', 5), mon('raichu', 14)]);
    expect(body).toContain('Nobody you have can use a Fire Stone. It evolves VULPIX, GROWLITHE and EEVEE.');
  });

  it('says nothing more while somebody can use it', () => {
    const body = stoneTargetsBody(getItemById('thunder-stone')!, [mon('charmander', 5), mon('pikachu', 14)]);
    expect(body).not.toContain('Nobody you have');
    expect(body).toContain('1 able');
  });
});
