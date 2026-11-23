import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: { Scene: class {}, Scenes: { Events: {} } } }));
vi.mock('../audio/AudioManager', () => ({
  audioManager: new Proxy({}, { get: () => vi.fn(() => Promise.resolve()) }),
}));

import { CHARMANDER, PIDGEY, Pokemon } from '../pokemon';
import { createStartingStash } from '../stash';
import { DojoCounterScene } from './DojoCounterScene';

interface Counter {
  toggle(pokemonId: string): void;
  team: string[];
  rendered: (readonly string[])[];
}

/** THE BATTLE ARENA's counter over a vault holding these, with nobody chosen yet. */
function counterWith(extra: number): Counter {
  const stash = createStartingStash(CHARMANDER);
  for (let index = 0; index < extra; index += 1) {
    stash.addPokemon(new Pokemon(PIDGEY, 5), `pidgey-${index + 1}`);
  }
  const scene = Object.create(DojoCounterScene.prototype) as DojoCounterScene;
  const rendered: (readonly string[])[] = [];
  Object.assign(scene as object, {
    game_: { stash },
    team: [],
    mode: null,
    now: new Date(),
    rendered,
    render: (prefer: readonly string[] = []) => rendered.push(prefer),
  });
  return scene as unknown as Counter;
}

/**
 * The overnight retest's key masher (23 Nov 2026): with one Pokémon, SPACE put
 * it on the side and took it off again for ever, and the cursor never reached
 * FIGHT. With nobody left who could join, the cursor goes to FIGHT.
 */
describe('choosing a side at the BATTLE ARENA', () => {
  it('moves the cursor to FIGHT once nobody else could join', () => {
    const counter = counterWith(0);
    const [only] = (counter as unknown as { entries(): readonly { id: string }[] }).entries();
    counter.toggle(only.id);
    expect(counter.team).toEqual([only.id]);
    expect(counter.rendered.at(-1)?.[0]).toBe('[data-fight]:not([aria-disabled])');
  });

  it('keeps the cursor on the row while somebody else could still join', () => {
    const counter = counterWith(1);
    const [first] = (counter as unknown as { entries(): readonly { id: string }[] }).entries();
    counter.toggle(first.id);
    expect(counter.rendered.at(-1)).toEqual([`[data-member="${first.id}"]`]);
  });

  it('counts a second of the same kind as somebody who could not join', () => {
    // One of each kind: two Pidgey and a Charmander make a side of two.
    const counter = counterWith(2);
    const entries = (counter as unknown as { entries(): readonly { id: string; pokemon: Pokemon }[] }).entries();
    const charmander = entries.find((entry) => entry.pokemon.base.id === 'charmander')!;
    const pidgey = entries.find((entry) => entry.pokemon.base.id === 'pidgey')!;
    counter.toggle(charmander.id);
    counter.toggle(pidgey.id);
    expect(counter.rendered.at(-1)?.[0]).toBe('[data-fight]:not([aria-disabled])');
  });
});
