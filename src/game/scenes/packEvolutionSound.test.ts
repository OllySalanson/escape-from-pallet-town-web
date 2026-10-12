import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: { Scene: class {} } }));

const played: { name: string; species?: number }[] = [];
vi.mock('../audio/AudioManager', () => ({
  audioManager: new Proxy(
    {},
    {
      get: (_target, key) =>
        key === 'play'
          ? (name: string, options?: { species?: number }) => played.push({ name, species: options?.species })
          : vi.fn(() => Promise.resolve()),
    },
  ),
}));

import { Bag } from '../items';
import { getSpeciesById, Pokemon } from '../pokemon';
import { BagScene } from './BagScene';

/** The raid pack open on one Pokemon, with `itemId` chosen to give it. */
function givingFromThePack(speciesId: string, itemId: string) {
  const pokemon = new Pokemon(getSpeciesById(speciesId)!, 20);
  const bag = new Bag();
  bag.add(itemId);
  const scene = Object.create(BagScene.prototype) as BagScene;
  Object.assign(scene as object, {
    bag,
    party: { pokemon: [pokemon] },
    usingItemId: itemId,
    onItemUsed: () => undefined,
    render: () => undefined,
  });
  return { scene: scene as unknown as { giveTo(index: number): void }, pokemon };
}

describe('an evolution stone used from the raid pack', () => {
  it('sounds the evolution fanfare and then the cry of the species it became', async () => {
    played.length = 0;
    const { scene, pokemon } = givingFromThePack('pikachu', 'thunder-stone');
    scene.giveTo(0);
    await Promise.resolve();
    await Promise.resolve();
    expect(pokemon.base.id).toBe('raichu');
    expect(played).toEqual([{ name: 'evolved', species: undefined }, { name: 'cry', species: 26 }]);
  });

  it('is refused with the refusal sound on a Pokemon the stone does nothing for', async () => {
    played.length = 0;
    const { scene, pokemon } = givingFromThePack('rattata', 'thunder-stone');
    scene.giveTo(0);
    await Promise.resolve();
    expect(pokemon.base.id).toBe('rattata');
    expect(played).toEqual([{ name: 'denied', species: undefined }]);
  });

  it('still heals to the heal sound', () => {
    played.length = 0;
    const { scene, pokemon } = givingFromThePack('rattata', 'potion');
    pokemon.currentHp = 1;
    scene.giveTo(0);
    expect(played).toEqual([{ name: 'heal', species: undefined }]);
  });
});
