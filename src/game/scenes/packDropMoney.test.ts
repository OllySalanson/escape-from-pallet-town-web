import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: { Scene: class {} } }));
vi.mock('../audio/AudioManager', () => ({
  audioManager: new Proxy({}, { get: () => vi.fn(() => Promise.resolve()) }),
}));

import { Bag } from '../items';
import { getSpeciesById, Pokemon } from '../pokemon';
import { BagScene } from './BagScene';

interface PackHarness {
  itemDetail(item: { id: string }, first: boolean): string;
  dropOne(itemId: string): void;
  itemById(itemId: string): { id: string } | undefined;
  status?: string;
}

/** The raid pack open over a bag holding `contents`. */
function packHolding(
  contents: Record<string, number>,
  onItemDropped?: (itemId: string, quantity: number) => void,
): { scene: PackHarness; bag: Bag } {
  const bag = new Bag();
  for (const [itemId, quantity] of Object.entries(contents)) {
    bag.add(itemId, quantity);
  }
  const scene = Object.create(BagScene.prototype) as BagScene;
  Object.assign(scene as object, {
    bag,
    party: { pokemon: [new Pokemon(getSpeciesById('rattata')!, 10)] },
    onItemUsed: () => undefined,
    onItemDropped,
    render: () => undefined,
  });
  return { scene: scene as unknown as PackHarness, bag };
}

/** What a player reads in an item's pane: its words, with the markup taken off. */
const shown = (html: string): string =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** A control's help line, which the help bar reads when it is pointed at. */
const helpOf = (html: string, selector: string): string =>
  new RegExp(`${selector}[^>]*data-help="([^"]*)"`).exec(html)?.[1] ?? '';

describe('dropping Pokédollars from the raid pack', () => {
  it('drops the bundle that takes the square, not ₽1, and says so in money', () => {
    const { scene, bag } = packHolding({ money: 45, potion: 2 });
    const pane = scene.itemDetail(scene.itemById('money')!, true);

    // ₽45 is one bundle in one square: the pane says the sum, and the drop
    // says it puts the whole bundle down, which is what frees the square.
    expect(shown(pane)).toContain('₽45 carried');
    expect(shown(pane)).not.toContain('45 carried · 1 square each');
    expect(helpOf(pane, 'data-drop="money"')).toBe('Put ₽45 on the ground for good. It frees 1 square.');

    scene.dropOne('money');
    expect(bag.count('money')).toBe(0);
    expect(scene.status).toContain('Dropped ₽45.');
    expect(bag.count('potion')).toBe(2);
  });

  it('drops only the part-filled bundle when there is more than one', () => {
    const { scene, bag } = packHolding({ money: 300 });
    const pane = scene.itemDetail(scene.itemById('money')!, true);
    expect(helpOf(pane, 'data-drop="money"')).toBe('Put ₽50 on the ground for good. It frees 1 square.');

    const squaresBefore = bag.layout().cellsUsed;
    scene.dropOne('money');
    expect(bag.count('money')).toBe(250);
    expect(bag.layout().cellsUsed).toBe(squaresBefore - 1);
  });

  it('still drops one of anything else', () => {
    const { scene, bag } = packHolding({ potion: 3 });
    const pane = scene.itemDetail(scene.itemById('potion')!, true);
    expect(shown(pane)).toContain('3 carried · 1 square each');
    expect(helpOf(pane, 'data-drop="potion"')).toBe('Put one Potion on the ground for good. It frees 1 square.');
    scene.dropOne('potion');
    expect(bag.count('potion')).toBe(2);
    expect(scene.status).toContain('Dropped Potion.');
  });
});

describe('what a drop tells the raid', () => {
  it('names the item and how much went on the ground, so the result can say it was put down', () => {
    const drops: [string, number][] = [];
    const { scene } = packHolding({ money: 300, 'parts-crate': 1 }, (itemId, quantity) => drops.push([itemId, quantity]));
    scene.dropOne('parts-crate');
    scene.dropOne('money');
    expect(drops).toEqual([
      ['parts-crate', 1],
      ['money', 50],
    ]);
  });
});
