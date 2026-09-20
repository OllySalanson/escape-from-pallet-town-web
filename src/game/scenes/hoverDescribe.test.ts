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
import { describeKey, POINTER_ONLY } from '../ui/hoverDescribe';
import { BagScene } from './BagScene';
import { PartyScene } from './PartyScene';

/**
 * The captain's complaint, held as a test: pointing at a thing in the raid bag
 * has to tell him what it is, and it must not cost him the row he had chosen.
 *
 * There is no DOM in this suite - the project runs vitest on node - so the
 * overlay root is faked down to the two things these screens ask of it: the
 * boxes the detail panel writes into, and the blocks it lights.
 */

class FakeBox {
  public textContent = '';
  public hidden = false;
  public onclick: (() => void) | null = null;
  public readonly dataset: Record<string, string | undefined> = {};
  public readonly classes = new Set<string>();
  public addEventListener(): void {}
  public readonly classList = {
    toggle: (name: string, on: boolean) => {
      if (on) {
        this.classes.add(name);
      } else {
        this.classes.delete(name);
      }
    },
  };
}

class FakeRoot {
  public innerHTML = '';
  private readonly singles = new Map<string, FakeBox>();
  private readonly lists = new Map<string, FakeBox[]>();

  public seed(selector: string, boxes: readonly FakeBox[]): void {
    this.lists.set(selector, [...boxes]);
  }

  public box(selector: string): FakeBox {
    const existing = this.singles.get(selector);
    if (existing) {
      return existing;
    }
    const box = new FakeBox();
    this.singles.set(selector, box);
    return box;
  }

  public addEventListener(): void {
    // The listeners only ever call `setDescribing`, which the tests call directly.
  }

  public querySelector(selector: string): FakeBox {
    return this.box(selector);
  }

  public querySelectorAll(selector: string): readonly FakeBox[] {
    return this.lists.get(selector) ?? [];
  }
}

interface BagInternals {
  init(data: unknown): void;
  renderModernMenu(): void;
  choosingPokemon: boolean;
  setDescribing(pointer: string | null, cursor: string | null): void;
  applyDescription(): void;
  selectedItemIndex: number;
  selectedItem: { readonly id: string } | undefined;
}

function createBag(): { scene: BagInternals; root: FakeRoot; potion: FakeBox; antidote: FakeBox } {
  const bag = new Bag();
  bag.add('potion', 2);
  bag.add('antidote', 1);
  const root = new FakeRoot();
  const potion = new FakeBox();
  potion.dataset.describes = describeKey('item', 'potion');
  const antidote = new FakeBox();
  antidote.dataset.describes = describeKey('item', 'antidote');
  root.seed('.raid-grid-block', [potion, antidote]);
  const scene = Object.create(BagScene.prototype) as BagInternals;
  Object.assign(scene as unknown as Record<string, unknown>, {
    menuOverlay: { root, focus: vi.fn() },
  });
  scene.init({ bag, party: new PokemonParty(), onItemUsed: vi.fn() });
  Object.assign(scene as unknown as Record<string, unknown>, {
    bag,
    party: new PokemonParty(),
    onItemUsed: vi.fn(),
  });
  return { scene, root, potion, antidote };
}

describe('pointing at something in the raid bag', () => {
  it('tells you what it is without choosing it', () => {
    const { scene, root } = createBag();
    scene.applyDescription();
    expect(root.box('[data-detail-name]').textContent).toBe('Potion');

    scene.setDescribing(describeKey('item', 'antidote'), null);
    expect(root.box('[data-detail-name]').textContent).toBe('Antidote');
    expect(root.box('[data-detail-description]').textContent).toContain('poison');
    // The whole point: the row the player chose is still the row they chose.
    expect(scene.selectedItemIndex).toBe(0);
    expect(scene.selectedItem?.id).toBe('potion');
  });

  it('gives the panel back to the chosen item when the pointer leaves', () => {
    const { scene, root } = createBag();
    scene.setDescribing(describeKey('item', 'antidote'), null);
    scene.setDescribing(null, null);
    expect(root.box('[data-detail-name]').textContent).toBe('Potion');
    expect(scene.selectedItemIndex).toBe(0);
  });

  it('lights that item where it sits in the pack', () => {
    const { scene, potion, antidote } = createBag();
    scene.applyDescription();
    expect(potion.classes.has('marked')).toBe(true);
    expect(antidote.classes.has('marked')).toBe(false);

    scene.setDescribing(describeKey('item', 'antidote'), null);
    expect(antidote.classes.has('marked')).toBe(true);
    expect(potion.classes.has('marked')).toBe(false);
  });

  it('answers the keyboard cursor too, and lets the pointer overrule it', () => {
    const { scene, root } = createBag();
    scene.setDescribing(null, describeKey('item', 'antidote'));
    expect(root.box('[data-detail-name]').textContent).toBe('Antidote');
    scene.setDescribing(describeKey('item', 'potion'), describeKey('item', 'antidote'));
    expect(root.box('[data-detail-name]').textContent).toBe('Potion');
    expect(scene.selectedItemIndex).toBe(0);
  });

  it('forgets an answer about something the pack no longer holds', () => {
    const { scene, root } = createBag();
    scene.setDescribing(describeKey('item', 'super-potion'), null);
    expect(root.box('[data-detail-name]').textContent).toBe('Potion');
  });

  it('writes the describe keys onto the rows and the pack blocks', () => {
    const { scene, root } = createBag();
    scene.renderModernMenu();
    expect(root.innerHTML).toContain(`data-describes="${describeKey('item', 'potion')}"`);
    expect(root.innerHTML).toContain(`data-describes="${describeKey('item', 'antidote')}"`);
    // The pocket row and the square in the pack carry the same key, which is
    // what makes pointing at either answer the same question.
    expect(root.innerHTML).toContain('data-item-index="0" data-describes="item:potion"');
    expect(root.innerHTML).toContain('class="raid-grid-block" data-describes="item:potion"');
    // And the group that keeps the answer steady while the pointer crosses the
    // gap between two rows.
    expect(root.innerHTML).toContain('data-describe-group');
  });
});

describe('a recipient list', () => {
  it('answers the pointer only, so arrowing through it keeps the item on screen', () => {
    const { scene, root } = createBag();
    scene.renderModernMenu();
    (scene as unknown as { choosingPokemon: boolean }).choosingPokemon = true;
    Object.assign(scene as unknown as Record<string, unknown>, {
      party: new PokemonParty([new Pokemon(CHARMANDER, 7)]),
    });
    scene.renderModernMenu();
    expect(root.innerHTML).toContain(`data-describes="${describeKey('pokemon', 0)}" ${POINTER_ONLY}`);
  });
});

interface PartyInternals {
  init(data: unknown): void;
  renderModernMenu(): void;
  setDescribing(pointer: string | null, cursor: string | null): void;
  showDescribedCard(): void;
  selectedIndex: number;
}

function createParty(): { scene: PartyInternals; cards: readonly FakeBox[]; root: FakeRoot } {
  const party = new PokemonParty([new Pokemon(CHARMANDER, 7), new Pokemon(PIDGEY, 5)]);
  const root = new FakeRoot();
  const cards = [new FakeBox(), new FakeBox()];
  cards.forEach((card, index) => { card.dataset.detailFor = String(index); });
  root.seed('[data-detail-for]', cards);
  const scene = Object.create(PartyScene.prototype) as PartyInternals;
  Object.assign(scene as unknown as Record<string, unknown>, {
    menuOverlay: { root, focus: vi.fn() },
  });
  scene.init({ party });
  Object.assign(scene as unknown as Record<string, unknown>, { party, bag: new Bag() });
  return { scene, cards, root };
}

describe('pointing at a member of the raid party', () => {
  it('shows that member without choosing them', () => {
    const { scene, cards } = createParty();
    scene.showDescribedCard();
    expect(cards[0].hidden).toBe(false);
    expect(cards[1].hidden).toBe(true);

    scene.setDescribing(describeKey('member', 1), null);
    expect(cards[1].hidden).toBe(false);
    expect(cards[0].hidden).toBe(true);
    expect(scene.selectedIndex).toBe(0);
  });

  /**
   * A card carries gear rows, so a cursor that swapped cards as it passed each
   * member would move its own next step - which made the first member's gear
   * unreachable by the arrow keys. See POINTER_ONLY.
   */
  it('is a question for the pointer, and every control on a card names its card', () => {
    const { scene, root } = createParty();
    scene.renderModernMenu();
    expect(root.innerHTML).toContain(`data-describes="${describeKey('member', 1)}" ${POINTER_ONLY}`);
    expect(root.innerHTML).toContain('data-detail-for="1" data-describe-group hidden');
  });

  it('gives the card back to the chosen member when the pointer leaves', () => {
    const { scene, cards } = createParty();
    scene.setDescribing(describeKey('member', 1), null);
    scene.setDescribing(null, null);
    expect(cards[0].hidden).toBe(false);
    expect(cards[1].hidden).toBe(true);
    expect(scene.selectedIndex).toBe(0);
  });
});
