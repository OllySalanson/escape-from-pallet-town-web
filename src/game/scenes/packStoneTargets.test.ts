import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: { Scene: class {} } }));

import { Bag, getItemById } from '../items';
import { getSpeciesById, Pokemon } from '../pokemon';
import { BagScene } from './BagScene';

/** The raid pack's recipient list for `itemId`, drawn for a party of `speciesIds`. */
function recipientRows(itemId: string, speciesIds: readonly string[]): { tag: string; help: string }[] {
  const bag = new Bag();
  bag.add(itemId);
  const scene = Object.create(BagScene.prototype) as BagScene;
  Object.assign(scene as object, {
    bag,
    party: { pokemon: speciesIds.map((id) => new Pokemon(getSpeciesById(id)!, 20)) },
  });
  const markup = (scene as unknown as { recipientBody(item: unknown): string }).recipientBody(getItemById(itemId));
  // One row per Pokemon: its help line, then the tag on its end.
  return [...markup.matchAll(/data-target="\d+"[^>]*data-help="([^"]*)".*?<span class="px-tag">([^<]*)<\/span>/g)].map(
    ([, help, tag]) => ({ tag, help }),
  );
}

describe("the raid pack's recipient list (playtest 32's stone list)", () => {
  it('says ABLE or NOT ABLE for an evolution stone, as FireRed does, rather than HP', () => {
    const [pikachu, rattata] = recipientRows('thunder-stone', ['pikachu', 'rattata']);
    expect(pikachu.tag).toBe('Able');
    expect(rattata.tag).toBe('Not able');
    // The help line names what the stone would make of it, or that it would do nothing.
    expect(pikachu.help).toContain('Raichu');
    expect(rattata.help).toContain('It will not have any effect.');
  });

  it('still shows the HP a Potion is for', () => {
    const [rattata] = recipientRows('potion', ['rattata']);
    expect(rattata.tag).toMatch(/^\d+\/\d+\u00a0HP$/);
  });
});
