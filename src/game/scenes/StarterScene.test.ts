import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: { Scene: class {} },
}));

// The screen is DOM; what matters here is what it says and where its one
// button goes, so the overlay is a root that keeps its markup and its clicks,
// and one element per selector it was asked for, which keeps what is written.
vi.mock('../ui/MenuOverlay', () => ({
  MenuOverlay: class {
    public readonly clicks = new Map<string, () => void>();
    public readonly listeners = new Map<string, (event: unknown) => void>();
    public readonly elements = new Map<string, { textContent: string; dataset: Record<string, string> }>();
    public readonly cards = ['bulbasaur', 'charmander', 'squirtle'].map((starter) => {
      const classes = new Set<string>();
      const attributes = new Map<string, string>();
      return {
        dataset: { starter },
        classes,
        attributes,
        classList: { toggle: (name: string, on: boolean) => void (on ? classes.add(name) : classes.delete(name)) },
        setAttribute: (name: string, value: string) => attributes.set(name, value),
        focus: () => undefined,
        onclick: null as (() => void) | null,
      };
    });
    public readonly focused: string[] = [];
    public cursorInside = true;
    public drawn = 0;
    public measured = 0;
    public pointerRule = 'moves-cursor';
    private markup = '';
    public readonly root = {
      owner: this,
      get innerHTML(): string {
        return this.owner.markup;
      },
      set innerHTML(markup: string) {
        this.owner.markup = markup;
        this.owner.drawn += 1;
      },
      querySelector: (selector: string) => {
        const element = this.elements.get(selector) ?? { textContent: '', dataset: {} };
        this.elements.set(selector, element);
        return {
          ...element,
          dataset: element.dataset,
          set textContent(words: string) {
            element.textContent = words;
          },
          addEventListener: (_event: string, handler: () => void) => this.clicks.set(selector, handler),
          focus: () => this.focused.push(selector),
        };
      },
      querySelectorAll: () => this.cards,
      contains: () => this.cursorInside,
      addEventListener: (event: string, handler: (event: unknown) => void) => this.listeners.set(event, handler),
    };
    public focus(): void {}
    public layout(): void {
      this.measured += 1;
    }
    /** The real one moves the cursor on an arrow key; the test says where it lands. */
    public moveCursor(key: string): boolean {
      return key.startsWith('Arrow');
    }
  },
}));

import { SAVE_KEY, SaveManager, type StorageLike } from '../save/SaveManager';
import { CANNOT_SAVE_MESSAGE, StarterScene } from './StarterScene';

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  public removeItem(key: string): void {
    this.values.delete(key);
  }
}

/** Storage that reads but refuses every write, as a browser with site data blocked or full does. */
class RefusingStorage extends MemoryStorage {
  public override setItem(): void {
    throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
  }
}

interface StarterInternals {
  create(): void;
  handleKey(event: KeyboardEvent): void;
  confirmStarter(): void;
  readonly overlay: {
    root: { innerHTML: string };
    clicks: Map<string, () => void>;
    listeners: Map<string, (event: unknown) => void>;
    elements: Map<string, { textContent: string; dataset: Record<string, string> }>;
    cards: { dataset: Record<string, string>; classes: Set<string>; attributes: Map<string, string>; onclick: (() => void) | null }[];
    focused: string[];
    cursorInside: boolean;
    drawn: number;
    measured: number;
    pointerRule: string;
  };
}

function openStarter(storage: StorageLike | null): { scene: StarterInternals; start: ReturnType<typeof vi.fn> } {
  const start = vi.fn();
  const scene = Object.create(StarterScene.prototype) as StarterInternals;
  Object.assign(scene as unknown as Record<string, unknown>, {
    scene: { start },
    saveManager: new SaveManager(storage),
    selectedStarterId: 'bulbasaur',
  });
  scene.create();
  return { scene, start };
}

describe('NEW GAME in a browser that cannot save', () => {
  it.each([
    ['no storage at all', null],
    ['storage that refuses every write', new RefusingStorage()],
  ])('says so plainly instead of offering a partner: %s', (_name, storage) => {
    const { scene, start } = openStarter(storage);

    expect(scene.overlay.root.innerHTML).toContain(CANNOT_SAVE_MESSAGE);
    expect(scene.overlay.root.innerHTML).not.toContain('data-starter=');
    // The one way on is back to the title, never into a game with no save.
    scene.overlay.clicks.get('[data-title]')!();
    expect(start).toHaveBeenCalledWith('title');
    expect(start).not.toHaveBeenCalledWith('base', expect.anything());
  });

  it('never starts the base on a game it could not write', () => {
    // Storage that let the probe through and then refused the game itself -
    // the base used to be started on the unsaved game and read a save that
    // was not there, which is the black screen.
    const storage = new MemoryStorage();
    const { scene, start } = openStarter(storage);
    expect(scene.overlay.root.innerHTML).toContain('data-starter=');
    storage.setItem = (key: string, value: string) => {
      if (key === SAVE_KEY) {
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      }
      MemoryStorage.prototype.setItem.call(storage, key, value);
    };

    scene.confirmStarter();

    expect(start).not.toHaveBeenCalled();
    expect(scene.overlay.root.innerHTML).toContain(CANNOT_SAVE_MESSAGE);
  });

  it('starts the game on its saved copy where the browser can save', () => {
    const storage = new MemoryStorage();
    const { scene, start } = openStarter(storage);

    scene.confirmStarter();

    expect(start).toHaveBeenCalledTimes(1);
    const [key, data] = start.mock.calls[0] as [string, { savedGame: { raidProgress?: unknown } }];
    expect(key).toBe('base');
    // The game the base reads is the saved one, whole - never the unsaved draft.
    expect(data.savedGame.raidProgress).toBeDefined();
    expect(new SaveManager(storage).load()?.starterSpeciesId).toBe('bulbasaur');
  });
});

describe('choosing a partner', () => {
  /** The cursor arriving on a card, as an arrow key or the pointer moves it. */
  const cursorOn = (scene: StarterInternals, starter: string) =>
    scene.overlay.listeners.get('focusin')!({
      target: { closest: (selector: string) => (selector === '[data-starter]' ? { dataset: { starter } } : null) },
    });

  it('names the starter the cursor is on in the bar under the cards (playtest 47)', () => {
    const { scene, start } = openStarter(new MemoryStorage());
    expect(scene.overlay.root.innerHTML).toContain('Confirm Bulbasaur');

    cursorOn(scene, 'charmander');

    // The bar used to go on saying CONFIRM BULBASAUR until Enter was pressed
    // on Charmander's card.
    expect(scene.overlay.elements.get('[data-confirm]')?.textContent).toBe('Confirm Charmander');
    expect(scene.overlay.elements.get('[data-chosen-name]')?.textContent).toBe('Charmander');
    // Moving the cursor commits nothing.
    expect(start).not.toHaveBeenCalled();
  });

  it('follows an arrow key even where moving the cursor fires no focus event', () => {
    // A page without the window's focus moves the cursor silently, which is
    // how the browser check of this fix first saw CONFIRM BULBASAUR again.
    const { scene } = openStarter(new MemoryStorage());
    vi.stubGlobal('document', {
      activeElement: {
        matches: () => false,
        closest: (selector: string) => (selector === '[data-starter]' ? { dataset: { starter: 'charmander' } } : null),
      },
    });
    try {
      scene.handleKey({ key: 'ArrowRight', preventDefault: () => undefined } as KeyboardEvent);
    } finally {
      vi.unstubAllGlobals();
    }

    expect(scene.overlay.elements.get('[data-confirm]')?.textContent).toBe('Confirm Charmander');
  });

  /** A key pressed with the cursor on `active`, saying whether the scene took it itself. */
  const press = (scene: StarterInternals, key: string, active: unknown): boolean => {
    const preventDefault = vi.fn();
    vi.stubGlobal('document', { activeElement: active });
    try {
      scene.handleKey({ key, preventDefault } as unknown as KeyboardEvent);
    } finally {
      vi.unstubAllGlobals();
    }
    return preventDefault.mock.calls.length > 0;
  };
  const onConfirm = { matches: (selector: string) => selector === '[data-confirm]', closest: () => null };

  it('goes back up from CONFIRM to the card chosen, never the card above the button', () => {
    // CONFIRM stands at the right of the bar, so the card nearest it is Squirtle:
    // Charmander chosen, Down, Up used to swap the partner for a Squirtle.
    const { scene } = openStarter(new MemoryStorage());
    cursorOn(scene, 'charmander');

    for (const key of ['ArrowUp', 'ArrowLeft']) {
      scene.overlay.focused.length = 0;
      expect(press(scene, key, onConfirm)).toBe(true);
      expect(scene.overlay.focused).toEqual(['[data-starter="charmander"]']);
    }
    expect(scene.overlay.elements.get('[data-confirm]')?.textContent).toBe('Confirm Charmander');
  });

  it('brings a lost cursor back on the choice, rather than starting again at the first card', () => {
    const { scene } = openStarter(new MemoryStorage());
    cursorOn(scene, 'squirtle');
    scene.overlay.cursorInside = false;

    expect(press(scene, 'ArrowLeft', { matches: () => false, closest: () => null })).toBe(true);

    expect(scene.overlay.focused).toEqual(['[data-starter="squirtle"]']);
    expect(scene.overlay.elements.get('[data-confirm]')?.textContent).toBe('Confirm Squirtle');
  });

  it('says the choice on the screen already drawn, never by drawing it again', () => {
    // Drawn again inside the focus event, the card the cursor had just landed
    // on was thrown away with the columns measured for it: the cards stood at
    // their narrowest with no cursor, and two waiting cursor moves took turns
    // choosing for ever (the captain, 30 Oct 2026).
    const { scene } = openStarter(new MemoryStorage());
    const drawn = scene.overlay.drawn;

    cursorOn(scene, 'squirtle');

    expect(scene.overlay.drawn).toBe(drawn);
    // Measured again, because the CONFIRM button is as wide as its new words.
    expect(scene.overlay.measured).toBe(1);
    const [bulbasaur, , squirtle] = scene.overlay.cards;
    expect(squirtle.classes.has('is-selected')).toBe(true);
    expect(squirtle.attributes.get('aria-pressed')).toBe('true');
    expect(squirtle.dataset.help).toBe('Chosen. Confirm below.');
    expect(bulbasaur.classes.has('is-selected')).toBe(false);
    expect(bulbasaur.attributes.get('aria-pressed')).toBe('false');
    expect(bulbasaur.dataset.help).toBe('Choose this starter.');
  });

  it('leaves the choice alone while the pointer only crosses a card', () => {
    // On the way from Bulbasaur to CONFIRM the mouse crosses Charmander.
    const { scene } = openStarter(new MemoryStorage());

    expect(scene.overlay.pointerRule).toBe('previews');
  });

  it('chooses the card clicked, and confirms that one', () => {
    const storage = new MemoryStorage();
    const { scene } = openStarter(storage);
    const drawn = scene.overlay.drawn;

    scene.overlay.cards[1].onclick!();

    expect(scene.overlay.drawn).toBe(drawn);
    scene.confirmStarter();
    expect(new SaveManager(storage).load()?.starterSpeciesId).toBe('charmander');
  });

  it('confirms the starter the cursor last chose', () => {
    const storage = new MemoryStorage();
    const { scene } = openStarter(storage);

    cursorOn(scene, 'squirtle');
    scene.confirmStarter();

    expect(new SaveManager(storage).load()?.starterSpeciesId).toBe('squirtle');
  });
});
