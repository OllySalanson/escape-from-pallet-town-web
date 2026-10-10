import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Scenes: { Events: { SHUTDOWN: 'shutdown', DESTROY: 'destroy' } },
  },
}));

import { Bag } from '../items';
import { PIDGEY, Pokemon, PokemonParty } from '../pokemon';
import { PartyScene } from './PartyScene';

interface PartyInternals {
  init(data: { party: PokemonParty; bag: Bag }): void;
  takeGear(index: number): void;
  giveGear(itemId: string, index: number): void;
  menuOverlay: { root: { innerHTML: string; querySelectorAll(): never[] }; refocus(): void };
}

/** The raid party screen over a pack, wired to a stand-in for the DOM. */
function partyScreen(holder: Pokemon, bag: Bag): PartyInternals & { markup(): string } {
  const scene = Object.create(PartyScene.prototype) as PartyInternals;
  scene.init({ party: new PokemonParty([holder]), bag });
  scene.menuOverlay = { root: { innerHTML: '', querySelectorAll: () => [] }, refocus: () => undefined };
  return Object.assign(scene, { markup: () => scene.menuOverlay.root.innerHTML });
}

/** Fills every square of a pack, so nothing more goes in however it is laid out. */
function fullPack(): Bag {
  const bag = new Bag();
  while (bag.add('parts-crate', 1));
  while (bag.add('potion', 1));
  expect(bag.takeFind('leftovers', 1)).toBe('refused');
  return bag;
}

describe('gear on the raid party screen', () => {
  it('leaves gear on its holder when the pack has no room to take it back', () => {
    // Playtests 25 G1 and 29 B3: TAKE into a full pack destroyed the gear.
    const pidgey = new Pokemon(PIDGEY, 5);
    pidgey.giveHeldItem('leftovers');
    const bag = fullPack();
    const before = bag.toJSON();
    const scene = partyScreen(pidgey, bag);

    scene.takeGear(0);

    expect(pidgey.heldItemId).toBe('leftovers');
    expect(bag.toJSON()).toEqual(before);
    expect(scene.markup()).toContain('No room in the pack for Leftovers. Pidgey keeps holding it');
  });

  it('takes gear back into a pack with room', () => {
    const pidgey = new Pokemon(PIDGEY, 5);
    pidgey.giveHeldItem('leftovers');
    const bag = new Bag();
    partyScreen(pidgey, bag).takeGear(0);

    expect(pidgey.heldItemId).toBeNull();
    expect(bag.count('leftovers')).toBe(1);
  });

  it('swaps gear in a full pack without losing the piece that comes off', () => {
    const pidgey = new Pokemon(PIDGEY, 5);
    pidgey.giveHeldItem('leftovers');
    const bag = fullPack();
    bag.remove('potion', 1);
    expect(bag.add('quick-claw', 1)).toBe(true);

    partyScreen(pidgey, bag).giveGear('quick-claw', 0);

    expect(pidgey.heldItemId).toBe('quick-claw');
    expect(bag.count('quick-claw')).toBe(0);
    expect(bag.count('leftovers')).toBe(1);
  });
});

describe('the order of the raid party', () => {
  it('does not offer to pick up a lone Pokemon it would refuse to move', () => {
    const scene = partyScreen(new Pokemon(PIDGEY, 5), new Bag()) as PartyInternals & {
      markup(): string;
      render(): void;
    };
    scene.render();

    expect(scene.markup()).not.toContain('ENTER pick up');
    expect(scene.markup()).not.toContain('Pick Pidgey up to move it');
    expect(scene.markup()).toContain('Pidgey is the only Pokémon deployed, so it is the one sent out.');
  });

  it('offers to pick a Pokemon up when there is someone to swap with', () => {
    const scene = Object.create(PartyScene.prototype) as PartyInternals & { render(): void };
    scene.init({ party: new PokemonParty([new Pokemon(PIDGEY, 5), new Pokemon(PIDGEY, 6)]), bag: new Bag() });
    scene.menuOverlay = { root: { innerHTML: '', querySelectorAll: () => [] }, refocus: () => undefined };
    scene.render();

    expect(scene.menuOverlay.root.innerHTML).toContain('ENTER pick up');
    expect(scene.menuOverlay.root.innerHTML).toContain('Pick Pidgey up to move it');
  });
});
