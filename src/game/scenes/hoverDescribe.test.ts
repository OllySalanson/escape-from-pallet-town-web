import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Scenes: { Events: { SHUTDOWN: 'shutdown', DESTROY: 'destroy' } },
    Input: { Keyboard: { KeyCodes: {} } },
  },
}));

import { Bag } from '../items';
import { CHARMANDER, PIDGEY, Pokemon, PokemonParty } from '../pokemon';
import { describeKey } from '../ui/hoverDescribe';
import { BagScene } from './BagScene';
import { PartyScene } from './PartyScene';

/**
 * The captain's complaint, held as a test: pointing at a thing in the raid bag
 * has to tell him what it is, and it must not cost him the row he had chosen.
 *
 * PR #153 answered it with three sources - pointer, then keyboard cursor, then
 * the thing the player had chosen - because those screens kept a selection of
 * their own. On a pixel-ui screen there is no second thing: **the cursor is the
 * selection**, the pointer moves it (`MenuOverlay`'s hover handler), and moving
 * it commits nothing, so finding out what a RADIO VALVE is cannot cost anything
 * at all. What is still true either way is held here, against the new markup:
 * the key a row and its squares share, the answer the help line gives, and the
 * pane per member with all but one hidden.
 *
 * There is no DOM in this suite - the project runs vitest on node - so the
 * overlay root is faked down to the one thing these screens ask of it while
 * rendering: somewhere to put their markup.
 */

class FakeRoot {
  public innerHTML = '';
  public readonly dataset: Record<string, string | undefined> = {};
  public addEventListener(): void {}
  public setAttribute(): void {}
  public querySelector(): null {
    return null;
  }
  public querySelectorAll(): readonly never[] {
    return [];
  }
}

function render(scene: object, data: unknown): string {
  const root = new FakeRoot();
  Object.assign(scene as Record<string, unknown>, {
    menuOverlay: { root, focus: vi.fn(), refocus: vi.fn() },
  });
  (scene as { init(data: unknown): void }).init(data);
  Object.assign(scene as Record<string, unknown>, {
    menuOverlay: { root, focus: vi.fn(), refocus: vi.fn() },
  });
  (scene as { render(): void }).render();
  return root.innerHTML;
}

function bagMarkup(over: { readonly using?: string } = {}): string {
  const bag = new Bag();
  bag.add('potion', 2);
  bag.add('antidote', 1);
  const scene = Object.create(BagScene.prototype) as object;
  const markup = render(scene, {
    bag,
    party: new PokemonParty([new Pokemon(CHARMANDER, 7)]),
    onItemUsed: vi.fn(),
  });
  if (over.using === undefined) {
    return markup;
  }
  Object.assign(scene as Record<string, unknown>, { usingItemId: over.using });
  const root = new FakeRoot();
  Object.assign(scene as Record<string, unknown>, {
    menuOverlay: { root, focus: vi.fn(), refocus: vi.fn() },
  });
  (scene as { render(): void }).render();
  return root.innerHTML;
}

describe('pointing at something in the raid pack', () => {
  it('is the same question as pointing at its squares', () => {
    const markup = bagMarkup();
    // The pocket row and the block it occupies carry one key, which is what
    // lets a pointer on either answer for the other and light it.
    expect(markup).toContain(`data-describes="${describeKey('item', 'potion')}"`);
    expect(markup).toContain(`data-describes="${describeKey('item', 'antidote')}"`);
    // Once on the row and once on each square the item is seated in - two
    // Potions are two blocks, because a square holds one of them.
    expect(markup.match(/px-row[^>]*data-describes="item:potion"/g)?.length).toBe(1);
    expect(markup.match(/px-grid-block[^>]*data-describes="item:potion"/g)?.length).toBe(2);
  });

  it('tells you what it is and what pressing it would do, naming the item', () => {
    const markup = bagMarkup();
    expect(markup).toContain('Restores 20 HP.');
    // Never a bare `use item`: the help line is read about whatever the cursor
    // is on, and the verb has to say what it would spend.
    expect(markup).toContain('Use Potion on a Pokémon.');
    expect(markup).toContain('Use Antidote on a Pokémon.');
  });

  it('costs nothing, because the cursor is the only selection there is', async () => {
    const source = await import('node:fs/promises').then((fs) =>
      fs.readFile(new URL('./BagScene.ts', import.meta.url), 'utf8'),
    );
    // The fault PR #153 fixed cannot come back in a shape that has no second
    // highlighted row to lose: there is no chosen index on this screen.
    expect(source).not.toContain('selectedItemIndex');
    expect(source).not.toContain('selectedPokemonIndex');
  });

  it('keeps the item on screen while its recipients are being arrowed through', () => {
    const markup = bagMarkup({ using: 'potion' });
    // PR #153's `POINTER_ONLY`, answered by the layout instead: the item is the
    // window's own lid, so nothing the cursor does inside the list can take it
    // off the screen.
    expect(markup).toContain('Use Potion on');
    expect(markup).toContain('data-target="0"');
  });
});

describe('pointing at a member of the raid party', () => {
  it('builds a pane for every member and shows one, so pointing swaps no markup', () => {
    const party = new PokemonParty([new Pokemon(CHARMANDER, 7), new Pokemon(PIDGEY, 5)]);
    const markup = render(Object.create(PartyScene.prototype) as object, { party });
    expect(markup).toContain('data-shown-by="member-0"');
    expect(markup).toContain('data-shown-by="member-1" hidden');
    expect(markup).toContain('data-shows="member-0"');
    expect(markup).toContain('data-shows="member-1"');
  });

  it('gives every control on a pane that pane\'s own key', async () => {
    const source = await import('node:fs/promises').then((fs) =>
      fs.readFile(new URL('./PartyScene.ts', import.meta.url), 'utf8'),
    );
    // A cursor that swapped the pane out from under itself left the first
    // member's gear unreachable by the arrow keys altogether (PR #153).
    expect(source).toContain('data-gear-take="${index}" ${shows}');
    expect(source).toContain('data-gear-member="${index}" ${shows}');
  });

  it('never leaves the cursor on a control nobody can see', async () => {
    const source = await import('node:fs/promises').then((fs) =>
      fs.readFile(new URL('../ui/MenuOverlay.ts', import.meta.url), 'utf8'),
    );
    // Every hidden pane is full of buttons, and a hidden one refuses focus in
    // silence: the cursor reaches it, nothing happens, and it stops dead.
    expect(source).toContain('control.offsetParent !== null');
  });
});
